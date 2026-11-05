"""Adaptador neural principal para Kokoro-82M v1.0 ONNX con perfiles y mezclas en espanol."""

from __future__ import annotations

import gc
import logging
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import MODELS_LINK_DIR
from src.core.hardware import create_onnx_session_with_fallback

logger = logging.getLogger(__name__)

KOKORO_SAMPLE_RATE = 24000

_EMOTION_SPEED_FACTOR: dict[str, float] = {
    "neutral": 1.0,
    "neutro": 1.0,
    "narrativo": 0.96,
    "calido": 0.94,
    "informativo": 1.03,
    "expresivo": 1.08,
    "alegre": 1.06,
    "calmo": 0.92,
    "energico": 1.12,
    "susurro": 0.90,
}


class KokoroEngine(BaseTTSEngine):
    """Motor TTS principal basado en Kokoro-82M v1.0 ONNX con fallback automatico DirectML->CPU."""

    engine_id = "kokoro"
    display_name = "Kokoro-82M v1.0 ONNX"
    category = "fast"
    estimated_mb = 355.0
    license_name = "Apache-2.0"
    description = (
        "Motor neural principal de estudio en espanol (82M parametros, 24 kHz) "
        "con voces nativas y mezclas vectoriales de estilo."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        *,
        prefer_dml: bool = True,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._prefer_dml = prefer_dml
        self._session: ort.InferenceSession | None = None
        self._kokoro: Any = None
        self._provider: str | None = None

    @property
    def model_path(self) -> Path:
        """Ruta al grafo ONNX de Kokoro v1.0."""
        return self._models_link_dir / "kokoro-v1_0-onnx" / "onnx" / "kokoro-v1.0.onnx"

    @property
    def voices_path(self) -> Path:
        """Ruta al archivo binario de embeddings de voces."""
        primary = self._models_link_dir / "kokoro-tts-voices" / "voices.bin"
        if primary.is_file():
            return primary
        fallback = self._models_link_dir / "kokoro-v1_0-onnx" / "voices.bin"
        return fallback if fallback.is_file() else primary

    def is_available(self) -> bool:
        """Verifica que el modelo ONNX y el banco de voces existan localmente."""
        return self.model_path.is_file() and self.voices_path.is_file()

    def availability_note(self) -> str:
        """Retorna estado detallado de disponibilidad local."""
        if self.is_available():
            return (
                "Pesos ONNX v1.0 y banco de voces disponibles localmente mediante "
                "models_link/kokoro-v1_0-onnx y models_link/kokoro-tts-voices."
            )
        return (
            f"Faltan archivos locales requeridos: modelo={self.model_path}, "
            f"voces={self.voices_path}. Ejecute scripts/setup_links.ps1."
        )

    def get_voices(self) -> list[VoiceDescriptor]:
        """Catalogo de 5 perfiles neurales en espanol (3 base + 2 mezclas vectoriales)."""
        return [
            VoiceDescriptor(
                id="ef_dora",
                name="Dora Neural",
                engine=self.engine_id,
                region="LATAM",
                gender="F",
                sample_rate=KOKORO_SAMPLE_RATE,
                quality="studio",
                description="Voz femenina calida y conversacional de estudio.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="em_alex",
                name="Alex Neural",
                engine=self.engine_id,
                region="LATAM",
                gender="M",
                sample_rate=KOKORO_SAMPLE_RATE,
                quality="studio",
                description="Voz masculina equilibrada, clara y articulada.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="em_santa",
                name="Santa Neural",
                engine=self.engine_id,
                region="LATAM",
                gender="M",
                sample_rate=KOKORO_SAMPLE_RATE,
                quality="studio",
                description="Voz masculina profunda, grave y expresiva.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="es_blend_editorial",
                name="Sofia Editorial",
                engine=self.engine_id,
                region="LATAM",
                gender="F",
                sample_rate=KOKORO_SAMPLE_RATE,
                quality="studio",
                description="Mezcla vectorial editorial (70% Dora + 30% Alex) para lectura fluida.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="es_blend_documental",
                name="Mateo Documental",
                engine=self.engine_id,
                region="LATAM",
                gender="M",
                sample_rate=KOKORO_SAMPLE_RATE,
                quality="studio",
                description="Mezcla vectorial documental (65% Alex + 35% Santa) con cuerpo narrativo.",
                supports_cloning=False,
                supports_emotion=True,
            ),
        ]

    def load(self) -> str:
        """Carga Kokoro ONNX ejecutando warmup real para garantizar estabilidad DirectML o CPU."""
        if self._kokoro is not None and self._provider is not None:
            return self._provider

        if not self.is_available():
            raise FileNotFoundError(self.availability_note())

        from kokoro_onnx import Kokoro

        voices_str = str(self.voices_path)
        holder: dict[str, Any] = {"instance": None}

        def _warmup(sess: ort.InferenceSession) -> None:
            inst = Kokoro.from_session(sess, voices_str)
            inst.create("Hola.", voice="ef_dora", speed=1.0, lang="es")
            holder["instance"] = inst

        session, provider = create_onnx_session_with_fallback(
            self.model_path,
            prefer_dml=self._prefer_dml,
            warmup_fn=_warmup,
        )

        kokoro_inst = holder["instance"]
        if kokoro_inst is None or getattr(kokoro_inst, "sess", None) is not session:
            kokoro_inst = Kokoro.from_session(session, voices_str)

        self._session = session
        self._kokoro = kokoro_inst
        self._provider = provider
        logger.info("Kokoro-82M cargado exitosamente en %s.", provider)
        return provider

    def unload(self) -> None:
        """Libera la sesion ONNX y cierra el archivo de estilos de voz."""
        if self._kokoro is not None:
            voices_obj = getattr(self._kokoro, "voices", None)
            if voices_obj is not None and callable(getattr(voices_obj, "close", None)):
                try:
                    voices_obj.close()
                except Exception:
                    pass
        self._kokoro = None
        self._session = None
        self._provider = None
        gc.collect()

    def _resolve_voice_target(self, voice_id: str) -> str | np.ndarray:
        """Obtiene el nombre base o calcula la mezcla vectorial numpy para Kokoro.create."""
        if self._kokoro is None:
            raise RuntimeError("El motor Kokoro no se encuentra cargado.")

        clean_id = (voice_id or "ef_dora").strip()
        if clean_id in ("ef_dora", "em_alex", "em_santa"):
            return clean_id

        voices = self._kokoro.voices
        if clean_id == "es_blend_editorial":
            blend = 0.70 * np.asarray(voices["ef_dora"], dtype=np.float32) + 0.30 * np.asarray(
                voices["em_alex"], dtype=np.float32
            )
            return blend.astype(np.float32, copy=False)

        if clean_id == "es_blend_documental":
            blend = 0.65 * np.asarray(voices["em_alex"], dtype=np.float32) + 0.35 * np.asarray(
                voices["em_santa"], dtype=np.float32
            )
            return blend.astype(np.float32, copy=False)

        valid_ids = [v.id for v in self.get_voices()]
        raise ValueError(
            f"Voz '{clean_id}' no reconocida en Kokoro. Voces validas: {valid_ids}"
        )

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Sintetiza cada bloque normalizado en espanol a 24000 Hz."""
        if self._kokoro is None or self._provider is None:
            self.load()

        selected_voice = (voice_id or "ef_dora").strip()
        voice_target = self._resolve_voice_target(selected_voice)

        emotion_key = (params.emotion or "neutral").strip().lower()
        emotion_mult = _EMOTION_SPEED_FACTOR.get(emotion_key, 1.0)
        effective_speed = float(np.clip(float(params.speed) * emotion_mult, 0.5, 2.0))

        audio_chunks: list[np.ndarray] = []
        sample_rate = KOKORO_SAMPLE_RATE

        for chunk in chunks:
            clean_chunk = chunk.strip()
            if not clean_chunk or not any(ch.isalnum() for ch in clean_chunk):
                continue
            samples, sr = self._kokoro.create(
                clean_chunk,
                voice=voice_target,
                speed=effective_speed,
                lang="es",
            )
            sample_rate = int(sr)
            arr = np.asarray(samples, dtype=np.float32).reshape(-1)
            if arr.size > 0:
                audio_chunks.append(arr)

        if not audio_chunks:
            raise ValueError("La sintesis con Kokoro no produjo muestras de audio validas.")

        model_origin = f"Kokoro-82M-v1.0-ONNX ({selected_voice})"
        return audio_chunks, sample_rate, model_origin, self._provider or "CPUExecutionProvider"
