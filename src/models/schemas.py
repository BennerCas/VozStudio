"""Esquemas Pydantic v2 estrictos para peticiones, respuestas y metadatos de biblioteca."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class SynthesizeRequest(BaseModel):
    """Solicitud de sintesis neural estandar."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    text: str = Field(..., min_length=1, max_length=12000, description="Texto en espanol a sintetizar")
    engine_id: str = Field(default="kokoro", pattern=r"^[a-z0-9_-]{2,32}$")
    voice_id: str | None = Field(default=None, max_length=64)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch_semitones: float = Field(default=0.0, ge=-6.0, le=6.0)
    emotion: str | None = Field(default=None, max_length=40)
    max_chunk_chars: int = Field(default=260, ge=80, le=600)

    @field_validator("voice_id")
    @classmethod
    def validate_voice_id(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        for ch in value:
            if not (ch.isalnum() or ch in ("_", "-")):
                raise ValueError("Identificador de voz contiene caracteres no permitidos.")
        return value


class NormalizePreviewRequest(BaseModel):
    """Solicitud de previsualizacion fonetica y segmentacion sin scroll."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(default="", max_length=12000)
    max_chars: int = Field(default=260, ge=80, le=600)


class NormalizePreviewResponse(BaseModel):
    """Segmentos normalizados listos para sintesis por bloques."""

    segments: list[str]
    total_chars: int
    segments_count: int


class HardwareMetricsResponse(BaseModel):
    """Telemetria instantanea de RAM, CPU y DirectML."""

    ram_total_gb: float
    ram_used_gb: float
    ram_available_gb: float
    process_rss_mb: float
    vram_limit_gb: float
    cpu_threads: int
    dml_available: bool
    available_providers: list[str]


class SystemStatusResponse(BaseModel):
    """Estado general del sistema y motor residente en memoria."""

    app: str
    version: str
    active_engine: str | None
    active_provider: str | None
    estimated_engine_mb: float
    hardware: HardwareMetricsResponse


class EngineInfoResponse(BaseModel):
    """Descriptor publico de un motor neural TTS."""

    id: str
    name: str
    category: str
    available: bool
    active: bool
    license: str
    estimated_mb: float
    availability_note: str
    voices_count: int
    description: str = ""


class VoiceInfoResponse(BaseModel):
    """Descriptor publico de una voz neural."""

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


class LibraryItemResponse(BaseModel):
    """Registro auditado de un archivo generado en biblioteca/."""

    id: str
    archivo: str
    json_archivo: str = ""
    audio_url: str
    modelo_origen: str
    motor: str
    voz_id: str
    parametros: dict[str, Any]
    prompt_original: str
    metricas: dict[str, Any]
    contexto: dict[str, Any]


class SynthesisEnvelopeResponse(BaseModel):
    """Respuesta estandar tras generar y archivar audio."""

    item: LibraryItemResponse


class VocalCleanMetricsResponse(BaseModel):
    """Metricas de la limpieza acustica vocal DSP."""

    duracion_seg: float
    pico_original: float
    pico_final: float
    filtros_aplicados: list[str]
    sample_rate: int


class VocalCleanResponse(BaseModel):
    """Respuesta del endpoint de limpieza acustica vocal."""

    audio_url: str
    metrics: VocalCleanMetricsResponse

