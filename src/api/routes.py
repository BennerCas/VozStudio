"""Rutas REST API v1 de VozStudio Omni-ES con validacion OWASP y trazabilidad de biblioteca."""

from __future__ import annotations

from datetime import datetime
import logging
import os
from pathlib import Path
import re
import tempfile
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
import soundfile as sf
from starlette.concurrency import run_in_threadpool

from src.ai.base_engine import SynthesisParams
from src.ai.engine_factory import EngineOrchestrator, orchestrator as default_orchestrator
from src.core.audio_dsp import (
    clean_vocal_audio,
    delete_biblioteca_item,
    get_biblioteca_item,
    list_biblioteca,
)
from src.core.config import APP_NAME, APP_VERSION, BIBLIOTECA_DIR
from src.core.hardware import get_hardware_telemetry
from src.core.memory_manager import memory_manager
from src.core.prompt_enhancer import enhance_prompt
from src.core.text_normalizer import prepare_spanish_chunks
from src.models.schemas import (
    EngineInfoResponse,
    EnhancePromptRequest,
    EnhancePromptResponse,
    HardwareMetricsResponse,
    LibraryItemResponse,
    NormalizePreviewRequest,
    NormalizePreviewResponse,
    SynthesisEnvelopeResponse,
    SynthesizeRequest,
    SystemStatusResponse,
    UpdateVoiceMetadataRequest,
    VoiceInfoResponse,
    VocalCleanMetricsResponse,
    VocalCleanResponse,
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
                    is_custom=v.id.startswith("custom_"),
                    prompt_utilizado=getattr(v, "prompt_utilizado", ""),
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

    @router.post("/dsp/clean-voice", response_model=VocalCleanResponse)
    async def clean_vocal_audio_endpoint(
        audio_file: UploadFile = File(...),
        remove_noise: bool = Form(default=True),
        anti_nasal: bool = Form(default=True),
        de_esser: bool = Form(default=True),
        enhance_presence: bool = Form(default=True),
        target_peak: float = Form(default=0.89),
    ) -> VocalCleanResponse:
        content = await audio_file.read(MAX_REFERENCE_WAV_BYTES + 1)
        if len(content) > MAX_REFERENCE_WAV_BYTES:
            raise HTTPException(
                status_code=413,
                detail="El archivo de audio excede el limite de 15 MB.",
            )
        if len(content) < 64:
            raise HTTPException(
                status_code=400,
                detail="El archivo de audio esta vacio o truncado.",
            )

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_in:
            tmp_in.write(content)
            tmp_in_path = Path(tmp_in.name)

        try:
            samples, sr = sf.read(str(tmp_in_path), dtype="float32")
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Formato de audio no valido: {exc}",
            ) from exc
        finally:
            try:
                tmp_in_path.unlink()
            except OSError:
                pass

        cleaned, metrics = clean_vocal_audio(
            samples,
            sr,
            remove_noise=remove_noise,
            anti_nasal=anti_nasal,
            de_esser=de_esser,
            enhance_presence=enhance_presence,
            target_peak=target_peak,
        )

        clean_cache_dir = target_bib / ".dsp_cache"
        clean_cache_dir.mkdir(parents=True, exist_ok=True)
        filename = f"clean_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(3).hex()}.wav"
        out_path = clean_cache_dir / filename
        sf.write(str(out_path), cleaned, sr, subtype="PCM_16")

        return VocalCleanResponse(
            audio_url=f"/api/v1/dsp/cleaned-audio/{filename}",
            metrics=VocalCleanMetricsResponse(**metrics),
        )

    @router.get("/dsp/cleaned-audio/{filename}")
    async def get_cleaned_audio(filename: str) -> FileResponse:
        clean_cache_dir = target_bib / ".dsp_cache"
        if not re.match(r"^clean_[0-9]{8}_[0-9]{6}_[a-f0-9]{6}\.wav$", filename):
            raise HTTPException(status_code=400, detail="Nombre de archivo DSP invalido.")
        candidate = (clean_cache_dir / filename).resolve()
        if not candidate.is_file() or candidate.parent != clean_cache_dir.resolve():
            raise HTTPException(status_code=404, detail="Audio procesado no encontrado.")
        return FileResponse(path=str(candidate), media_type="audio/wav", filename=filename)

    @router.post("/voices/custom", response_model=VoiceInfoResponse)
    async def create_custom_voice(
        engine_id: str = Form(..., min_length=1, max_length=32),
        name: str = Form(..., min_length=1, max_length=60),
        gender: str = Form(default="MIX", max_length=20),
        region: str = Form(default="ES", max_length=20),
        description: str = Form(default="Timbre clonado personalizado", max_length=200),
        reference_text: str | None = Form(default=None, max_length=1200),
        prompt_utilizado: str | None = Form(default=None, max_length=1200),
        reference_audio: UploadFile | None = File(default=None),
        reference_audio_url: str | None = Form(default=None, max_length=256),
    ) -> VoiceInfoResponse:
        samples = None
        sr = 24000

        if reference_audio is not None and reference_audio.filename:
            content = await reference_audio.read(MAX_REFERENCE_WAV_BYTES + 1)
            if len(content) > MAX_REFERENCE_WAV_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="El archivo de audio excede el limite de 15 MB.",
                )
            if len(content) < 64:
                raise HTTPException(
                    status_code=400,
                    detail="El archivo de audio de referencia esta vacio o truncado.",
                )
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_f:
                tmp_f.write(content)
                tmp_f_path = Path(tmp_f.name)
            try:
                samples, sr = sf.read(str(tmp_f_path), dtype="float32")
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Formato de audio no valido: {exc}",
                ) from exc
            finally:
                try:
                    tmp_f_path.unlink()
                except OSError:
                    pass
        elif reference_audio_url:
            clean_cache_dir = target_bib / ".dsp_cache"
            match = re.search(r"(clean_[0-9]{8}_[0-9]{6}_[a-f0-9]{6}\.wav)", reference_audio_url)
            if not match:
                raise HTTPException(
                    status_code=400,
                    detail="URL de audio procesado no valida o formato no reconocido.",
                )
            candidate = (clean_cache_dir / match.group(1)).resolve()
            if not candidate.is_file() or candidate.parent != clean_cache_dir.resolve():
                raise HTTPException(
                    status_code=404,
                    detail="Audio de referencia cacheado no encontrado.",
                )
            try:
                samples, sr = sf.read(str(candidate), dtype="float32")
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Error al leer audio cacheado: {exc}",
                ) from exc
        else:
            raise HTTPException(
                status_code=400,
                detail="Debe proporcionar un archivo de audio o referencia valida.",
            )

        if samples is None or len(samples) < int(sr * 0.8):
            raise HTTPException(
                status_code=400,
                detail="La duracion minima para registrar un timbre es de 0.8 segundos.",
            )

        try:
            descriptor = await run_in_threadpool(
                lambda: orch.register_custom_voice(
                    engine_id=engine_id.strip().lower(),
                    name=name.strip(),
                    samples=samples,
                    sample_rate=sr,
                    reference_text=reference_text.strip() if reference_text else None,
                    region=region.strip().upper(),
                    gender=gender.strip().upper(),
                    description=description.strip(),
                    prompt_utilizado=prompt_utilizado.strip() if prompt_utilizado else None,
                )
            )
        except Exception as exc:
            logger.exception("Fallo al registrar voz personalizada")
            raise HTTPException(
                status_code=500,
                detail=f"No se pudo guardar la voz personalizada: {exc}",
            ) from exc

        return VoiceInfoResponse(
            id=descriptor.id,
            name=descriptor.name,
            engine=descriptor.engine,
            gender=descriptor.gender,
            region=descriptor.region,
            sample_rate=descriptor.sample_rate,
            quality=descriptor.quality,
            supports_cloning=descriptor.supports_cloning,
            supports_emotion=descriptor.supports_emotion,
            description=descriptor.description,
            is_custom=True,
            prompt_utilizado=getattr(descriptor, "prompt_utilizado", ""),
        )

    @router.put("/voices/custom/{voice_id}", response_model=VoiceInfoResponse)
    async def update_custom_voice_metadata_endpoint(
        voice_id: str,
        payload: UpdateVoiceMetadataRequest,
    ) -> VoiceInfoResponse:
        descriptor = await run_in_threadpool(
            lambda: orch.update_custom_voice(
                voice_id=voice_id,
                name=payload.name,
                description=payload.description,
                region=payload.region,
                gender=payload.gender,
                reference_text=payload.reference_text,
                prompt_utilizado=payload.prompt_utilizado,
            )
        )
        if descriptor is None:
            raise HTTPException(
                status_code=404,
                detail=f"Timbre personalizado no encontrado para edicion: {voice_id}",
            )

        return VoiceInfoResponse(
            id=descriptor.id,
            name=descriptor.name,
            engine=descriptor.engine,
            gender=descriptor.gender,
            region=descriptor.region,
            sample_rate=descriptor.sample_rate,
            quality=descriptor.quality,
            supports_cloning=descriptor.supports_cloning,
            supports_emotion=descriptor.supports_emotion,
            description=descriptor.description,
            is_custom=True,
            prompt_utilizado=getattr(descriptor, "prompt_utilizado", ""),
        )

    @router.delete("/voices/custom/{voice_id}", response_model=dict[str, Any])
    async def remove_custom_voice(voice_id: str) -> dict[str, Any]:
        deleted = await run_in_threadpool(lambda: orch.delete_custom_voice(voice_id))
        if not deleted:
            raise HTTPException(
                status_code=404,
                detail=f"Timbre personalizado no encontrado: {voice_id}",
            )
        return {"deleted": True, "voice_id": voice_id}

    @router.post("/dna/enhance-prompt", response_model=EnhancePromptResponse)
    async def enhance_dna_prompt_endpoint(
        payload: EnhancePromptRequest,
    ) -> EnhancePromptResponse:
        if not payload.prompt.strip():
            raise HTTPException(status_code=400, detail="El prompt no puede estar vacio.")
        enhanced, engine_used = await run_in_threadpool(
            lambda: enhance_prompt(payload.prompt, mode=payload.mode)
        )
        return EnhancePromptResponse(
            original_prompt=payload.prompt,
            enhanced_prompt=enhanced,
            engine_used=engine_used,
        )

    @router.post("/dna/synthesize", response_model=dict[str, Any])
    async def synthesize_dna_endpoint(
        text: str = Form(..., min_length=1, max_length=8000),
        engine_id: str = Form(default="qwen3_tts"),
        mode: str = Form(default="voice_design"),
        voice_design_prompt: str | None = Form(default=None, max_length=1500),
        instruct_prompt: str | None = Form(default=None, max_length=1500),
        voice_id: str | None = Form(default=None),
        speed: float = Form(default=1.0, ge=0.5, le=2.0),
        temperature: float = Form(default=0.7, ge=0.1, le=1.5),
        save_as_custom: bool = Form(default=False),
        custom_voice_name: str | None = Form(default=None, max_length=60),
        custom_voice_region: str = Form(default="ES", max_length=20),
    ) -> dict[str, Any]:
        target_engine = engine_id.strip().lower()
        active_voice = voice_id.strip() if voice_id else None

        if target_engine == "qwen3_tts" and not active_voice:
            active_voice = "qwen3_voice_design"
        elif target_engine == "cosyvoice" and not active_voice:
            active_voice = "cosy_instruct_tts"

        params = SynthesisParams(
            speed=speed,
            voice_design_prompt=voice_design_prompt.strip() if voice_design_prompt else None,
            instruct_prompt=instruct_prompt.strip() if instruct_prompt else None,
            temperature=temperature,
        )

        try:
            raw_meta = await run_in_threadpool(
                lambda: orch.synthesize(
                    text=text,
                    engine_id=target_engine,
                    voice_id=active_voice,
                    params=params,
                    save_to_library=True,
                    biblioteca_dir=target_bib,
                )
            )
        except Exception as exc:
            logger.exception("Fallo en sintesis DNA Design")
            raise HTTPException(
                status_code=500,
                detail=f"Error durante sintesis DNA: {exc}",
            ) from exc

        saved_voice_data = None
        if save_as_custom:
            effective_name = (custom_voice_name or "").strip() or f"DNA {target_engine.upper()}"
            prompt_used = voice_design_prompt if mode == "voice_design" else instruct_prompt
            samples = raw_meta.get("samples")
            sr = int(raw_meta.get("sample_rate", 24000))
            if samples is None and raw_meta.get("wav_path") and Path(raw_meta["wav_path"]).is_file():
                samples, sr = sf.read(str(raw_meta["wav_path"]), dtype="float32")

            if samples is not None and len(samples) > 0:
                try:
                    desc = await run_in_threadpool(
                        lambda: orch.register_custom_voice(
                            engine_id=target_engine,
                            name=effective_name,
                            samples=samples,
                            sample_rate=sr,
                            reference_text=text[:200],
                            region=custom_voice_region,
                            description=f"Timbre DNA creado con prompt: {(prompt_used or '')[:80]}",
                            prompt_utilizado=prompt_used,
                        )
                    )
                    saved_voice_data = VoiceInfoResponse(
                        id=desc.id,
                        name=desc.name,
                        engine=desc.engine,
                        gender=desc.gender,
                        region=desc.region,
                        sample_rate=desc.sample_rate,
                        quality=desc.quality,
                        supports_cloning=desc.supports_cloning,
                        supports_emotion=desc.supports_emotion,
                        description=desc.description,
                        is_custom=True,
                        prompt_utilizado=getattr(desc, "prompt_utilizado", ""),
                    ).model_dump()
                except Exception as exc:
                    logger.warning("No se pudo registrar automaticamente el timbre DNA: %s", exc)

        return {
            "item": _format_library_item(raw_meta),
            "saved_voice": saved_voice_data,
        }

    return router
