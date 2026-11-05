"""Adaptador regional multiacento para Piper VITS ONNX (ES, MX y AR)."""

from __future__ import annotations

from dataclasses import dataclass
import gc
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import CPU_THREADS, MODELS_LINK_DIR
from src.core.hardware import build_session_options, create_onnx_session_with_fallback

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class _PiperVoiceSpec:
    """Especificacion interna de ruta y hablante para un submodelo Piper VITS."""

    voice_id: str
    name: str
    region: str
    gender: str
    sample_rate: int
    quality: str
    dir_name: str
    onnx_filename: str
    description: str
    speaker_id: int | None = None


_PIPER_SPECS: tuple[_PiperVoiceSpec, ...] = (
    _PiperVoiceSpec(
        voice_id="es_MX-claude-high",
        name="Claude",
        region="MX",
        gender="M",
        sample_rate=22050,
        quality="high",
        dir_name="vits-piper-es_MX-claude-high",
        onnx_filename="es_MX-claude-high.onnx",
        description="Voz masculina mexicana de alta definicion y prosodia natural.",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_MX-ald-medium",
        name="Aldo",
        region="MX",
        gender="M",
        sample_rate=22050,
        quality="medium",
        dir_name="vits-piper-es_MX-ald-medium",
        onnx_filename="es_MX-ald-medium.onnx",
        description="Voz masculina mexicana agil para lectura informativa.",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_AR-daniela-high",
        name="Daniela",
        region="AR",
        gender="F",
        sample_rate=22050,
        quality="high",
        dir_name="vits-piper-es_AR-daniela-high",
        onnx_filename="es_AR-daniela-high.onnx",
        description="Voz femenina rioplatense argentina de alta fidelidad.",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-davefx-medium",
        name="David",
        region="ES",
        gender="M",
        sample_rate=22050,
        quality="medium",
        dir_name="vits-piper-es_ES-davefx-medium",
        onnx_filename="es_ES-davefx-medium.onnx",
        description="Voz masculina castellana clara para locucion general.",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-sharvard-m",
        name="Alvaro Sharvard",
        region="ES",
        gender="M",
        sample_rate=22050,
        quality="medium",
        dir_name="vits-piper-es_ES-sharvard-medium",
        onnx_filename="es_ES-sharvard-medium.onnx",
        description="Locutor masculino castellano del corpus fonetico Sharvard (speaker 0).",
        speaker_id=0,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-sharvard-f",
        name="Elena Sharvard",
        region="ES",
        gender="F",
        sample_rate=22050,
        quality="medium",
        dir_name="vits-piper-es_ES-sharvard-medium",
        onnx_filename="es_ES-sharvard-medium.onnx",
        description="Locutora femenina castellana del corpus fonetico Sharvard (speaker 1).",
        speaker_id=1,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-carlfm-x_low",
        name="Carlos Ligero",
        region="ES",
        gender="M",
        sample_rate=16000,
        quality="x_low",
        dir_name="vits-piper-es_ES-carlfm-x_low",
        onnx_filename="es_ES-carlfm-x_low.onnx",
        description="Voz castellana ultraligera de latencia minima (16 kHz).",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-miro-high",
        name="Miro",
        region="ES",
        gender="M",
        sample_rate=22050,
        quality="high",
        dir_name="vits-piper-es_ES-miro-high",
        onnx_filename="es_ES-miro-high.onnx",
        description="Voz castellana de alta definicion de la comunidad OpenVoiceOS.",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-mls_10246-low",
        name="Marcos MLS",
        region="ES",
        gender="M",
        sample_rate=16000,
        quality="low",
        dir_name="vits-piper-es_ES-mls_10246-low",
        onnx_filename="es_ES-mls_10246-low.onnx",
        description="Voz masculina castellana del corpus Multilingual LibriSpeech.",
        speaker_id=None,
    ),
    _PiperVoiceSpec(
        voice_id="es_ES-mls_9972-low",
        name="Carmen MLS",
        region="ES",
        gender="F",
        sample_rate=16000,
        quality="low",
        dir_name="vits-piper-es_ES-mls_9972-low",
        onnx_filename="es_ES-mls_9972-low.onnx",
        description="Voz femenina castellana del corpus Multilingual LibriSpeech.",
        speaker_id=None,
    ),
)

_PIPER_SPEC_MAP: dict[str, _PiperVoiceSpec] = {spec.voice_id: spec for spec in _PIPER_SPECS}


class PiperEngine(BaseTTSEngine):
    """Motor regional VITS para espanol de Mexico, Argentina y Espana con cache de submodelo."""

    engine_id = "piper"
    display_name = "Piper VITS Multiacento"
    category = "fast"
    estimated_mb = 120.0
    license_name = "MIT"
    description = (
        "Sintesis VITS ultrarrapida con 10 voces regionales reales para Mexico (MX), "
        "Argentina (AR) y Espana (ES), incluyendo modelos multi-hablante y alta definicion."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        *,
        prefer_dml: bool = False,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._prefer_dml = prefer_dml
        self._cached_onnx_path: Path | None = None
        self._cached_voice: Any = None
        self._provider: str | None = None

    def _onnx_path_for(self, spec: _PiperVoiceSpec) -> Path:
        return self._models_link_dir / spec.dir_name / spec.onnx_filename

    def _config_path_for(self, spec: _PiperVoiceSpec) -> Path:
        return self._models_link_dir / spec.dir_name / f"{spec.onnx_filename}.json"

    def _is_spec_installed(self, spec: _PiperVoiceSpec) -> bool:
        return self._onnx_path_for(spec).is_file() and self._config_path_for(spec).is_file()

    def is_available(self) -> bool:
        """Disponible si al menos una de las 7 voces regionales existe localmente."""
        return any(self._is_spec_installed(spec) for spec in _PIPER_SPECS)

    def availability_note(self) -> str:
        """Detalla cuantas voces regionales estan vinculadas localmente."""
        installed = [spec.voice_id for spec in _PIPER_SPECS if self._is_spec_installed(spec)]
        if installed:
            return (
                f"{len(installed)}/{len(_PIPER_SPECS)} voces regionales Piper VITS "
                "disponibles en models_link/."
            )
        return "No se detectaron submodelos Piper VITS en models_link/. Ejecute scripts/setup_links.ps1."

    def get_voices(self) -> list[VoiceDescriptor]:
        """Retorna las 7 voces regionales hispanas soportadas."""
        return [
            VoiceDescriptor(
                id=spec.voice_id,
                name=spec.name,
                engine=self.engine_id,
                region=spec.region,
                gender=spec.gender,
                sample_rate=spec.sample_rate,
                quality=spec.quality,
                description=spec.description,
                supports_cloning=False,
                supports_emotion=False,
            )
            for spec in _PIPER_SPECS
        ]

    def _ensure_submodel_loaded(self, spec: _PiperVoiceSpec) -> tuple[Any, str]:
        """Carga bajo demanda el submodelo .onnx solicitado liberando el previo si difiere."""
        onnx_path = self._onnx_path_for(spec)
        config_path = self._config_path_for(spec)
        if not onnx_path.is_file() or not config_path.is_file():
            raise FileNotFoundError(
                f"Archivos del modelo Piper '{spec.voice_id}' no encontrados: {onnx_path}"
            )

        if (
            self._cached_voice is not None
            and self._cached_onnx_path == onnx_path
            and self._provider is not None
        ):
            return self._cached_voice, self._provider

        if self._cached_voice is not None:
            self._cached_voice = None
            self._cached_onnx_path = None
            gc.collect()

        from piper.config import PiperConfig
        from piper.voice import ESPEAK_DATA_DIR, PiperVoice

        config_dict = json.loads(config_path.read_text(encoding="utf-8"))
        piper_config = PiperConfig.from_dict(config_dict)

        voice_dir = onnx_path.parent
        local_espeak = voice_dir / "espeak-ng-data"
        espeak_dir = local_espeak if local_espeak.is_dir() else Path(ESPEAK_DATA_DIR)

        if self._prefer_dml:
            session, provider = create_onnx_session_with_fallback(
                onnx_path,
                prefer_dml=True,
                warmup_fn=None,
            )
        else:
            cpu_opts = build_session_options(for_dml=False, cpu_threads=CPU_THREADS)
            session = ort.InferenceSession(
                str(onnx_path),
                sess_options=cpu_opts,
                providers=["CPUExecutionProvider"],
            )
            provider = "CPUExecutionProvider"

        piper_voice = PiperVoice(
            config=piper_config,
            session=session,
            espeak_data_dir=espeak_dir,
            download_dir=voice_dir,
        )

        self._cached_onnx_path = onnx_path
        self._cached_voice = piper_voice
        self._provider = provider
        logger.info("Submodelo Piper '%s' cargado en %s.", onnx_path.name, provider)
        return piper_voice, provider

    def load(self) -> str:
        """Prepara el motor Piper precargando la voz por defecto disponible."""
        if self._cached_voice is not None and self._provider is not None:
            return self._provider

        for spec in _PIPER_SPECS:
            if self._is_spec_installed(spec):
                _, provider = self._ensure_submodel_loaded(spec)
                return provider

        raise FileNotFoundError(self.availability_note())

    def unload(self) -> None:
        """Libera el submodelo Piper en cache."""
        self._cached_voice = None
        self._cached_onnx_path = None
        self._provider = None
        gc.collect()

    @staticmethod
    def _extract_chunk_float32(audio_chunk: Any) -> np.ndarray:
        """Extrae muestras mono np.float32 en [-1.0, 1.0] desde un AudioChunk de Piper."""
        float_arr = getattr(audio_chunk, "audio_float_array", None)
        if float_arr is not None:
            arr = np.asarray(float_arr, dtype=np.float32).reshape(-1)
            return np.clip(arr, -1.0, 1.0)

        pcm_bytes = getattr(audio_chunk, "audio_int16_bytes", b"")
        if pcm_bytes:
            arr_i16 = np.frombuffer(pcm_bytes, dtype=np.int16)
            return np.clip(arr_i16.astype(np.float32) / 32768.0, -1.0, 1.0)

        return np.zeros(0, dtype=np.float32)

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Sintetiza fragmentos usando la voz regional Piper solicitada."""
        selected_id = (voice_id or "es_MX-claude-high").strip()
        spec = _PIPER_SPEC_MAP.get(selected_id)
        if spec is None:
            raise ValueError(
                f"Voz Piper '{selected_id}' no reconocida. "
                f"Voces validas: {list(_PIPER_SPEC_MAP.keys())}"
            )

        piper_voice, provider = self._ensure_submodel_loaded(spec)

        from piper.config import SynthesisConfig

        safe_speed = float(np.clip(float(params.speed), 0.5, 2.0))
        base_length_scale = float(piper_voice.config.length_scale or 1.0)
        effective_length_scale = base_length_scale / safe_speed

        syn_config = SynthesisConfig(
            speaker_id=spec.speaker_id,
            length_scale=effective_length_scale,
            normalize_audio=True,
        )

        audio_arrays: list[np.ndarray] = []
        sample_rate = int(piper_voice.config.sample_rate)

        for chunk_text in chunks:
            clean_text = chunk_text.strip()
            if not clean_text or not any(ch.isalnum() for ch in clean_text):
                continue

            sub_pieces: list[np.ndarray] = []
            for audio_chunk in piper_voice.synthesize(clean_text, syn_config=syn_config):
                sample_rate = int(audio_chunk.sample_rate)
                samples_f32 = self._extract_chunk_float32(audio_chunk)
                if samples_f32.size > 0:
                    sub_pieces.append(samples_f32)

            if sub_pieces:
                combined = (
                    sub_pieces[0]
                    if len(sub_pieces) == 1
                    else np.concatenate(sub_pieces).astype(np.float32, copy=False)
                )
                audio_arrays.append(combined)

        if not audio_arrays:
            raise ValueError(f"Piper VITS ('{selected_id}') no genero muestras de audio.")

        model_origin = f"Piper-VITS ({spec.onnx_filename}, voice={selected_id})"
        return audio_arrays, sample_rate, model_origin, provider
