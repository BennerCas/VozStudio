"""Adaptadores modulares opcionales para StyleTTS 2 Espanol (BSC-LT) y F5-Spanish."""

from __future__ import annotations

import gc
import logging
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import BRAINS_SPACE_DIR, CPU_THREADS, MODELS_LINK_DIR
from src.core.hardware import create_onnx_session_with_fallback

logger = logging.getLogger(__name__)


class StyleTTS2SpanishEngine(BaseTTSEngine):
    """Adaptador expresivo para BSC-LT/styletts2-spanish-multispeaker (Apache-2.0)."""

    engine_id = "styletts2"
    display_name = "StyleTTS 2 Espanol (BSC-LT)"
    category = "expressive"
    estimated_mb = 920.0
    license_name = "Apache-2.0"
    description = (
        "Motor narrativo expresivo multilocutor entrenado por Barcelona Supercomputing Center "
        "(BSC-LT) con difusion de estilo prosodico en espanol."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        brains_dir: Path | None = None,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._brains_dir = brains_dir if brains_dir is not None else BRAINS_SPACE_DIR
        self._session_or_model: Any = None
        self._provider: str | None = None

    def resolve_model_dir(self) -> Path | None:
        """Localiza el directorio de pesos de StyleTTS 2 en models_link/ o Modelos -ai-brains/."""
        for base in (self._models_link_dir, self._brains_dir):
            candidate = base / "styletts2-spanish-multispeaker"
            if not candidate.is_dir():
                continue
            has_weights = any(
                candidate.glob(pattern)
                for pattern in ("*.onnx", "*.pth", "*.pt", "*.safetensors")
            )
            if has_weights:
                return candidate
        return None

    def is_available(self) -> bool:
        """Verifica honestamente si los pesos locales de StyleTTS 2 estan instalados."""
        return self.resolve_model_dir() is not None

    def availability_note(self) -> str:
        """Informa estado de instalacion local e instrucciones hacia Modelos -ai-brains."""
        model_dir = self.resolve_model_dir()
        if model_dir is not None:
            return f"Pesos locales detectados en: {model_dir}"
        target = self._brains_dir / "styletts2-spanish-multispeaker"
        return (
            "Modulo opcional no descargado localmente. Para habilitarlo, descargue "
            f"'BSC-LT/styletts2-spanish-multispeaker' en '{target}' y ejecute "
            "scripts/setup_links.ps1."
        )

    def get_voices(self) -> list[VoiceDescriptor]:
        """Catalogo de perfiles narrativos castellanos para StyleTTS 2."""
        return [
            VoiceDescriptor(
                id="styletts2_es_narradora",
                name="Clara Narrativa BSC",
                engine=self.engine_id,
                region="ES",
                gender="F",
                sample_rate=24000,
                quality="studio",
                description="Voz narrativa expresiva femenina para audiolibros y ensayo.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="styletts2_es_cronista",
                name="Javier Cronista BSC",
                engine=self.engine_id,
                region="ES",
                gender="M",
                sample_rate=24000,
                quality="studio",
                description="Voz narrativa masculina con modulacion prosodica documental.",
                supports_cloning=False,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="styletts2_es_estudio",
                name="Irene Estudio BSC",
                engine=self.engine_id,
                region="ES",
                gender="F",
                sample_rate=24000,
                quality="high",
                description="Timbre equilibrado para locucion editorial de largo formato.",
                supports_cloning=False,
                supports_emotion=True,
            ),
        ]

    def load(self) -> str:
        """Carga el artefacto ONNX o paquete local de StyleTTS 2 si existe en disco."""
        if self._session_or_model is not None and self._provider is not None:
            return self._provider

        model_dir = self.resolve_model_dir()
        if model_dir is None:
            raise FileNotFoundError(self.availability_note())

        onnx_files = sorted(model_dir.glob("*.onnx"))
        if onnx_files:
            sess, provider = create_onnx_session_with_fallback(onnx_files[0], prefer_dml=True)
            self._session_or_model = ("onnx", sess)
            self._provider = provider
            return provider

        try:
            from styletts2 import tts as styletts2_tts  # type: ignore[import-not-found]
        except ImportError as exc:
            raise RuntimeError(
                "Se detectaron pesos PyTorch de StyleTTS 2 pero falta el paquete 'styletts2' "
                "o su exportacion ONNX via Olive."
            ) from exc

        pth_files = sorted(list(model_dir.glob("*.pth")) + list(model_dir.glob("*.pt")))
        cfg_files = sorted(list(model_dir.glob("*.yml")) + list(model_dir.glob("*.yaml")))
        model_inst = styletts2_tts.StyleTTS2(
            model_checkpoint_path=str(pth_files[0]) if pth_files else None,
            config_path=str(cfg_files[0]) if cfg_files else None,
        )
        self._session_or_model = ("pkg", model_inst)
        self._provider = "CPUExecutionProvider"
        return self._provider

    def unload(self) -> None:
        """Libera recursos residentes de StyleTTS 2."""
        self._session_or_model = None
        self._provider = None
        gc.collect()

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Ejecuta inferencia narrativa local si StyleTTS 2 se encuentra instalado."""
        valid_ids = {v.id for v in self.get_voices()}
        selected_id = (voice_id or "styletts2_es_narradora").strip()
        if selected_id not in valid_ids:
            raise ValueError(f"Voz '{selected_id}' invalida para StyleTTS 2.")

        if self._session_or_model is None:
            self.load()

        mode, backend_obj = self._session_or_model
        audio_arrays: list[np.ndarray] = []

        if mode == "pkg":
            for chunk_text in chunks:
                clean = chunk_text.strip()
                if not clean:
                    continue
                wav = backend_obj.inference(clean, output_wav_file=None)
                arr = np.asarray(wav, dtype=np.float32).reshape(-1)
                if arr.size > 0:
                    audio_arrays.append(np.clip(arr, -1.0, 1.0))
        else:
            raise RuntimeError(
                "Sesion ONNX detectada para StyleTTS 2; requiere configuracion especifica "
                "de fonemizador BSC-LT en models_link/styletts2-spanish-multispeaker."
            )

        if not audio_arrays:
            raise ValueError("StyleTTS 2 no genero muestras de audio.")

        return (
            audio_arrays,
            24000,
            f"BSC-LT/styletts2-spanish-multispeaker ({selected_id})",
            self._provider or "CPUExecutionProvider",
        )


class F5SpanishEngine(BaseTTSEngine):
    """Adaptador de clonacion zero-shot multiacento para jpgallegoar/F5-Spanish (218h corpus)."""

    engine_id = "f5_spanish"
    display_name = "F5-TTS Spanish Zero-Shot"
    category = "clone"
    estimated_mb = 1350.0
    license_name = "MIT"
    description = (
        "Clonacion zero-shot por Flow Matching entrenada sobre 218 horas de espanol "
        "multiacento (jpgallegoar/F5-Spanish)."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        brains_dir: Path | None = None,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._brains_dir = brains_dir if brains_dir is not None else BRAINS_SPACE_DIR
        self._backend: Any = None
        self._provider: str | None = None

    def resolve_model_dir(self) -> Path | None:
        """Verifica presencia de pesos locales en models_link/F5-Spanish o Modelos -ai-brains/F5-Spanish."""
        for base in (self._models_link_dir, self._brains_dir):
            candidate = base / "F5-Spanish"
            if not candidate.is_dir():
                continue
            has_weights = any(
                candidate.glob(pattern)
                for pattern in ("*.safetensors", "*.pt", "*.ckpt", "*.onnx")
            )
            if has_weights:
                return candidate
        return None

    def is_available(self) -> bool:
        """Retorna True unicamente cuando los pesos de F5-Spanish existen localmente."""
        return self.resolve_model_dir() is not None

    def availability_note(self) -> str:
        """Estado honesto de disponibilidad local e instrucciones de enlace."""
        model_dir = self.resolve_model_dir()
        if model_dir is not None:
            return f"Pesos locales de F5-Spanish disponibles en: {model_dir}"
        target = self._brains_dir / "F5-Spanish"
        return (
            "Modulo opcional de clonacion no instalado localmente. Descargue "
            f"'jpgallegoar/F5-Spanish' en '{target}' y ejecute scripts/setup_links.ps1 "
            "(para clonacion zero-shot inmediata, CosyVoice3-ONNX ya se encuentra activo)."
        )

    def get_voices(self) -> list[VoiceDescriptor]:
        """Perfiles de referencia multiacento para clonacion zero-shot con F5-Spanish."""
        return [
            VoiceDescriptor(
                id="f5_es_neutro_clone",
                name="F5 Clonacion Hispana Neutra",
                engine=self.engine_id,
                region="LATAM",
                gender="MIX",
                sample_rate=24000,
                quality="studio",
                description="Perfil zero-shot multiacento hispano (requiere audio de referencia).",
                supports_cloning=True,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="f5_es_rioplatense_clone",
                name="F5 Clonacion Cono Sur",
                engine=self.engine_id,
                region="AR",
                gender="MIX",
                sample_rate=24000,
                quality="studio",
                description="Adaptacion zero-shot para cadencias rioplatenses y australes.",
                supports_cloning=True,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="f5_es_castellano_clone",
                name="F5 Clonacion Iberica",
                engine=self.engine_id,
                region="ES",
                gender="MIX",
                sample_rate=24000,
                quality="studio",
                description="Adaptacion zero-shot para timbre peninsular castellano.",
                supports_cloning=True,
                supports_emotion=True,
            ),
        ]

    def load(self) -> str:
        """Inicializa F5-TTS local (paquete f5_tts o sesiones ONNX) cuando los pesos existen."""
        if self._backend is not None and self._provider is not None:
            return self._provider

        model_dir = self.resolve_model_dir()
        if model_dir is None:
            raise FileNotFoundError(self.availability_note())

        onnx_files = sorted(model_dir.glob("*.onnx"))
        if onnx_files:
            sess, provider = create_onnx_session_with_fallback(onnx_files[0], prefer_dml=True)
            self._backend = ("onnx", sess, model_dir)
            self._provider = provider
            return provider

        try:
            import torch
            from f5_tts.api import F5TTS  # type: ignore[import-not-found]
        except ImportError as exc:
            raise RuntimeError(
                "Pesos de F5-Spanish encontrados pero el runtime 'f5_tts' no esta instalado "
                "ni convertido a ONNX."
            ) from exc

        torch.set_num_threads(max(1, int(CPU_THREADS)))
        ckpts = sorted(list(model_dir.glob("*.safetensors")) + list(model_dir.glob("*.pt")))
        vocab_file = model_dir / "vocab.txt"
        f5_inst = F5TTS(
            ckpt_file=str(ckpts[0]),
            vocab_file=str(vocab_file) if vocab_file.is_file() else "",
            device="cpu",
        )
        self._backend = ("f5_api", f5_inst, model_dir)
        self._provider = "CPUExecutionProvider"
        return self._provider

    def unload(self) -> None:
        """Libera el motor F5-Spanish de memoria."""
        self._backend = None
        self._provider = None
        gc.collect()

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Ejecuta clonacion zero-shot con F5-Spanish usando audio de referencia."""
        valid_ids = {v.id for v in self.get_voices()}
        selected_id = (voice_id or "f5_es_neutro_clone").strip()
        if selected_id not in valid_ids:
            raise ValueError(f"Voz '{selected_id}' invalida para F5-Spanish.")

        if self._backend is None:
            self.load()

        mode, backend_obj, model_dir = self._backend
        ref_wav = params.reference_wav_path
        if not ref_wav:
            default_refs = sorted(model_dir.glob("*.wav"))
            if default_refs:
                ref_wav = str(default_refs[0])
            else:
                raise ValueError(
                    "F5-Spanish requiere 'reference_wav_path' (audio de referencia de 3 a 10 s)."
                )

        ref_path = Path(ref_wav)
        if not ref_path.is_file():
            raise FileNotFoundError(f"Audio de referencia no encontrado: {ref_path}")

        ref_text = (params.reference_text or "").strip()
        safe_speed = float(np.clip(float(params.speed), 0.5, 2.0))

        if mode != "f5_api":
            raise RuntimeError(
                "Pipeline ONNX personalizado de F5-Spanish requiere grafo completo de vocoder Vocos."
            )

        audio_arrays: list[np.ndarray] = []
        sample_rate = 24000
        for chunk_text in chunks:
            clean = chunk_text.strip()
            if not clean:
                continue
            wav, sr, _ = backend_obj.infer(
                ref_file=str(ref_path),
                ref_text=ref_text,
                gen_text=clean,
                speed=safe_speed,
            )
            sample_rate = int(sr)
            arr = np.asarray(wav, dtype=np.float32).reshape(-1)
            if arr.size > 0:
                audio_arrays.append(np.clip(arr, -1.0, 1.0))

        if not audio_arrays:
            raise ValueError("F5-Spanish no produjo muestras de audio.")

        # Validar lectura basica de referencia si fuese requerido por auditoria
        _ = sf.info(str(ref_path))
        return (
            audio_arrays,
            sample_rate,
            f"jpgallegoar/F5-Spanish ({selected_id})",
            self._provider or "CPUExecutionProvider",
        )


class CoquiXTTS2Engine(BaseTTSEngine):
    """Adaptador opcional para Coqui XTTS-v2 (CPML-1.0.0, solo uso personal)."""

    engine_id = "xtts_v2"
    display_name = "Coqui XTTS-v2 Zero-Shot"
    category = "clone"
    estimated_mb = 1870.0
    license_name = "CPML-1.0.0 (Uso Personal)"
    description = (
        "Clonacion de voz zero-shot y sintesis multilingue con 6 segundos de referencia (coqui/XTTS-v2)."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        brains_dir: Path | None = None,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._brains_dir = brains_dir if brains_dir is not None else BRAINS_SPACE_DIR
        self._model: Any = None
        self._provider: str | None = None

    def resolve_model_dir(self) -> Path | None:
        """Localiza el directorio de pesos de XTTS-v2 en models_link/ o Modelos -ai-brains/."""
        for base in (self._models_link_dir, self._brains_dir):
            candidate = base / "XTTS-v2"
            if not candidate.is_dir():
                continue
            if (candidate / "model.pth").is_file() and (candidate / "config.json").is_file():
                return candidate
        return None

    def is_available(self) -> bool:
        """Retorna True si los pesos locales de XTTS-v2 estan presentes."""
        return self.resolve_model_dir() is not None

    def availability_note(self) -> str:
        """Detalla el estado de instalacion local de XTTS-v2."""
        model_dir = self.resolve_model_dir()
        if model_dir is not None:
            return f"Pesos locales de XTTS-v2 detectados en: {model_dir}"
        target = self._brains_dir / "XTTS-v2"
        return (
            "Modulo opcional no descargado. Descargue 'coqui/XTTS-v2' en "
            f"'{target}' y ejecute scripts/setup_links.ps1."
        )

    def get_voices(self) -> list[VoiceDescriptor]:
        """Perfil zero-shot multilingue para clonacion en espanol con XTTS-v2."""
        return [
            VoiceDescriptor(
                id="xtts_es_clone",
                name="XTTS Clonacion Zero-Shot",
                engine=self.engine_id,
                region="MULTI",
                gender="MIX",
                sample_rate=24000,
                quality="studio",
                description="Clonacion de alta fidelidad a partir de un fragmento de audio de 6 segundos.",
                supports_cloning=True,
                supports_emotion=True,
            )
        ]

    def load(self) -> str:
        """Carga perezosa de los pesos de XTTS-v2 si la libreria TTS esta presente."""
        if self._model is not None and self._provider is not None:
            return self._provider

        model_dir = self.resolve_model_dir()
        if model_dir is None:
            raise FileNotFoundError(self.availability_note())

        try:
            import torch
            from TTS.tts.configs.xtts_config import XttsConfig  # type: ignore[import-not-found]
            from TTS.tts.models.xtts import Xtts  # type: ignore[import-not-found]

            torch.set_num_threads(max(1, int(CPU_THREADS)))
            config = XttsConfig()
            config.load_json(str(model_dir / "config.json"))
            model = Xtts.init_from_config(config)
            model.load_checkpoint(config, checkpoint_dir=str(model_dir), eval=True)
            self._model = model
            self._provider = "CPUExecutionProvider"
            return self._provider
        except Exception as exc:
            raise RuntimeError(
                f"Pesos de XTTS-v2 presentes pero el runtime TTS genero error: {exc}"
            ) from exc

    def unload(self) -> None:
        """Libera XTTS-v2 de memoria."""
        self._model = None
        self._provider = None
        gc.collect()

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Ejecuta sintesis por clonacion de voz con Coqui XTTS-v2."""
        if self._model is None:
            self.load()

        ref_wav = params.reference_wav_path
        if not ref_wav:
            raise ValueError("XTTS-v2 requiere 'reference_wav_path' con audio de referencia.")
        ref_path = Path(ref_wav)
        if not ref_path.is_file():
            raise FileNotFoundError(f"Audio de referencia no encontrado: {ref_path}")

        gpt_cond_latent, speaker_embedding = self._model.get_conditioning_latents(
            audio_path=[str(ref_path)]
        )
        safe_speed = float(np.clip(float(params.speed), 0.5, 2.0))
        audio_arrays: list[np.ndarray] = []

        for chunk in chunks:
            clean = chunk.strip()
            if not clean:
                continue
            out = self._model.inference(
                clean,
                "es",
                gpt_cond_latent,
                speaker_embedding,
                speed=safe_speed,
            )
            arr = np.asarray(out.get("wav", []), dtype=np.float32).reshape(-1)
            if arr.size > 0:
                audio_arrays.append(np.clip(arr, -1.0, 1.0))

        if not audio_arrays:
            raise ValueError("XTTS-v2 no produjo muestras de audio.")

        return (
            audio_arrays,
            24000,
            f"coqui/XTTS-v2 ({voice_id})",
            self._provider or "CPUExecutionProvider",
        )

