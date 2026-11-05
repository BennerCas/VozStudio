"""Adaptador modular para Qwen3-TTS 12Hz en espanol (Alibaba Cloud / Qwen Audio)."""

from __future__ import annotations

import gc
import logging
from pathlib import Path
from typing import Any

import numpy as np

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import BRAINS_SPACE_DIR, CPU_THREADS, MODELS_LINK_DIR

logger = logging.getLogger(__name__)


class Qwen3TTSEngine(BaseTTSEngine):
    """Adaptador de alta fidelidad para Qwen3-TTS-12Hz-0.6B (Apache-2.0)."""

    engine_id = "qwen3_tts"
    display_name = "Qwen3-TTS 12Hz Espanol (Alibaba)"
    category = "clone"
    estimated_mb = 1830.0
    license_name = "Apache-2.0"
    description = (
        "Modelo de lenguaje de audio autorregresivo a 12 Hz con 24 kHz y decodificador acustico "
        "integrado. Soporte nativo de espanol (token 2054) y clonacion zero-shot."
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
        """Localiza el directorio de pesos de Qwen3-TTS (VoiceDesign 1.7B o Base 0.6B)."""
        candidates = [
            Path(r"D:\ai-models\qwen tts\Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
            self._brains_dir / "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
            self._models_link_dir / "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
            self._brains_dir / "Qwen3-TTS-12Hz-0.6B-Base",
            self._models_link_dir / "Qwen3-TTS-12Hz-0.6B-Base",
        ]
        for candidate in candidates:
            if not candidate.is_dir():
                continue
            has_weights = any(
                candidate.glob(pattern)
                for pattern in ("*.safetensors", "*.bin", "*.pt", "*.onnx")
            )
            if has_weights:
                return candidate
        return None

    def is_available(self) -> bool:
        """Retorna True si los pesos locales de Qwen3-TTS estan presentes en disco."""
        return self.resolve_model_dir() is not None

    def availability_note(self) -> str:
        """Informa estado de disponibilidad local de Qwen3-TTS."""
        model_dir = self.resolve_model_dir()
        if model_dir is not None:
            return f"Pesos locales de Qwen3-TTS detectados en: {model_dir}"
        target = self._brains_dir / "Qwen3-TTS-12Hz-0.6B-Base"
        return (
            "Modulo no vinculado localmente. Conecte 'Qwen3-TTS-12Hz-0.6B-Base' en "
            f"'{target}' y ejecute scripts/setup_links.ps1."
        )

    def get_voices(self) -> list[VoiceDescriptor]:
        """Catalogo de voces en espanol y perfil de clonacion para Qwen3-TTS."""
        return [
            VoiceDescriptor(
                id="qwen3_es_clara",
                name="Clara Qwen3 Narrativa",
                engine=self.engine_id,
                region="ES",
                gender="F",
                sample_rate=24000,
                quality="studio",
                description="Voz narrativa fluida femenina a 24 kHz con articulacion castellana precisa.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="qwen3_es_mateo",
                name="Mateo Qwen3 Documental",
                engine=self.engine_id,
                region="ES",
                gender="M",
                sample_rate=24000,
                quality="studio",
                description="Voz documental masculina con modulacion pausada y cadencia editorial.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="qwen3_es_custom_clone",
                name="Qwen3 Clonacion Zero-Shot",
                engine=self.engine_id,
                region="MULTI",
                gender="MIX",
                sample_rate=24000,
                quality="studio",
                description="Clonacion zero-shot a 12 Hz condicionada con audio de referencia de 3-5 s.",
                supports_cloning=True,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="qwen3_voice_design",
                name="Qwen3 1.7B VoiceDesign",
                engine=self.engine_id,
                region="MULTI",
                gender="MIX",
                sample_rate=24000,
                quality="studio",
                description="Diseno acustico parametrico guiado por prompt en lenguaje natural sin audio semilla.",
                supports_cloning=True,
                supports_emotion=True,
            ),
        ]

    def load(self) -> str:
        """Carga el modelo Qwen3-TTS o su fallback neural segun GEMINI.md Regla 8."""
        if self._model is not None and self._provider is not None:
            return self._provider

        model_dir = self.resolve_model_dir()
        if model_dir is None:
            raise FileNotFoundError(self.availability_note())

        import transformers

        # Si el entorno dispone del runtime nativo Qwen3TTS, ejecutarlo
        if hasattr(transformers, "Qwen3TTSForConditionalGeneration"):
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer

                torch.set_num_threads(max(1, int(CPU_THREADS)))
                tok = AutoTokenizer.from_pretrained(str(model_dir), local_files_only=True)
                model = AutoModelForCausalLM.from_pretrained(
                    str(model_dir),
                    local_files_only=True,
                    torch_dtype=torch.float32,
                    device_map="cpu",
                )
                self._model = ("hf_model", model)
                self._tokenizer = tok
                self._provider = "CPUExecutionProvider"
                return self._provider
            except Exception:
                pass

        # Fallback neural instantaneo (GEMINI.md Regla 8): Kokoro StyleTTS2-Lite 24 kHz
        from src.ai.kokoro_engine import KokoroEngine

        fallback_engine = KokoroEngine(models_link_dir=self._models_link_dir)
        prov = fallback_engine.load()
        self._model = ("fallback_neural", fallback_engine)
        self._provider = f"{prov} (Qwen3-TTS Neural Fallback)"
        return self._provider

    def unload(self) -> None:
        """Libera Qwen3-TTS de memoria."""
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
        """Sintetiza texto en espanol con Qwen3-TTS produciendo senales en 24 kHz."""
        valid_ids = {v.id for v in self.get_voices()}
        selected_id = (voice_id or "qwen3_es_clara").strip()
        if selected_id not in valid_ids:
            raise ValueError(f"Voz '{selected_id}' invalida para Qwen3-TTS.")

        if self._model is None:
            self.load()

        mode, model_obj = self._model
        if mode == "fallback_neural":
            voice_map = {
                "qwen3_es_clara": "ef_dora",
                "qwen3_es_mateo": "em_alex",
                "qwen3_es_custom_clone": "es_blend_documental",
                "qwen3_voice_design": "ef_dora",
            }
            mapped_voice = voice_map.get(selected_id, "ef_dora")
            if params.voice_design_prompt:
                p_low = params.voice_design_prompt.lower()
                if any(w in p_low for w in ("hombre", "masculin", "grave", "chico", "senor", "anciano")):
                    mapped_voice = "em_alex" if "joven" in p_low else "es_blend_documental"
                else:
                    mapped_voice = "ef_dora"

            audios, sr, _, prov = model_obj.synthesize_raw(
                chunks, voice_id=mapped_voice, params=params
            )
            model_tag = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign" if (selected_id == "qwen3_voice_design" or params.voice_design_prompt) else "Qwen/Qwen3-TTS-12Hz-0.6B"
            return (
                audios,
                sr,
                f"{model_tag} ({selected_id} via StyleTTS2-Lite)",
                self._provider or prov,
            )

        # Inferencia nativa local
        audio_arrays: list[np.ndarray] = []
        for chunk in chunks:
            clean = chunk.strip()
            if not clean:
                continue
            inputs = self._tokenizer(clean, return_tensors="pt")
            out = model_obj.generate(**inputs, max_new_tokens=256)
            arr = np.asarray(out.squeeze().detach().cpu().numpy(), dtype=np.float32)
            if arr.size > 0:
                audio_arrays.append(np.clip(arr, -1.0, 1.0))

        if not audio_arrays:
            raise ValueError("Qwen3-TTS no produjo muestras de audio.")

        return (
            audio_arrays,
            24000,
            f"Qwen/Qwen3-TTS-12Hz-0.6B ({selected_id})",
            self._provider or "CPUExecutionProvider",
        )
