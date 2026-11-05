"""Script de descarga quirurgica de modelos faltantes para VozStudio Omni-ES.

Almacena todos los modelos exclusivamente en C:\antigravityAS\Modelos -ai-brains
cumpliendo estrictamente con la Regla 22 de GEMINI.md (cero duplicacion).
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import dotenv
from huggingface_hub import hf_hub_download, snapshot_download

DOTENV_PATH = Path(r"C:\antigravityAS\VozStudio-Omni-ES\.env")
dotenv.load_dotenv(DOTENV_PATH)
HF_TOKEN = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")

MODELS_DIR = Path(r"C:\antigravityAS\Modelos -ai-brains")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def download_piper_missing() -> None:
    log("=== [1/5] Descargando modelos Piper faltantes ===")

    # 1.1 mls_10246-low
    target_10246 = MODELS_DIR / "vits-piper-es_ES-mls_10246-low"
    target_10246.mkdir(parents=True, exist_ok=True)
    for fname in ["es_ES-mls_10246-low.onnx", "es_ES-mls_10246-low.onnx.json", "MODEL_CARD"]:
        dest = target_10246 / fname
        if not dest.is_file() or dest.stat().st_size == 0:
            log(f"Descargando {fname} para mls_10246-low...")
            hf_hub_download(
                repo_id="rhasspy/piper-voices",
                filename=f"es/es_ES/mls_10246/low/{fname}",
                local_dir=str(target_10246),
                token=HF_TOKEN,
            )
            # Mover si quedo en subcarpeta es/es_ES/...
            sub_file = target_10246 / "es" / "es_ES" / "mls_10246" / "low" / fname
            if sub_file.is_file():
                if dest.is_file():
                    dest.unlink()
                sub_file.replace(dest)
        else:
            log(f"{fname} ya existe ({dest.stat().st_size / (1024*1024):.2f} MB).")

    # 1.2 mls_9972-low
    target_9972 = MODELS_DIR / "vits-piper-es_ES-mls_9972-low"
    target_9972.mkdir(parents=True, exist_ok=True)
    for fname in ["es_ES-mls_9972-low.onnx", "es_ES-mls_9972-low.onnx.json", "MODEL_CARD"]:
        dest = target_9972 / fname
        if not dest.is_file() or dest.stat().st_size == 0:
            log(f"Descargando {fname} para mls_9972-low...")
            hf_hub_download(
                repo_id="rhasspy/piper-voices",
                filename=f"es/es_ES/mls_9972/low/{fname}",
                local_dir=str(target_9972),
                token=HF_TOKEN,
            )
            sub_file = target_9972 / "es" / "es_ES" / "mls_9972" / "low" / fname
            if sub_file.is_file():
                if dest.is_file():
                    dest.unlink()
                sub_file.replace(dest)
        else:
            log(f"{fname} ya existe ({dest.stat().st_size / (1024*1024):.2f} MB).")

    # 1.3 miro-high (OpenVoiceOS)
    target_miro = MODELS_DIR / "vits-piper-es_ES-miro-high"
    if not (target_miro / "es_ES-miro-high.onnx").is_file():
        log("Descargando vits-piper-es_ES-miro-high (60 MB)...")
        snapshot_download(
            repo_id="csukuangfj/vits-piper-es_ES-miro-high",
            local_dir=str(target_miro),
            token=HF_TOKEN,
        )
    else:
        log("vits-piper-es_ES-miro-high ya existe.")


def download_mms_onnx() -> None:
    log("=== [2/5] Descargando Meta MMS-TTS ONNX (Xenova) ===")
    target = MODELS_DIR / "mms-tts-spa-onnx"
    if not (target / "onnx" / "model.onnx").is_file():
        log("Descargando Xenova/mms-tts-spa...")
        snapshot_download(
            repo_id="Xenova/mms-tts-spa",
            local_dir=str(target),
            token=HF_TOKEN,
        )
    else:
        log("mms-tts-spa-onnx ya existe.")


def download_f5_spanish() -> None:
    log("=== [3/5] Descargando F5-TTS Spanish (jpgallegoar/F5-Spanish) ===")
    target = MODELS_DIR / "F5-Spanish"
    target.mkdir(parents=True, exist_ok=True)
    # Descargar checkpoint de inferencia y metadatos (evitando el checkpoint de optimizador .pt de 5.1 GB)
    files = [
        "model_1250000.safetensors",
        "transformer_config.yaml",
        "vocab.txt",
        "README.md",
        "Spanish_F5.ipynb",
    ]
    for f in files:
        dest = target / f
        if not dest.is_file() or dest.stat().st_size == 0:
            log(f"Descargando {f} ({target.name})...")
            hf_hub_download(
                repo_id="jpgallegoar/F5-Spanish",
                filename=f,
                local_dir=str(target),
                token=HF_TOKEN,
            )
        else:
            log(f"{f} ya existe ({dest.stat().st_size / (1024*1024):.2f} MB).")


def download_styletts2() -> None:
    log("=== [4/5] Descargando StyleTTS 2 Spanish Multispeaker (BSC-LT) ===")
    target = MODELS_DIR / "styletts2-spanish-multispeaker"
    if not (target / "styletts2-spanish-multispeaker_2nd_phase_epoch_86.pth").is_file():
        log("Descargando BSC-LT/styletts2-spanish-multispeaker (~2.05 GB)...")
        snapshot_download(
            repo_id="BSC-LT/styletts2-spanish-multispeaker",
            local_dir=str(target),
            token=HF_TOKEN,
        )
    else:
        log("StyleTTS 2 Spanish ya existe.")


def download_xtts_v2() -> None:
    log("=== [5/5] Descargando Coqui XTTS-v2 ===")
    target = MODELS_DIR / "XTTS-v2"
    if not (target / "model.pth").is_file():
        log("Descargando coqui/XTTS-v2 (~1.98 GB)...")
        snapshot_download(
            repo_id="coqui/XTTS-v2",
            local_dir=str(target),
            token=HF_TOKEN,
        )
    else:
        log("XTTS-v2 ya existe.")


def cleanup_subfolders() -> None:
    """Limpia subcarpetas redundantes creadas por hf_hub_download si existen."""
    for base in [MODELS_DIR / "vits-piper-es_ES-mls_10246-low", MODELS_DIR / "vits-piper-es_ES-mls_9972-low"]:
        redundant = base / "es"
        if redundant.is_dir():
            import shutil
            shutil.rmtree(redundant, ignore_errors=True)


def main() -> None:
    log(f"Directorio central de modelos: {MODELS_DIR}")
    t0 = time.perf_counter()
    download_piper_missing()
    cleanup_subfolders()
    download_mms_onnx()
    download_f5_spanish()
    download_styletts2()
    download_xtts_v2()
    elapsed = time.perf_counter() - t0
    log(f"Descargas completadas con exito en {elapsed:.1f} segundos.")


if __name__ == "__main__":
    main()
