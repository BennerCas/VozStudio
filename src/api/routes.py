"""Rutas REST API v1 de VozStudio Omni-ES con validacion OWASP y trazabilidad de biblioteca."""

from __future__ import annotations

import logging
from pathlib import Path
import tempfile
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
import soundfile as sf
from starlette.concurrency import run_in_threadpool

from src.ai.base_engine import SynthesisParams
from src.ai.engine_factory import EngineOrchestrator, orchestrator as default_orchestrator
from src.core.audio_dsp import (
    delete_biblioteca_item,
    get_biblioteca_item,
    list_biblioteca,
)
from src.core.config import APP_NAME, APP_VERSION, BIBLIOTECA_DIR
from src.core.hardware import get_hardware_telemetry
from src.core.memory_manager import memory_manager
from src.core.text_normalizer import prepare_spanish_chunks
from src.models.schemas import (
    EngineInfoResponse,
    HardwareMetricsResponse,
    LibraryItemResponse,
    NormalizePreviewRequest,
    NormalizePreviewResponse,
    SynthesisEnvelopeResponse,
    SynthesizeRequest,
    SystemStatusResponse,
    VoiceInfoResponse,
)

logger = logging.getLogger(__name__)

MAX_REFERENCE_WAV_BYTES = 15 * 1024 * 1024  # 15 MB limite defensivo OWASP


def _format_library_item(raw: dict[str, Any]) -> LibraryItemResponse:
    """Normaliza la URL de audio hacia /api/v1/library/{id}/audio y empaqueta la respuesta."""
    item_id = str(raw.get("id") or Path(str(raw.get("archivo", "item.wav"))).stem)
    return LibraryItemResponse(
        id=item_id,
        archivo=str(raw.get("archivo", f"{item_id}.wav")),
        json_archivo=str(raw.get("json_archivo", f"{item_id}.json")),
        audio_url=f"/api/v1/library/{item_id}/audio",
        modelo_origen=str(raw.get("modelo_origen", "desconocido")),
        motor=str(raw.get("motor", "desconocido")),
        voz_id=str(raw.get("voz_id", "default")),
        parametros=dict(raw.get("parametros") or {}),
        prompt_original=str(raw.get("prompt_original", "")),
        metricas=dict(raw.get("metricas") or {}),
        contexto=dict(raw.get("contexto") or {}),
    )


def create_api_router(
    engine_orch: EngineOrchestrator | None = None,
    biblioteca_dir: Path | None = None,
) -> APIRouter:
    """Construye el enrutador API v1 inyectable para produccion y pruebas de integracion."""
    orch = engine_orch if engine_orch is not None else default_orchestrator
    target_bib = biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR

    router = APIRouter(prefix="/api/v1", tags=["VozStudio Omni-ES v1"])

    @router.get("/system/status", response_model=SystemStatusResponse)
    async def get_system_status() -> SystemStatusResponse:
        mem_state = memory_manager.get_status()
        hw = get_hardware_telemetry()
        return SystemStatusResponse(
            app=APP_NAME,
            version=APP_VERSION,
            active_engine=mem_state.get("active_engine_id"),
            active_provider=mem_state.get("active_provider"),
            estimated_engine_mb=float(mem_state.get("estimated_mb") or 0.0),
            hardware=HardwareMetricsResponse(
                ram_total_gb=float(hw["ram_total_gb"]),
                ram_used_gb=float(hw["ram_used_gb"]),
                ram_available_gb=float(hw["ram_available_gb"]),
                process_rss_mb=float(hw["process_rss_mb"]),
                vram_limit_gb=float(hw["vram_limit_gb"]),
                cpu_threads=int(hw["cpu_threads"]),
                dml_available=bool(hw["dml_available"]),
                available_providers=list(hw["available_providers"]),
            ),
        )

    @router.get("/engines", response_model=dict[str, list[EngineInfoResponse]])
    async def get_engines() -> dict[str, list[EngineInfoResponse]]:
        catalog = orch.list_engines()
        return {"engines": [EngineInfoResponse(**entry) for entry in catalog]}

    @router.post("/engines/unload", response_model=dict[str, bool])
    async def unload_active_engine() -> dict[str, bool]:
        unloaded = await run_in_threadpool(orch.unload_active_engine)
        return {"unloaded": bool(unloaded)}

    @router.get("/voices", response_model=dict[str, list[VoiceInfoResponse]])
    async def get_voices(
        engine_id: str | None = Query(default=None, max_length=32),
    ) -> dict[str, list[VoiceInfoResponse]]:
        try:
            descriptors = orch.list_voices(engine_id=engine_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return {
            "voices": [
                VoiceInfoResponse(
                    id=v.id,
                    name=v.name,
                    engine=v.engine,
                    region=v.region,
                    gender=v.gender,
                    sample_rate=v.sample_rate,
                    quality=v.quality,
                    description=v.description,
                    supports_cloning=v.supports_cloning,
                    supports_emotion=v.supports_emotion,
                )
                for v in descriptors
            ]
        }

    @router.post("/normalize-preview", response_model=NormalizePreviewResponse)
    async def preview_normalized_segments(
        payload: NormalizePreviewRequest,
    ) -> NormalizePreviewResponse:
        if not payload.text.strip():
            return NormalizePreviewResponse(segments=[], total_chars=0, segments_count=0)
        segments = prepare_spanish_chunks(payload.text, max_chars=payload.max_chars)
        return NormalizePreviewResponse(
            segments=segments,
            total_chars=len(payload.text),
            segments_count=len(segments),
        )

    @router.post("/synthesize", response_model=SynthesisEnvelopeResponse)
    async def synthesize_speech(payload: SynthesizeRequest) -> SynthesisEnvelopeResponse:
        params = SynthesisParams(
            speed=payload.speed,
            pitch_semitones=payload.pitch_semitones,
            emotion=payload.emotion,
            max_chunk_chars=payload.max_chunk_chars,
        )
        try:
            raw_meta = await run_in_threadpool(
                lambda: orch.synthesize(
                    text=payload.text,
                    engine_id=payload.engine_id,
                    voice_id=payload.voice_id,
                    params=params,
                    save_to_library=True,
                    biblioteca_dir=target_bib,
                )
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Fallo interno controlado en /synthesize")
            raise HTTPException(
                status_code=500,
                detail=f"Error de sintesis neural: {type(exc).__name__}",
            ) from exc

        return SynthesisEnvelopeResponse(item=_format_library_item(raw_meta))

    @router.post("/clone", response_model=SynthesisEnvelopeResponse)
    async def clone_speech(
        text: str = Form(..., min_length=1, max_length=8000),
        engine_id: str = Form(default="cosyvoice"),
        voice_id: str | None = Form(default=None),
        reference_text: str | None = Form(default=None, max_length=1200),
        speed: float = Form(default=1.0, ge=0.5, le=2.0),
        pitch_semitones: float = Form(default=0.0, ge=-6.0, le=6.0),
        emotion: str | None = Form(default=None, max_length=40),
        reference_audio: UploadFile | None = File(default=None),
    ) -> SynthesisEnvelopeResponse:
        tmp_wav_path: Path | None = None
        try:
            if reference_audio is not None and reference_audio.filename:
                content = await reference_audio.read(MAX_REFERENCE_WAV_BYTES + 1)
                if len(content) > MAX_REFERENCE_WAV_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="El archivo de audio de referencia excede el limite de 15 MB.",
                    )
                if len(content) < 64:
                    raise HTTPException(
                        status_code=400,
                        detail="El archivo de audio de referencia esta vacio o truncado.",
                    )

                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(content)
                    tmp_wav_path = Path(tmp.name)

                try:
                    info = sf.info(str(tmp_wav_path))
                    if info.duration < 0.8 or info.duration > 35.0:
                        raise ValueError(
                            "La muestra de referencia debe durar entre 1 y 30 segundos."
                        )
                except ValueError as exc:
                    raise HTTPException(status_code=400, detail=str(exc)) from exc
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail="Formato de audio de referencia no valido; sube un WAV o FLAC limpio.",
                    ) from exc

            params = SynthesisParams(
                speed=speed,
                pitch_semitones=pitch_semitones,
                emotion=emotion,
                reference_wav_path=str(tmp_wav_path) if tmp_wav_path else None,
                reference_text=reference_text.strip() if reference_text else None,
            )

            raw_meta = await run_in_threadpool(
                lambda: orch.synthesize(
                    text=text,
                    engine_id=engine_id.strip().lower(),
                    voice_id=voice_id.strip() if voice_id else None,
                    params=params,
                    save_to_library=True,
                    biblioteca_dir=target_bib,
                )
            )
            return SynthesisEnvelopeResponse(item=_format_library_item(raw_meta))
        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Fallo interno controlado en /clone")
            raise HTTPException(
                status_code=500,
                detail=f"Error en laboratorio zero-shot: {type(exc).__name__}",
            ) from exc
        finally:
            if tmp_wav_path is not None and tmp_wav_path.exists():
                try:
                    tmp_wav_path.unlink()
                except OSError:
                    pass

    @router.get("/library", response_model=dict[str, list[LibraryItemResponse]])
    async def get_library_items(
        engine_id: str | None = Query(default=None, max_length=32),
        query: str | None = Query(default=None, max_length=120),
    ) -> dict[str, list[LibraryItemResponse]]:
        entries = await run_in_threadpool(
            lambda: list_biblioteca(
                biblioteca_dir=target_bib,
                engine_filter=engine_id,
                query=query,
            )
        )
        return {"items": [_format_library_item(item) for item in entries]}

    @router.get("/library/{item_id}/audio")
    async def stream_library_audio(item_id: str) -> FileResponse:
        try:
            wav_path, _ = get_biblioteca_item(item_id, biblioteca_dir=target_bib)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return FileResponse(
            path=str(wav_path),
            media_type="audio/wav",
            filename=wav_path.name,
        )

    @router.delete("/library/{item_id}", response_model=dict[str, Any])
    async def remove_library_item(item_id: str) -> dict[str, Any]:
        try:
            deleted = await run_in_threadpool(
                lambda: delete_biblioteca_item(item_id, biblioteca_dir=target_bib)
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if not deleted:
            raise HTTPException(
                status_code=404,
                detail=f"Elemento no encontrado en biblioteca: {item_id}",
            )
        return {"deleted": True, "id": item_id}

    return router
