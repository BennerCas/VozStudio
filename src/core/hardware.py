"""Gestion de sesiones ONNX Runtime DirectML con fallback seguro a CPU y telemetria de hardware."""

from __future__ import annotations

import ctypes
from ctypes import wintypes
import gc
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable

import onnxruntime as ort

from src.core.config import CPU_THREADS, DML_DEVICE_ID, GPU_MEMORY_LIMIT_GB

logger = logging.getLogger(__name__)

BYTES_PER_MB = float(1024**2)
BYTES_PER_GB = float(1024**3)


class _MEMORYSTATUSEX(ctypes.Structure):
    """Estructura Win32 MEMORYSTATUSEX para consulta nativa de memoria fisica."""

    _fields_ = [
        ("dwLength", wintypes.DWORD),
        ("dwMemoryLoad", wintypes.DWORD),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


class _PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    """Estructura Win32 PROCESS_MEMORY_COUNTERS para RSS del proceso actual."""

    _fields_ = [
        ("cb", wintypes.DWORD),
        ("PageFaultCount", wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def build_session_options(for_dml: bool, cpu_threads: int = CPU_THREADS) -> ort.SessionOptions:
    """Construye opciones de sesion ONNX Runtime optimizadas para DirectML o CPU."""
    threads = max(1, int(cpu_threads))
    so = ort.SessionOptions()
    so.intra_op_num_threads = threads
    so.inter_op_num_threads = 2
    so.log_severity_level = 3

    if for_dml:
        # DirectML exige desactivar mem_pattern y ejecucion secuencial para evitar fallos del asignador GPU
        so.enable_mem_pattern = False
        so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    else:
        so.enable_mem_pattern = True
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    return so


def create_onnx_session_with_fallback(
    model_path: str | Path,
    prefer_dml: bool = True,
    warmup_fn: Callable[[ort.InferenceSession], Any] | None = None,
) -> tuple[ort.InferenceSession, str]:
    """Crea una sesion ONNX intentando DirectML primario y degradando limpiamente a CPU ante fallo.

    Algunos operadores ONNX (ej. ConvTranspose 1D agrupado) instancian la sesion DirectML
    sin error pero fallan durante el primer ``sess.run()``, pudiendo incluso lanzar
    ``UnicodeDecodeError`` desde pybind11 en Windows en espanol. Ejecutar ``warmup_fn``
    dentro del bloque protegido garantiza un fallback inmediato y transparente a CPU.
    """
    resolved_path = Path(model_path)
    is_real_ort_session = getattr(ort.InferenceSession, "__module__", "").startswith("onnxruntime")
    if is_real_ort_session and not resolved_path.is_file():
        raise FileNotFoundError(f"Archivo de modelo ONNX no encontrado: {resolved_path}")

    available_providers = list(ort.get_available_providers())
    can_try_dml = bool(prefer_dml and "DmlExecutionProvider" in available_providers)

    if can_try_dml:
        dml_sess: ort.InferenceSession | None = None
        try:
            dml_options = build_session_options(for_dml=True, cpu_threads=CPU_THREADS)
            dml_providers: list[Any] = [
                ("DmlExecutionProvider", {"device_id": int(DML_DEVICE_ID)}),
                "CPUExecutionProvider",
            ]
            dml_sess = ort.InferenceSession(
                str(resolved_path),
                sess_options=dml_options,
                providers=dml_providers,
            )
            if warmup_fn is not None:
                warmup_fn(dml_sess)

            session_providers = list(dml_sess.get_providers())
            active_provider = (
                "DmlExecutionProvider"
                if "DmlExecutionProvider" in session_providers
                else "CPUExecutionProvider"
            )
            return dml_sess, active_provider
        except (KeyboardInterrupt, SystemExit, GeneratorExit):
            raise
        except BaseException as exc:
            logger.warning(
                "Fallo en inicializacion o warmup DirectML para '%s' (%r). Activando fallback CPU (%d hilos).",
                resolved_path.name,
                exc,
                CPU_THREADS,
            )
            dml_sess = None
            gc.collect()

    cpu_options = build_session_options(for_dml=False, cpu_threads=CPU_THREADS)
    cpu_sess = ort.InferenceSession(
        str(resolved_path),
        sess_options=cpu_options,
        providers=["CPUExecutionProvider"],
    )
    if warmup_fn is not None:
        warmup_fn(cpu_sess)
    return cpu_sess, "CPUExecutionProvider"


def _query_windows_memory_ctypes() -> tuple[float, float, float, float] | None:
    """Consulta RAM total/usada/disponible (GB) y RSS del proceso (MB) via ctypes Win32."""
    if sys.platform != "win32" or not hasattr(ctypes, "windll"):
        return None

    kernel32 = ctypes.windll.kernel32
    mem_status = _MEMORYSTATUSEX()
    mem_status.dwLength = ctypes.sizeof(_MEMORYSTATUSEX)
    global_mem_fn = kernel32.GlobalMemoryStatusEx
    global_mem_fn.argtypes = [ctypes.POINTER(_MEMORYSTATUSEX)]
    global_mem_fn.restype = wintypes.BOOL
    if not global_mem_fn(ctypes.byref(mem_status)):
        return None

    total_gb = mem_status.ullTotalPhys / BYTES_PER_GB
    avail_gb = mem_status.ullAvailPhys / BYTES_PER_GB
    used_gb = max(0.0, (mem_status.ullTotalPhys - mem_status.ullAvailPhys) / BYTES_PER_GB)

    rss_mb = 0.0
    counters = _PROCESS_MEMORY_COUNTERS()
    counters.cb = ctypes.sizeof(_PROCESS_MEMORY_COUNTERS)
    get_current_proc = kernel32.GetCurrentProcess
    get_current_proc.argtypes = []
    get_current_proc.restype = wintypes.HANDLE
    current_proc = get_current_proc()

    get_mem_info = getattr(kernel32, "K32GetProcessMemoryInfo", None)
    if get_mem_info is None and hasattr(ctypes.windll, "psapi"):
        get_mem_info = getattr(ctypes.windll.psapi, "GetProcessMemoryInfo", None)
    if get_mem_info is not None:
        get_mem_info.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(_PROCESS_MEMORY_COUNTERS),
            wintypes.DWORD,
        ]
        get_mem_info.restype = wintypes.BOOL
        if get_mem_info(current_proc, ctypes.byref(counters), counters.cb):
            rss_mb = float(counters.WorkingSetSize) / BYTES_PER_MB

    return (
        round(total_gb, 2),
        round(used_gb, 2),
        round(avail_gb, 2),
        round(rss_mb, 2),
    )


def _query_psutil_memory(*, allow_psutil: bool = True) -> tuple[float, float, float, float] | None:
    """Consulta metricas de RAM y RSS mediante psutil si se encuentra disponible."""
    if not allow_psutil:
        return None
    try:
        import psutil  # type: ignore[import-not-found]
    except ImportError:
        return None

    try:
        vm = psutil.virtual_memory()
        proc_rss = psutil.Process(os.getpid()).memory_info().rss
        total_gb = round(float(vm.total) / BYTES_PER_GB, 2)
        avail_gb = round(float(vm.available) / BYTES_PER_GB, 2)
        used_gb = round(max(0.0, float(vm.total - vm.available) / BYTES_PER_GB), 2)
        rss_mb = round(float(proc_rss) / BYTES_PER_MB, 2)
        return total_gb, used_gb, avail_gb, rss_mb
    except Exception:
        return None


def get_hardware_telemetry(*, prefer_ctypes: bool = True) -> dict[str, Any]:
    """Obtiene telemetria instantanea de RAM, proceso actual, CPU y proveedores DirectML."""
    ctypes_metrics = _query_windows_memory_ctypes() if prefer_ctypes else None
    psutil_metrics = _query_psutil_memory(allow_psutil=True)

    if ctypes_metrics is not None:
        ram_total_gb, ram_used_gb, ram_available_gb, rss_mb = ctypes_metrics
        if rss_mb <= 0.0 and psutil_metrics is not None:
            rss_mb = psutil_metrics[3]
    elif psutil_metrics is not None:
        ram_total_gb, ram_used_gb, ram_available_gb, rss_mb = psutil_metrics
    else:
        fallback_ctypes = _query_windows_memory_ctypes()
        if fallback_ctypes is not None:
            ram_total_gb, ram_used_gb, ram_available_gb, rss_mb = fallback_ctypes
        else:
            ram_total_gb, ram_used_gb, ram_available_gb, rss_mb = 0.0, 0.0, 0.0, 0.0

    try:
        providers = list(ort.get_available_providers())
    except Exception:
        providers = ["CPUExecutionProvider"]

    return {
        "ram_total_gb": float(ram_total_gb),
        "ram_used_gb": float(ram_used_gb),
        "ram_available_gb": float(ram_available_gb),
        "process_rss_mb": float(rss_mb),
        "vram_limit_gb": float(GPU_MEMORY_LIMIT_GB),
        "cpu_threads": int(CPU_THREADS),
        "dml_available": "DmlExecutionProvider" in providers,
        "available_providers": providers,
    }


__all__ = [
    "build_session_options",
    "create_onnx_session_with_fallback",
    "get_hardware_telemetry",
]
