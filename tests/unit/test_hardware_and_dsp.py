"""Pruebas unitarias integrales para configuracion, DirectML fallback, MemoryManager y DSP."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
import json
import os
from pathlib import Path
import re
import sys
import types
from typing import Any

import numpy as np
import onnx
from onnx import TensorProto, helper
import onnxruntime as ort
import pytest
import soundfile as sf

from src.core import config as config_mod
from src.core.audio_dsp import (
    apply_pitch_shift,
    concat_audio_chunks,
    delete_biblioteca_item,
    get_biblioteca_item,
    list_biblioteca,
    remove_dc_and_normalize,
    sanitize_slug,
    save_generation_to_biblioteca,
)
from src.core.config import (
    APP_NAME,
    APP_VERSION,
    AppConfig,
    BIBLIOTECA_DIR,
    CPU_THREADS,
    DML_DEVICE_ID,
    GPU_MEMORY_LIMIT_GB,
    MODELS_LINK_DIR,
    PROJECT_ROOT,
    load_dotenv_file,
)
from src.core.hardware import (
    _query_windows_memory_ctypes,
    build_session_options,
    create_onnx_session_with_fallback,
    get_hardware_telemetry,
)
from src.core.memory_manager import MemoryManager
from src.models.schemas import HardwareMetricsResponse, LibraryItemResponse


def _build_minimal_add_onnx(model_file: Path) -> Path:
    """Construye un grafo ONNX minimo valido (Y = X + X) para pruebas reales de sesion."""
    x_info = helper.make_tensor_value_info("X", TensorProto.FLOAT, [1, 4])
    y_info = helper.make_tensor_value_info("Y", TensorProto.FLOAT, [1, 4])
    add_node = helper.make_node("Add", inputs=["X", "X"], outputs=["Y"], name="AddNode")
    graph = helper.make_graph([add_node], "MinimalAddGraph", [x_info], [y_info])
    model = helper.make_model(
        graph,
        producer_name="vozstudio_unit_test",
        opset_imports=[helper.make_opsetid("", 13)],
    )
    model.ir_version = 8
    onnx.save(model, str(model_file))
    return model_file


def test_config_constants_and_dotenv_loading(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifica constantes base de GEMINI.md, inmutabilidad y carga segura de .env."""
    assert PROJECT_ROOT == Path(r"C:\antigravityAS\VozStudio-Omni-ES")
    assert MODELS_LINK_DIR == PROJECT_ROOT / "models_link"
    assert BIBLIOTECA_DIR == PROJECT_ROOT / "biblioteca"
    assert GPU_MEMORY_LIMIT_GB == 25.0
    assert CPU_THREADS == 12
    assert DML_DEVICE_ID == 0
    assert APP_NAME == "VozStudio Omni-ES"
    assert APP_VERSION == "1.0.0"

    cfg = AppConfig.from_env(project_root=tmp_path)
    with pytest.raises(FrozenInstanceError):
        cfg.CPU_THREADS = 4  # type: ignore[misc]

    env_file = tmp_path / ".env"
    env_file.write_text(
        "# Comentario de prueba\n"
        "VOZSTUDIO_TEST_VAR_A=valor_alfa # comentario inline\n"
        "export VOZSTUDIO_TEST_VAR_B=\"valor con espacios\"\n"
        "VOZSTUDIO_TEST_EXISTING=nuevo_valor\n",
        encoding="utf-8",
    )

    monkeypatch.delenv("VOZSTUDIO_TEST_VAR_A", raising=False)
    monkeypatch.delenv("VOZSTUDIO_TEST_VAR_B", raising=False)
    monkeypatch.setenv("VOZSTUDIO_TEST_EXISTING", "valor_previo")

    loaded = load_dotenv_file(env_file, override=False)
    assert loaded == 2
    assert os.environ["VOZSTUDIO_TEST_VAR_A"] == "valor_alfa"
    assert os.environ["VOZSTUDIO_TEST_VAR_B"] == "valor con espacios"
    assert os.environ["VOZSTUDIO_TEST_EXISTING"] == "valor_previo"

    assert config_mod is not None


def test_build_session_options_dml_and_cpu() -> None:
    """Valida reglas criticas de SessionOptions para DirectML y CPU."""
    so_dml = build_session_options(for_dml=True, cpu_threads=12)
    assert so_dml.intra_op_num_threads == 12
    assert so_dml.inter_op_num_threads == 2
    assert so_dml.log_severity_level == 3
    assert so_dml.enable_mem_pattern is False
    assert so_dml.execution_mode == ort.ExecutionMode.ORT_SEQUENTIAL

    so_cpu = build_session_options(for_dml=False, cpu_threads=12)
    assert so_cpu.intra_op_num_threads == 12
    assert so_cpu.inter_op_num_threads == 2
    assert so_cpu.enable_mem_pattern is True
    assert so_cpu.graph_optimization_level == ort.GraphOptimizationLevel.ORT_ENABLE_ALL


def test_onnx_session_real_execution_and_warmup_fallbacks(tmp_path: Path) -> None:
    """Prueba ejecucion ONNX real y fallback automatico ante RuntimeError y UnicodeDecodeError."""
    model_path = _build_minimal_add_onnx(tmp_path / "minimal_add.onnx")
    sample_in = np.array([[1.5, -2.0, 0.25, 4.0]], dtype=np.float32)

    # 1. Ejecucion real completa con warmup exitoso
    sess_ok, active_provider = create_onnx_session_with_fallback(
        model_path,
        prefer_dml=True,
        warmup_fn=lambda s: s.run(None, {"X": sample_in}),
    )
    assert active_provider in ("DmlExecutionProvider", "CPUExecutionProvider")
    out = sess_ok.run(None, {"X": sample_in})[0]
    np.testing.assert_allclose(out, sample_in * 2.0, rtol=1e-5)

    # 2. Fallo simulado RuntimeError en primer warmup (DirectML) -> fallback limpio a CPU
    dml_attempts: list[list[str]] = []

    def warmup_fail_on_dml_runtime(s: ort.InferenceSession) -> None:
        provs = list(s.get_providers())
        dml_attempts.append(provs)
        if "DmlExecutionProvider" in provs:
            raise RuntimeError("Fallo simulado en operador ConvTranspose 1D agrupado sobre DirectML")
        s.run(None, {"X": sample_in})

    sess_fb_rt, prov_fb_rt = create_onnx_session_with_fallback(
        model_path,
        prefer_dml=True,
        warmup_fn=warmup_fail_on_dml_runtime,
    )
    assert prov_fb_rt == "CPUExecutionProvider"
    assert sess_fb_rt.get_providers() == ["CPUExecutionProvider"]
    if "DmlExecutionProvider" in ort.get_available_providers():
        assert len(dml_attempts) == 2
        assert "DmlExecutionProvider" in dml_attempts[0]
        assert dml_attempts[1] == ["CPUExecutionProvider"]

    # 3. Fallo critico UnicodeDecodeError desde pybind11 en Windows ES ("El parametro no es correcto")
    unicode_calls = 0

    def warmup_fail_unicode_on_dml(s: ort.InferenceSession) -> None:
        nonlocal unicode_calls
        unicode_calls += 1
        if "DmlExecutionProvider" in s.get_providers():
            raise UnicodeDecodeError(
                "utf-8",
                b"El par\xe1metro no es correcto",
                6,
                7,
                "invalid continuation byte",
            )
        s.run(None, {"X": sample_in})

    sess_fb_uni, prov_fb_uni = create_onnx_session_with_fallback(
        model_path,
        prefer_dml=True,
        warmup_fn=warmup_fail_unicode_on_dml,
    )
    assert prov_fb_uni == "CPUExecutionProvider"
    out_cpu = sess_fb_uni.run(None, {"X": sample_in})[0]
    np.testing.assert_allclose(out_cpu, sample_in * 2.0, rtol=1e-5)


def test_hardware_telemetry_and_ctypes() -> None:
    """Valida el contrato de telemetria instantanea de hardware y compatibilidad Pydantic."""
    telemetry = get_hardware_telemetry(prefer_ctypes=True)
    validated = HardwareMetricsResponse(**telemetry)

    assert validated.ram_total_gb > 0.0
    assert validated.ram_available_gb > 0.0
    assert validated.ram_used_gb >= 0.0
    assert validated.process_rss_mb > 0.0
    assert validated.vram_limit_gb == 25.0
    assert validated.cpu_threads == 12
    assert isinstance(validated.dml_available, bool)
    assert "CPUExecutionProvider" in validated.available_providers

    if sys.platform == "win32":
        ctypes_only = _query_windows_memory_ctypes()
        assert ctypes_only is not None
        total_gb, used_gb, avail_gb, rss_mb = ctypes_only
        assert total_gb > 0.0
        assert avail_gb > 0.0
        assert used_gb >= 0.0
        assert rss_mb > 0.0


def test_memory_manager_single_active_engine_eviction(monkeypatch: pytest.MonkeyPatch) -> None:
    """Comprueba la politica Single-Active-Engine (Zero-OOM) y limpieza de recursos."""
    mgr = MemoryManager()
    events: list[str] = []

    fake_cuda = types.SimpleNamespace(
        is_available=lambda: True,
        empty_cache=lambda: events.append("torch_cuda_empty_cache"),
    )
    fake_torch = types.ModuleType("torch")
    fake_torch.cuda = fake_cuda  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "torch", fake_torch)

    prov_a = mgr.activate_engine(
        "kokoro",
        loader_fn=lambda: (events.append("load_kokoro") or "DmlExecutionProvider"),
        unloader_fn=lambda: events.append("unload_kokoro"),
        estimated_mb=320.0,
    )
    assert prov_a == "DmlExecutionProvider"
    assert mgr.active_engine_id == "kokoro"
    assert mgr.estimated_mb == 320.0
    assert mgr.loaded_at is not None

    # Re-activar el mismo motor no debe recargarlo ni desalojarlo
    prov_a_again = mgr.activate_engine(
        "kokoro",
        loader_fn=lambda: (events.append("load_kokoro_duplicate") or "DmlExecutionProvider"),
        unloader_fn=lambda: events.append("unload_kokoro"),
        estimated_mb=320.0,
    )
    assert prov_a_again == "DmlExecutionProvider"
    assert "load_kokoro_duplicate" not in events

    # Activar un segundo motor distinto debe desalojar primero a kokoro y limpiar cache
    prov_b = mgr.activate_engine(
        "piper",
        loader_fn=lambda: (events.append("load_piper") or "CPUExecutionProvider"),
        unloader_fn=lambda: events.append("unload_piper"),
        estimated_mb=75.0,
    )
    assert prov_b == "CPUExecutionProvider"
    assert mgr.active_engine_id == "piper"
    assert events == [
        "load_kokoro",
        "unload_kokoro",
        "torch_cuda_empty_cache",
        "load_piper",
    ]

    status = mgr.get_status()
    assert status["active_engine_id"] == "piper"
    assert status["active_provider"] == "CPUExecutionProvider"
    assert status["estimated_mb"] == 75.0

    assert mgr.unload_current() is True
    assert mgr.active_engine_id is None
    assert mgr.unload_current() is False


def test_audio_dsp_normalization_concat_and_pitch() -> None:
    """Verifica normalizacion DC, concatenacion sin clics y cambio de tono."""
    assert sanitize_slug("Español / Álex ../../etc/passwd") == "Espanol_Alex_etc_passwd"
    assert sanitize_slug("../../..") == "default"

    sr = 24000
    t = np.linspace(0.0, 0.25, int(sr * 0.25), endpoint=False, dtype=np.float32)
    sine = 0.3 * np.sin(2.0 * np.pi * 440.0 * t) + 0.45  # Fuerte offset DC
    stereo = np.vstack([sine, sine])

    norm = remove_dc_and_normalize(stereo, target_peak=0.92, trim_silence=False)
    assert norm.ndim == 1
    assert norm.dtype == np.float32
    assert abs(float(np.mean(norm))) < 1e-3
    assert pytest.approx(float(np.max(np.abs(norm))), rel=1e-3) == 0.92

    # Concatenacion con pausa natural (120 ms) y rampa anti-clic (10 ms)
    chunk_1 = np.ones(2400, dtype=np.float32) * 0.5
    chunk_2 = np.ones(2400, dtype=np.float32) * 0.5
    joined = concat_audio_chunks([chunk_1, chunk_2], sample_rate=sr, pause_ms=120, crossfade_ms=10)
    expected_pause = int(round(sr * 0.120))
    assert joined.shape == (2400 + expected_pause + 2400,)
    assert joined[0] == 0.0
    assert joined[-1] == 0.0
    assert np.all(joined[2400 : 2400 + expected_pause] == 0.0)

    # Concatenacion con crossfade overlap-add (pause_ms=0)
    blended = concat_audio_chunks([chunk_1, chunk_2], sample_rate=sr, pause_ms=0, crossfade_ms=10)
    expected_overlap = int(round(sr * 0.010))
    assert blended.shape == (2400 + 2400 - expected_overlap,)

    # Pitch shift: cero overhead en 0 semitonos y desplazamiento espectral real en +4 semitonos
    clean_sine = (0.5 * np.sin(2.0 * np.pi * 220.0 * t)).astype(np.float32)
    unchanged = apply_pitch_shift(clean_sine, sample_rate=sr, semitones=0.0)
    np.testing.assert_array_equal(unchanged, clean_sine)

    shifted = apply_pitch_shift(clean_sine, sample_rate=sr, semitones=4.0)
    assert shifted.dtype == np.float32
    assert shifted.shape == clean_sine.shape
    assert not np.allclose(shifted, clean_sine)

    freqs = np.fft.rfftfreq(clean_sine.size, d=1.0 / sr)
    orig_peak_hz = float(freqs[int(np.argmax(np.abs(np.fft.rfft(clean_sine))))])
    shifted_peak_hz = float(freqs[int(np.argmax(np.abs(np.fft.rfft(shifted))))])
    assert shifted_peak_hz > orig_peak_hz * 1.15


def test_biblioteca_persistence_metadata_and_path_traversal(tmp_path: Path) -> None:
    """Valida escritura WAV+JSON conforme a ESTRUCTURA.md, listado y bloqueo Path Traversal."""
    bib_dir = tmp_path / "biblioteca"
    sr = 24000
    samples = (0.5 * np.sin(2.0 * np.pi * 330.0 * np.linspace(0, 0.5, sr // 2, dtype=np.float32))).astype(
        np.float32
    )

    meta_1: dict[str, Any] = save_generation_to_biblioteca(
        samples=samples,
        sample_rate=sr,
        engine_id="kokoro",
        model_origin="kokoro-82m-v1.0.onnx",
        voice_id="ef_dora",
        prompt_text="Hola mundo desde VozStudio Omni-ES.",
        inference_ms=84.5,
        chunks_count=1,
        params={"speed": 1.05, "pitch_semitones": 0.0, "emotion_prompt": "neutral"},
        backend_provider="DmlExecutionProvider",
        peak_memory_mb=412.3,
        biblioteca_dir=bib_dir,
    )

    # Segunda llamada identica inmediata (verifica desambiguacion sin sobrescritura)
    meta_1_collision: dict[str, Any] = save_generation_to_biblioteca(
        samples=samples,
        sample_rate=sr,
        engine_id="kokoro",
        model_origin="kokoro-82m-v1.0.onnx",
        voice_id="ef_dora",
        prompt_text="Segunda toma identica en rafaga.",
        inference_ms=70.0,
        chunks_count=1,
        biblioteca_dir=bib_dir,
    )
    assert meta_1_collision["id"] != meta_1["id"]
    assert delete_biblioteca_item(meta_1_collision["id"], biblioteca_dir=bib_dir) is True

    # Segundo motor distinto
    meta_2: dict[str, Any] = save_generation_to_biblioteca(
        samples=samples,
        sample_rate=sr,
        engine_id="piper",
        model_origin="es_MX-claude-high.onnx",
        voice_id="es_MX_claude",
        prompt_text="Segunda prueba regional mexicana.",
        inference_ms=42.0,
        chunks_count=2,
        params={"speed": 1.0},
        backend_provider="CPUExecutionProvider",
        peak_memory_mb=180.0,
        biblioteca_dir=bib_dir,
    )

    # Validar patron de nombre estricto ESTRUCTURA.md
    pattern = re.compile(r"^\d{8}_\d{6}_audio_[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+\.wav$")
    assert pattern.match(meta_1["archivo"])
    assert pattern.match(meta_2["archivo"])

    # Validar compatibilidad directa con LibraryItemResponse y todos los campos de ESTRUCTURA.md
    parsed_schema = LibraryItemResponse(**meta_1)
    assert parsed_schema.motor == "kokoro"

    required_top = {
        "id",
        "archivo",
        "json_archivo",
        "modelo_origen",
        "motor",
        "voz_id",
        "parametros",
        "prompt_original",
        "metricas",
        "contexto",
    }
    assert required_top.issubset(meta_1.keys())
    assert {
        "speed",
        "pitch_semitones",
        "sample_rate",
        "emotion_prompt",
        "reference_audio",
    }.issubset(meta_1["parametros"].keys())
    assert {
        "caracteres_entrada",
        "fragmentos",
        "duracion_audio_seg",
        "tiempo_inferencia_ms",
        "rtf",
        "pico_memoria_mb",
    }.issubset(meta_1["metricas"].keys())
    assert {
        "app",
        "version",
        "timestamp",
        "usuario",
        "backend",
        "cpu_threads",
    }.issubset(meta_1["contexto"].keys())

    wav_file = bib_dir / meta_1["archivo"]
    json_file = bib_dir / meta_1["json_archivo"]
    assert wav_file.is_file()
    assert json_file.is_file()

    wav_info = sf.info(str(wav_file))
    assert wav_info.samplerate == sr
    assert wav_info.subtype == "PCM_16"

    # Crear JSON huerfano sin WAV para confirmar que list_biblioteca lo filtra
    (bib_dir / "20260101_000000_audio_ghost_none.json").write_text(
        json.dumps({"id": "20260101_000000_audio_ghost_none", "archivo": "no_existe.wav"}),
        encoding="utf-8",
    )

    all_items = list_biblioteca(biblioteca_dir=bib_dir)
    assert len(all_items) == 2
    kokoro_only = list_biblioteca(biblioteca_dir=bib_dir, engine_filter="kokoro")
    assert len(kokoro_only) == 1
    assert kokoro_only[0]["id"] == meta_1["id"]

    queried = list_biblioteca(biblioteca_dir=bib_dir, query="mexicana")
    assert len(queried) == 1
    assert queried[0]["id"] == meta_2["id"]

    fetched_wav, fetched_meta = get_biblioteca_item(meta_1["id"], biblioteca_dir=bib_dir)
    assert fetched_wav == wav_file.resolve()
    assert fetched_meta["id"] == meta_1["id"]

    # Prevencion estricta OWASP Path Traversal
    traversal_payloads = [
        "../.env",
        "..\\..\\Windows\\win.ini",
        "../../secret",
        "/etc/passwd",
        r"C:\Windows\System32\cmd.exe",
        "audio_ok/../escape",
        "item\x00evil",
    ]
    for payload in traversal_payloads:
        with pytest.raises(ValueError):
            get_biblioteca_item(payload, biblioteca_dir=bib_dir)
        with pytest.raises(ValueError):
            delete_biblioteca_item(payload, biblioteca_dir=bib_dir)

    assert delete_biblioteca_item(meta_1["id"], biblioteca_dir=bib_dir) is True
    assert not wav_file.exists()
    assert not json_file.exists()
    assert delete_biblioteca_item(meta_1["id"], biblioteca_dir=bib_dir) is False
