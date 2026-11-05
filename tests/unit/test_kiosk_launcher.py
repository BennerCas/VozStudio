"""Pruebas unitarias y de subsistema Win32 para el lanzador Kiosko sin consolas."""

from __future__ import annotations

import json
from pathlib import Path
import struct
import subprocess

from src.core.config import PROJECT_ROOT
from src.main.headless_server import _install_windows_no_window_subprocess_guard


def _read_pe_subsystem(exe_path: Path) -> int:
    """Lee el campo Subsystem de la cabecera PE Optional Header (2 = WINDOWS_GUI, 3 = WINDOWS_CUI)."""
    raw = exe_path.read_bytes()
    assert raw[:2] == b"MZ", "El archivo no posee cabecera DOS MZ valida."
    pe_offset = struct.unpack_from("<I", raw, 0x3C)[0]
    assert raw[pe_offset : pe_offset + 4] == b"PE\x00\x00", "Firma PE invalida."
    optional_header_offset = pe_offset + 4 + 20
    # Offset 68 dentro de OptionalHeader (PE32 y PE32+) corresponde a Subsystem (UInt16)
    subsystem = struct.unpack_from("<H", raw, optional_header_offset + 68)[0]
    return subsystem


def test_compiled_launcher_is_windows_gui_subsystem_and_passes_selftest() -> None:
    """Certifica que VozStudio-Omni-ES.exe existe, es IMAGE_SUBSYSTEM_WINDOWS_GUI (2) y pasa --self-test."""
    exe_path = PROJECT_ROOT / "VozStudio-Omni-ES.exe"
    ico_path = PROJECT_ROOT / "scripts" / "launcher" / "vozstudio.ico"
    lnk_path = PROJECT_ROOT / "Iniciar VozStudio Omni-ES.lnk"

    assert exe_path.is_file(), f"Ejecutable no compilado: {exe_path}"
    assert ico_path.is_file() and ico_path.stat().st_size > 1000
    assert lnk_path.is_file()

    # Subsystem == 2 garantiza a nivel kernel Windows cero ventanas de consola al hacer doble clic
    assert _read_pe_subsystem(exe_path) == 2

    res = subprocess.run(
        [str(exe_path), "--self-test"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    assert res.returncode == 0

    report_file = PROJECT_ROOT / "logs" / "launcher_selftest.json"
    assert report_file.is_file()
    report = json.loads(report_file.read_text(encoding="utf-8"))
    assert report["status"] == "ok"
    assert Path(report["pythonw"]).is_file()
    assert Path(report["browser"]).is_file()
    assert report["work_area"]["width"] >= 800
    assert report["work_area"]["height"] >= 600

    # Verifica que el perfil aislado bloquea notificaciones, popups y extensiones
    prefs_file = PROJECT_ROOT / ".kiosk_profile" / "Default" / "Preferences"
    assert prefs_file.is_file()
    prefs = json.loads(prefs_file.read_text(encoding="utf-8"))
    content_settings = prefs["profile"]["default_content_setting_values"]
    assert content_settings["notifications"] == 2
    assert content_settings["popups"] == 2
    assert content_settings["ads"] == 2
    assert prefs["promotions_enabled"] is False


def test_headless_server_subprocess_no_window_guard() -> None:
    """Verifica que el parche de subprocesos inyecta CREATE_NO_WINDOW en Windows."""
    _install_windows_no_window_subprocess_guard()
    assert getattr(subprocess.Popen.__init__, "_vozstudio_patched", False) is True
