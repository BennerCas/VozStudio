"""Orquestador central de motores TTS con politica Zero-OOM y archivo auditado en biblioteca/."""

from __future__ import annotations

import logging
from pathlib import Path
import time
from typing import Any

from src.ai.base_engine import (
    BaseTTSEngine,
    EngineSynthesisResult,
    SynthesisParams,
    VoiceDescriptor,
)
from src.ai.cosyvoice_engine import CosyVoiceEngine
from src.ai.kokoro_engine import KokoroEngine
from src.ai.mms_engine import MMSSpanishEngine
from src.ai.optional_engines import (
    CoquiXTTS2Engine,
    F5SpanishEngine,
    StyleTTS2SpanishEngine,
)
from src.ai.piper_engine import PiperEngine
from src.ai.qwen3_engine import Qwen3TTSEngine
from src.core.audio_dsp import (
    apply_pitch_shift,
    concat_audio_chunks,
    remove_dc_and_normalize,
    save_generation_to_biblioteca,
)
from src.core.config import APP_NAME, APP_VERSION, BIBLIOTECA_DIR, CPU_THREADS, DEFAULT_USER
from src.core.custom_voice_store import CustomVoiceStore
from src.core.hardware import get_hardware_telemetry
from src.core.memory_manager import MemoryManager, memory_manager as default_memory_manager
from src.core.text_normalizer import prepare_spanish_chunks

logger = logging.getLogger(__name__)


class EngineOrchestrator:
    """Registro y coordinador de los 8 motores neurales TTS de VozStudio Omni-ES."""

    def __init__(
        self,
        *,
        mem_manager: MemoryManager | None = None,
        biblioteca_dir: Path | None = None,
        models_link_dir: Path | None = None,
    ) -> None:
        self._memory_manager = mem_manager if mem_manager is not None else default_memory_manager
        self._biblioteca_dir = biblioteca_dir
        self._custom_voice_store = CustomVoiceStore(biblioteca_dir=self._biblioteca_dir)
        self._engines: dict[str, BaseTTSEngine] = {}
        self._register_default_engines(models_link_dir=models_link_dir)

    def _register_default_engines(self, models_link_dir: Path | None = None) -> None:
        """Instancia los 6 adaptadores de motor de forma perezosa (sin cargar pesos en RAM)."""
        kwargs: dict[str, Any] = {}
        if models_link_dir is not None:
            kwargs["models_link_dir"] = models_link_dir

        adapters: tuple[BaseTTSEngine, ...] = (
            KokoroEngine(**kwargs),
            PiperEngine(**kwargs),
            MMSSpanishEngine(**kwargs),
            StyleTTS2SpanishEngine(**kwargs),
            F5SpanishEngine(**kwargs),
            CosyVoiceEngine(**kwargs),
            CoquiXTTS2Engine(**kwargs),
            Qwen3TTSEngine(**kwargs),
        )
        for adapter in adapters:
            self._engines[adapter.engine_id] = adapter

    def register_engine(self, engine: BaseTTSEngine) -> None:
        """Registra o reemplaza un adaptador TTS (util para extensibilidad y pruebas)."""
        self._engines[engine.engine_id] = engine

    def get_engine(self, engine_id: str) -> BaseTTSEngine:
        """Obtiene la instancia del motor o lanza ValueError si no existe."""
        clean_id = (engine_id or "").strip().lower()
        engine = self._engines.get(clean_id)
        if engine is None:
            raise ValueError(
                f"Motor TTS desconocido: '{engine_id}'. "
                f"Motores registrados: {list(self._engines.keys())}"
            )
        return engine

    def list_engines(self) -> list[dict[str, Any]]:
        """Retorna el estado operativo e inventario de los 6 motores registrados."""
        active_id = self._memory_manager.active_engine_id
        catalog: list[dict[str, Any]] = []
        for engine in self._engines.values():
            voices = engine.get_voices()
            catalog.append(
                {
                    "id": engine.engine_id,
                    "name": engine.display_name,
                    "category": engine.category,
                    "available": bool(engine.is_available()),
                    "active": active_id == engine.engine_id,
                    "license": engine.license_name,
                    "estimated_mb": float(engine.estimated_mb),
                    "availability_note": engine.availability_note(),
                    "voices_count": len(voices),
                    "description": engine.description,
                }
            )
        return catalog

    def list_voices(self, engine_id: str | None = None) -> list[VoiceDescriptor]:
        """Lista los perfiles de voz nativos y personalizados de un motor especifico o de todos."""
        built_in: list[VoiceDescriptor] = []
        if engine_id is not None and engine_id.strip():
            built_in = list(self.get_engine(engine_id).get_voices())
        else:
            for engine in self._engines.values():
                built_in.extend(engine.get_voices())

        custom_voices = self._custom_voice_store.list_custom_voices(engine_id)
        return built_in + custom_voices

    def register_custom_voice(
        self,
        engine_id: str,
        name: str,
        samples: np.ndarray,
        sample_rate: int,
        reference_text: str | None = None,
        region: str = "ES",
        gender: str = "MIX",
        description: str = "",
    ) -> VoiceDescriptor:
        """Registra un nuevo timbre personalizado en el motor indicado."""
        return self._custom_voice_store.add_custom_voice(
            engine_id=engine_id,
            name=name,
            samples=samples,
            sample_rate=sample_rate,
            reference_text=reference_text,
            region=region,
            gender=gender,
            description=description,
        )

    def delete_custom_voice(self, voice_id: str) -> bool:
        """Elimina un timbre personalizado registrado."""
        return self._custom_voice_store.delete_custom_voice(voice_id)

    def unload_active_engine(self) -> bool:
        """Descarga el motor actualmente residente en VRAM/RAM."""
        return self._memory_manager.unload_current()

    def synthesize_audio(
        self,
        text: str,
        engine_id: str = "kokoro",
        voice_id: str | None = None,
        params: SynthesisParams | None = None,
    ) -> tuple[EngineSynthesisResult, str]:
        """Ejecuta el pipeline completo de normalizacion, inferencia protegida y DSP."""
        if not text or not text.strip():
            raise ValueError("El texto a sintetizar no puede estar vacio.")

        syn_params = params if params is not None else SynthesisParams()
        engine = self.get_engine(engine_id)

        if not engine.is_available():
            raise RuntimeError(
                f"El motor '{engine.engine_id}' no esta disponible localmente. "
                f"{engine.availability_note()}"
            )

        voices = engine.get_voices()
        resolved_voice_id = (voice_id or "").strip() or (voices[0].id if voices else "default")

        # Inyectar semilla acustica si la voz seleccionada corresponde a un timbre personalizado
        custom_rec = self._custom_voice_store.get_custom_voice_record(resolved_voice_id)
        if custom_rec:
            if not syn_params.reference_wav_path and custom_rec.get("reference_wav_path"):
                syn_params.reference_wav_path = custom_rec["reference_wav_path"]
            if not syn_params.reference_text and custom_rec.get("reference_text"):
                syn_params.reference_text = custom_rec["reference_text"]
            if not any(v.id == resolved_voice_id for v in voices):
                resolved_voice_id = voices[0].id if voices else "default"

        chunks = prepare_spanish_chunks(text, max_chars=max(40, int(syn_params.max_chunk_chars)))
        if not chunks:
            raise ValueError("El texto proporcionado no contiene contenido fonetizable en espanol.")

        with self._memory_manager.inference_lock:
            active_provider = self._memory_manager.activate_engine(
                engine_id=engine.engine_id,
                loader_fn=engine.load,
                unloader_fn=engine.unload,
                estimated_mb=engine.estimated_mb,
            )

            t_start = time.perf_counter()
            raw_arrays, sample_rate, model_origin, reported_provider = engine.synthesize_raw(
                chunks=chunks,
                voice_id=resolved_voice_id,
                params=syn_params,
            )
            merged = concat_audio_chunks(raw_arrays, sample_rate=sample_rate)
            if abs(float(syn_params.pitch_semitones)) >= 0.05:
                merged = apply_pitch_shift(
                    merged,
                    sample_rate=sample_rate,
                    semitones=float(syn_params.pitch_semitones),
                )
            processed = remove_dc_and_normalize(merged, target_peak=0.92)
            inference_ms = max(0.01, (time.perf_counter() - t_start) * 1000.0)

        final_provider = reported_provider or active_provider or "CPUExecutionProvider"
        result = EngineSynthesisResult(
            samples=processed,
            sample_rate=sample_rate,
            model_origin=model_origin,
            backend_provider=final_provider,
            chunks_count=len(chunks),
            inference_ms=round(inference_ms, 2),
        )
        return result, resolved_voice_id

    def synthesize(
        self,
        text: str,
        engine_id: str = "kokoro",
        voice_id: str | None = None,
        params: SynthesisParams | None = None,
        save_to_library: bool = True,
        *,
        biblioteca_dir: Path | None = None,
    ) -> dict[str, Any]:
        """Sintetiza texto en espanol y archiva el WAV + JSON gemelo en biblioteca/."""
        syn_params = params if params is not None else SynthesisParams()
        engine = self.get_engine(engine_id)
        syn_result, resolved_voice_id = self.synthesize_audio(
            text=text,
            engine_id=engine.engine_id,
            voice_id=voice_id,
            params=syn_params,
        )

        telemetry = get_hardware_telemetry()
        peak_rss_mb = float(telemetry.get("process_rss_mb", 0.0))

        params_dict: dict[str, Any] = {
            "speed": float(syn_params.speed),
            "pitch_semitones": float(syn_params.pitch_semitones),
            "emotion_prompt": syn_params.emotion,
            "reference_audio": (
                Path(syn_params.reference_wav_path).name
                if syn_params.reference_wav_path
                else None
            ),
            "max_chunk_chars": int(syn_params.max_chunk_chars),
        }

        target_bib_dir = (
            biblioteca_dir
            if biblioteca_dir is not None
            else (self._biblioteca_dir if self._biblioteca_dir is not None else BIBLIOTECA_DIR)
        )

        if save_to_library:
            metadata = save_generation_to_biblioteca(
                samples=syn_result.samples,
                sample_rate=syn_result.sample_rate,
                engine_id=engine.engine_id,
                model_origin=syn_result.model_origin,
                voice_id=resolved_voice_id,
                prompt_text=text,
                inference_ms=syn_result.inference_ms,
                chunks_count=syn_result.chunks_count,
                params=params_dict,
                backend_provider=syn_result.backend_provider,
                peak_memory_mb=peak_rss_mb,
                biblioteca_dir=target_bib_dir,
            )
            resolved_dir = Path(target_bib_dir).resolve()
            enriched = dict(metadata)
            enriched["wav_path"] = str(resolved_dir / metadata["archivo"])
            enriched["json_path"] = str(resolved_dir / metadata["json_archivo"])
            return enriched

        duration_sec = round(
            float(syn_result.samples.shape[0]) / float(max(1, syn_result.sample_rate)),
            4,
        )
        rtf = (
            round((syn_result.inference_ms / 1000.0) / duration_sec, 4)
            if duration_sec > 0.0
            else 0.0
        )
        return {
            "id": "",
            "archivo": "",
            "json_archivo": "",
            "audio_url": "",
            "wav_path": None,
            "json_path": None,
            "samples": syn_result.samples,
            "sample_rate": syn_result.sample_rate,
            "modelo_origen": syn_result.model_origin,
            "motor": engine.engine_id,
            "voz_id": resolved_voice_id,
            "parametros": params_dict,
            "prompt_original": text,
            "metricas": {
                "caracteres_entrada": len(text),
                "fragmentos": syn_result.chunks_count,
                "duracion_audio_seg": duration_sec,
                "tiempo_inferencia_ms": syn_result.inference_ms,
                "rtf": rtf,
                "pico_memoria_mb": round(peak_rss_mb, 2),
            },
            "contexto": {
                "app": APP_NAME,
                "version": APP_VERSION,
                "backend": syn_result.backend_provider,
                "usuario": DEFAULT_USER,
                "cpu_threads": int(CPU_THREADS),
            },
        }


orchestrator = EngineOrchestrator()

__all__ = [
    "EngineOrchestrator",
    "orchestrator",
]
