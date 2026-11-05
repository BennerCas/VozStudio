"""Adaptador VITS ligero para Meta MMS-TTS Espanol (facebook/mms-tts-spa)."""

from __future__ import annotations

import gc
import logging
import os
from pathlib import Path
from typing import Any

import numpy as np

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import BRAINS_SPACE_DIR, CPU_THREADS, MODELS_LINK_DIR

logger = logging.getLogger(__name__)

MMS_REPO_ID = "facebook/mms-tts-spa"
MMS_SAMPLE_RATE = 16000


class MMSSpanishEngine(BaseTTSEngine):
    """Motor VITS ligero basado en facebook/mms-tts-spa (16 kHz, CC-BY-NC-4.0 uso personal)."""

    engine_id = "mms"
    display_name = "Meta MMS-TTS Espanol"
    category = "fast"
    estimated_mb = 150.0
    license_name = "CC-BY-NC-4.0"
    description = (
        "Modelo VITS compacto de Meta AI para espanol general a 16 kHz "
        "(inferencia offline pura en CPU, licencia de uso personal/investigacion)."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        brains_dir: Path | None = None,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._brains_dir = brains_dir if brains_dir is not None else BRAINS_SPACE_DIR
        self._model: Any = None
        self._tokenizer: Any = None
        self._provider: str | None = None

    def resolve_model_dir(self) -> Path | None:
        """Busca los pesos locales en models_link/mms-tts-spa o en Modelos -ai-brains/mms-tts-spa."""
        candidates = (
            self._models_link_dir / "mms-tts-spa",
            self._brains_dir / "mms-tts-spa",
        )
        for folder in candidates:
            if not folder.is_dir():
                continue
            has_config = (folder / "config.json").is_file()
            has_weights = (
                (folder / "model.safetensors").is_file()
                or (folder / "pytorch_model.bin").is_file()
            )
            if has_config and has_weights:
                return folder
        return None

    def is_available(self) -> bool:
        """Retorna True si los pesos locales de mms-tts-spa estan instalados."""
        return self.resolve_model_dir() is not None

    def availability_note(self) -> str:
        """Describe estado local o instrucciones de descarga hacia Modelos -ai-brains."""
        resolved = self.resolve_model_dir()
        if resolved is not None:
            return f"Modelo local disponible para inferencia offline en: {resolved}"
        target = self._brains_dir / "mms-tts-spa"
        return (
            f"Opcional pendiente: descargue '{MMS_REPO_ID}' en '{target}' "
            "(o invoque MMSSpanishEngine.download_to_brains()) y ejecute scripts/setup_links.ps1."
        )

    def download_to_brains(self, target_dir: Path | None = None) -> Path:
        """Descarga facebook/mms-tts-spa en C:\\antigravityAS\\Modelos -ai-brains\\mms-tts-spa."""
        from huggingface_hub import snapshot_download

        dest = target_dir if target_dir is not None else (self._brains_dir / "mms-tts-spa")
        dest.mkdir(parents=True, exist_ok=True)
        token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN") or None

        snapshot_download(
            repo_id=MMS_REPO_ID,
            local_dir=str(dest),
            token=token,
        )
        logger.info("Modelo %s descargado en %s.", MMS_REPO_ID, dest)
        return dest

    def get_voices(self) -> list[VoiceDescriptor]:
        """Catalogo del perfil base en espanol de Meta MMS."""
        return [
            VoiceDescriptor(
                id="mms_es_spa",
                name="Meta MMS Espanol",
                engine=self.engine_id,
                region="LATAM",
                gender="M",
                sample_rate=MMS_SAMPLE_RATE,
                quality="light",
                description="Voz neural ligera VITS de Meta AI para espanol neutro a 16 kHz.",
                supports_cloning=False,
                supports_emotion=False,
            )
        ]

    def load(self) -> str:
        """Carga VitsModel y AutoTokenizer estrictamente offline (local_files_only=True)."""
        if self._model is not None and self._tokenizer is not None and self._provider is not None:
            return self._provider

        model_dir = self.resolve_model_dir()
        if model_dir is None:
            raise FileNotFoundError(self.availability_note())

        import torch
        from transformers import AutoTokenizer, VitsModel

        torch.set_num_threads(max(1, int(CPU_THREADS)))
        tokenizer = AutoTokenizer.from_pretrained(str(model_dir), local_files_only=True)
        model = VitsModel.from_pretrained(str(model_dir), local_files_only=True)
        model.eval()

        self._tokenizer = tokenizer
        self._model = model
        self._provider = "CPUExecutionProvider"
        logger.info("Meta MMS-TTS Espanol cargado offline desde %s.", model_dir)
        return self._provider

    def unload(self) -> None:
        """Libera tensores y modelo PyTorch de memoria."""
        self._model = None
        self._tokenizer = None
        self._provider = None
        gc.collect()

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Sintetiza fragmentos en espanol con torch.no_grad() a 16000 Hz."""
        selected_id = (voice_id or "mms_es_spa").strip()
        if selected_id != "mms_es_spa":
            raise ValueError(
                f"Voz '{selected_id}' no soportada por MMS. Use 'mms_es_spa'."
            )

        if self._model is None or self._tokenizer is None:
            self.load()

        import torch

        safe_speed = float(np.clip(float(params.speed), 0.5, 2.0))
        if hasattr(self._model, "speaking_rate"):
            self._model.speaking_rate = safe_speed

        sample_rate = int(getattr(self._model.config, "sampling_rate", MMS_SAMPLE_RATE))
        audio_arrays: list[np.ndarray] = []

        with torch.no_grad():
            for chunk_text in chunks:
                clean_text = chunk_text.strip()
                if not clean_text or not any(ch.isalnum() for ch in clean_text):
                    continue
                inputs = self._tokenizer(clean_text, return_tensors="pt")
                outputs = self._model(**inputs)
                waveform = outputs.waveform.squeeze().detach().cpu().numpy()
                arr = np.asarray(waveform, dtype=np.float32).reshape(-1)
                if arr.size > 0:
                    audio_arrays.append(np.clip(arr, -1.0, 1.0))

        if not audio_arrays:
            raise ValueError("Meta MMS-TTS no genero muestras de audio validas.")

        return audio_arrays, sample_rate, "facebook/mms-tts-spa", self._provider or "CPUExecutionProvider"
