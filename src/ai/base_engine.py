"""Contratos base y descriptores tipados para los motores neurales de sintesis TTS."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any

import numpy as np


@dataclass(frozen=True, slots=True)
class VoiceDescriptor:
    """Metadatos descriptivos de un perfil de voz neural."""

    id: str
    name: str
    engine: str
    region: str
    gender: str
    sample_rate: int
    quality: str
    description: str
    supports_cloning: bool = False
    supports_emotion: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Serializa el descriptor a diccionario plano compatible con Pydantic."""
        return asdict(self)


@dataclass(slots=True)
class SynthesisParams:
    """Parametros de control acustico y expresivo para una solicitud de sintesis."""

    speed: float = 1.0
    pitch_semitones: float = 0.0
    emotion: str | None = None
    reference_wav_path: str | None = None
    reference_text: str | None = None
    max_chunk_chars: int = 260


@dataclass(slots=True)
class EngineSynthesisResult:
    """Resultado crudo devuelto tras la sintesis y union de bloques."""

    samples: np.ndarray
    sample_rate: int
    model_origin: str
    backend_provider: str
    chunks_count: int
    inference_ms: float


class BaseTTSEngine(ABC):
    """Interfaz abstracta obligatoria para todo adaptador neural de VozStudio Omni-ES."""

    engine_id: str = ""
    display_name: str = ""
    category: str = "fast"
    estimated_mb: float = 0.0
    license_name: str = "Apache-2.0"
    description: str = ""

    @abstractmethod
    def is_available(self) -> bool:
        """Indica si los pesos requeridos por el motor residen localmente."""

    @abstractmethod
    def availability_note(self) -> str:
        """Describe el estado de disponibilidad local o guia de instalacion offline."""

    @abstractmethod
    def load(self) -> str:
        """Carga el motor en memoria y retorna el nombre del ExecutionProvider activo."""

    @abstractmethod
    def unload(self) -> None:
        """Libera todas las sesiones ONNX/tensores residentes de este motor."""

    @abstractmethod
    def get_voices(self) -> list[VoiceDescriptor]:
        """Retorna el catalogo de voces expuestas por este motor."""

    @abstractmethod
    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Sintetiza fragmentos de texto y retorna (arrays_float32, sample_rate, model_origin, provider)."""
