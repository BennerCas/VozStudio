"""Esquemas Pydantic v2 estrictos para peticiones, respuestas y metadatos de biblioteca."""

from __future__ import annotations

from typing import Any, Literal
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
    voice_design_prompt: str | None = Field(default=None, max_length=1500)
    instruct_prompt: str | None = Field(default=None, max_length=1500)
    temperature: float = Field(default=0.7, ge=0.1, le=1.5)

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
    is_custom: bool = False
    prompt_utilizado: str = ""


class EnhancePromptRequest(BaseModel):
    """Solicitud para optimizar descripcion acustica mediante Phi DirectML."""

    prompt: str = Field(..., min_length=2, max_length=600)
    mode: str = Field(default="voice_design", max_length=32)


class EnhancePromptResponse(BaseModel):
    """Respuesta con la descripcion acustica enriquecida por IA local."""

    original_prompt: str
    enhanced_prompt: str
    engine_used: str


class UpdateVoiceMetadataRequest(BaseModel):
    """Campos editables para metadatos de un timbre personalizado."""

    name: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    region: str | None = Field(default=None, max_length=20)
    gender: str | None = Field(default=None, max_length=20)
    reference_text: str | None = Field(default=None, max_length=1200)
    prompt_utilizado: str | None = Field(default=None, max_length=1200)


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


class ProjectMemoryPayload(BaseModel):
    """Contexto persistente que mantiene coherencia entre escenas y sesiones."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    brief: str | None = Field(default=None, max_length=1000)
    creative_direction: str | None = Field(default=None, max_length=1500)
    glossary: list[str] | None = Field(default=None, max_length=60)
    notes: list[str] | None = Field(default=None, max_length=60)


class ProjectSceneCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(default="Nueva escena", min_length=1, max_length=120)
    role: str = Field(default="scene", min_length=1, max_length=40)
    text: str = Field(default="", max_length=12000)
    engine_id: str = Field(default="kokoro", pattern=r"^[a-z0-9_-]{2,32}$")
    voice_id: str | None = Field(default=None, max_length=64)
    parameters: dict[str, Any] = Field(default_factory=dict)


class ProjectSceneUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=40)
    text: str | None = Field(default=None, max_length=12000)
    engine_id: str | None = Field(default=None, pattern=r"^[a-z0-9_-]{2,32}$")
    voice_id: str | None = Field(default=None, max_length=64)
    parameters: dict[str, Any] | None = None
    status: Literal["draft", "ready", "generated", "approved"] | None = None
    library_item_ids: list[str] | None = Field(default=None, max_length=100)


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(default="Proyecto sin titulo", min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    preset_id: str | None = Field(default=None, pattern=r"^[a-z0-9_]{2,64}$")
    memory: ProjectMemoryPayload | None = None


class ProjectUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    project_type: str | None = Field(default=None, min_length=1, max_length=48)
    color: str | None = Field(default=None, min_length=4, max_length=20)
    deliverables: list[str] | None = Field(default=None, max_length=40)
    settings: dict[str, Any] | None = None
    memory: ProjectMemoryPayload | None = None


class ProjectSceneResponse(BaseModel):
    id: str
    title: str
    role: str
    text: str
    engine_id: str
    voice_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    status: str
    library_item_ids: list[str] = Field(default_factory=list)


class ProjectMemoryResponse(BaseModel):
    brief: str = ""
    creative_direction: str = ""
    glossary: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    prompt_version: str = ""


class ProjectResponse(BaseModel):
    schema_version: int
    id: str
    name: str
    description: str
    project_type: str
    preset_id: str | None = None
    preset_version: str
    color: str
    scenes: list[ProjectSceneResponse]
    deliverables: list[str] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)
    memory: ProjectMemoryResponse
    created_at: str
    updated_at: str


class ProjectPresetResponse(BaseModel):
    id: str
    name: str
    project_type: str
    description: str
    color: str
    deliverables: list[str] = Field(default_factory=list)

