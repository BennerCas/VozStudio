"""Daemon backend silencioso (sin consola) para el lanzador de escritorio VozStudio Omni-ES."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _install_windows_no_window_subprocess_guard() -> None:
    """Fuerza CREATE_NO_WINDOW en cualquier subproceso hijo (ej. espeak-ng) bajo Windows."""
    if sys.platform != "win32":
        return

    create_no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    original_init = subprocess.Popen.__init__

    if getattr(original_init, "_vozstudio_patched", False):
        return

    def _silent_popen_init(self: subprocess.Popen, *args: object, **kwargs: object) -> None:
        flags = int(kwargs.get("creationflags", 0) or 0)
        kwargs["creationflags"] = flags | create_no_window
        original_init(self, *args, **kwargs)

    setattr(_silent_popen_init, "_vozstudio_patched", True)
    subprocess.Popen.__init__ = _silent_popen_init  # type: ignore[method-assign]


def _redirect_null_streams(log_path: Path) -> None:
    """Redirige stdout/stderr hacia archivo rotado cuando se ejecuta bajo pythonw.exe sin consola."""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    if log_path.exists():
        try:
            if log_path.stat().st_size > 2 * 1024 * 1024:
                backup = log_path.with_suffix(".prev.log")
                if backup.exists():
                    backup.unlink()
                log_path.replace(backup)
        except OSError:
            pass

    stream = open(log_path, mode="a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


def run_headless_server(host: str = "127.0.0.1", port: int = 8880, log_file: Path | None = None) -> None:
    """Inicializa protecciones sin consola y levanta FastAPI/Uvicorn en loopback."""
    _install_windows_no_window_subprocess_guard()
    target_log = log_file if log_file is not None else (PROJECT_ROOT / "logs" / "vozstudio_backend.log")
    _redirect_null_streams(target_log)

    os.environ.setdefault("OLIVE_GPU_MEMORY_LIMIT", "25")
    os.environ.setdefault("OLIVE_CPU_THREADS", "12")
    os.environ.setdefault("ORT_DML_DEVICE_ID", "0")
    os.environ["VOZSTUDIO_HOST"] = host
    os.environ["VOZSTUDIO_PORT"] = str(port)

    import uvicorn
    from src.main.main import create_app

    application = create_app()
    config = uvicorn.Config(
        app=application,
        host=host,
        port=port,
        log_level="info",
        access_log=False,
        use_colors=False,
    )
    server = uvicorn.Server(config)
    server.run()


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor silencioso VozStudio Omni-ES")
    parser.add_argument("--host", default=os.environ.get("VOZSTUDIO_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("VOZSTUDIO_PORT", "8880")))
    args = parser.parse_args()
    run_headless_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
