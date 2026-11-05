"""Configuracion centralizada y carga segura de variables de entorno para VozStudio Omni-ES."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_PROJECT_ROOT = Path(r"C:\antigravityAS\VozStudio-Omni-ES")


def load_dotenv_file(env_path: Path | None = None, *, override: bool = False) -> int:
    """Carga pares CLAVE=VALOR desde un archivo .env usando la libreria estandar.

    Aplica ``os.environ.setdefault`` por defecto sin registrar ni imprimir jamas
    valores sensibles o credenciales (cumplimiento Zero-Trust de GEMINI.md).
    """
    target_path = env_path if env_path is not None else (DEFAULT_PROJECT_ROOT / ".env")
    if not target_path.is_file():
        return 0

    loaded_count = 0
    raw_content = target_path.read_text(encoding="utf-8-sig")
    for raw_line in raw_content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue

        key_part, value_part = line.split("=", 1)
        key = key_part.strip()
        if not key or any(ch.isspace() for ch in key):
            continue

        value = _parse_env_value(value_part.strip())
        if override:
            os.environ[key] = value
            loaded_count += 1
        elif key not in os.environ:
            os.environ.setdefault(key, value)
            loaded_count += 1

    return loaded_count


def _parse_env_value(raw_value: str) -> str:
    """Limpia comillas envolventes y comentarios en linea no entrecomillados."""
    if len(raw_value) >= 2 and raw_value[0] == raw_value[-1] and raw_value[0] in ("'", '"'):
        return raw_value[1:-1]

    comment_idx = raw_value.find(" #")
    if comment_idx != -1:
        raw_value = raw_value[:comment_idx].rstrip()
    return raw_value


def _parse_float_env(var_name: str, default: float, *, minimum: float = 0.1) -> float:
    raw = os.environ.get(var_name)
    if raw is None or raw.strip() == "":
        return default
    try:
        parsed = float(raw.strip())
    except ValueError:
        return default
    return parsed if parsed >= minimum else default


def _parse_int_env(var_name: str, default: int, *, minimum: int = 0) -> int:
    raw = os.environ.get(var_name)
    if raw is None or raw.strip() == "":
        return default
    try:
        parsed = int(raw.strip())
    except ValueError:
        return default
    return parsed if parsed >= minimum else default


# Carga silenciosa inicial de .env y aseguramiento de directivas de hardware GEMINI.md
load_dotenv_file(DEFAULT_PROJECT_ROOT / ".env")


def _sync_project_hardware_directives(env_path: Path) -> None:
    """Sincroniza directivas no secretas de hardware desde .env del proyecto sobre valores heredados obsoletos."""
    hardware_keys = {"OLIVE_GPU_MEMORY_LIMIT", "OLIVE_CPU_THREADS", "ORT_DML_DEVICE_ID"}
    if env_path.is_file():
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[len("export ") :].strip()
            k, v = line.split("=", 1)
            key = k.strip()
            if key in hardware_keys:
                os.environ[key] = _parse_env_value(v.strip())

    os.environ.setdefault("OLIVE_GPU_MEMORY_LIMIT", "25")
    os.environ.setdefault("OLIVE_CPU_THREADS", "12")
    os.environ.setdefault("ORT_DML_DEVICE_ID", "0")


_sync_project_hardware_directives(DEFAULT_PROJECT_ROOT / ".env")


@dataclass(frozen=True, slots=True)
class AppConfig:
    """Configuracion inmutable de rutas, limites de hardware y metadatos de aplicacion."""

    PROJECT_ROOT: Path = DEFAULT_PROJECT_ROOT
    MODELS_LINK_DIR: Path = DEFAULT_PROJECT_ROOT / "models_link"
    BIBLIOTECA_DIR: Path = DEFAULT_PROJECT_ROOT / "biblioteca"
    BRAINS_SPACE_DIR: Path = Path(r"C:\antigravityAS\Modelos -ai-brains")
    BRAINS_HYPHEN_DIR: Path = Path(r"C:\antigravityAS\Modelos-ai-brains")
    GPU_MEMORY_LIMIT_GB: float = 25.0
    CPU_THREADS: int = 12
    DML_DEVICE_ID: int = 0
    APP_NAME: str = "VozStudio Omni-ES"
    APP_VERSION: str = "1.0.0"
    DEFAULT_USER: str = "Benner"

    @classmethod
    def from_env(cls, project_root: Path | None = None) -> AppConfig:
        """Construye una instancia inmutable a partir de las variables de entorno activas."""
        root = project_root if project_root is not None else DEFAULT_PROJECT_ROOT
        brains_space = Path(
            os.environ.get("MODELS_BRAINS_DIR", r"C:\antigravityAS\Modelos -ai-brains")
        )
        return cls(
            PROJECT_ROOT=root,
            MODELS_LINK_DIR=root / "models_link",
            BIBLIOTECA_DIR=root / "biblioteca",
            BRAINS_SPACE_DIR=brains_space,
            BRAINS_HYPHEN_DIR=Path(r"C:\antigravityAS\Modelos-ai-brains"),
            GPU_MEMORY_LIMIT_GB=_parse_float_env("OLIVE_GPU_MEMORY_LIMIT", 25.0, minimum=1.0),
            CPU_THREADS=_parse_int_env("OLIVE_CPU_THREADS", 12, minimum=1),
            DML_DEVICE_ID=_parse_int_env("ORT_DML_DEVICE_ID", 0, minimum=0),
            APP_NAME="VozStudio Omni-ES",
            APP_VERSION="1.0.0",
            DEFAULT_USER=os.environ.get("VOZSTUDIO_USER", "Benner").strip() or "Benner",
        )


settings: AppConfig = AppConfig.from_env()

PROJECT_ROOT: Path = settings.PROJECT_ROOT
MODELS_LINK_DIR: Path = settings.MODELS_LINK_DIR
BIBLIOTECA_DIR: Path = settings.BIBLIOTECA_DIR
BRAINS_SPACE_DIR: Path = settings.BRAINS_SPACE_DIR
BRAINS_HYPHEN_DIR: Path = settings.BRAINS_HYPHEN_DIR
GPU_MEMORY_LIMIT_GB: float = settings.GPU_MEMORY_LIMIT_GB
CPU_THREADS: int = settings.CPU_THREADS
DML_DEVICE_ID: int = settings.DML_DEVICE_ID
APP_NAME: str = settings.APP_NAME
APP_VERSION: str = settings.APP_VERSION
DEFAULT_USER: str = settings.DEFAULT_USER

__all__ = [
    "APP_NAME",
    "APP_VERSION",
    "AppConfig",
    "BIBLIOTECA_DIR",
    "BRAINS_HYPHEN_DIR",
    "BRAINS_SPACE_DIR",
    "CPU_THREADS",
    "DEFAULT_USER",
    "DML_DEVICE_ID",
    "GPU_MEMORY_LIMIT_GB",
    "MODELS_LINK_DIR",
    "PROJECT_ROOT",
    "load_dotenv_file",
    "settings",
]
