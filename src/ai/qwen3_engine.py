"""Adaptador modular para Qwen3-TTS 12Hz en espanol (Alibaba Cloud / Qwen Audio)."""

from __future__ import annotations

import gc
import json
import logging
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

import numpy as np
import soundfile as sf

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import BRAINS_SPACE_DIR, MODELS_LINK_DIR, PROJECT_ROOT

logger = logging.getLogger(__name__)


class Qwen3TTSEngine(BaseTTSEngine):
    """Adaptador nativo aislado para Qwen3-TTS 12Hz (Apache-2.0)."""

    engine_id = "qwen3_tts"
    display_name = "Qwen3-TTS 12Hz Espanol (Alibaba)"
    category = "clone"
    estimated_mb = 1830.0
    license_name = "Apache-2.0"
    description = (
        "Modelo de lenguaje de audio a 12 Hz con 24 kHz. Usa el runtime oficial aislado "
        "de Qwen para VoiceDesign y clonacion zero-shot en espanol."
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
        self._runtime_process: subprocess.Popen[bytes] | None = None
        self._runtime_port: int | None = None

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

    def _resolve_voice_design_dir(self) -> Path | None:
        candidates = (
            Path(r"D:\ai-models\qwen tts\Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
            self._brains_dir / "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
            self._models_link_dir / "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        )
        return next((path for path in candidates if path.is_dir() and any(path.glob("*.safetensors"))), None)

    def _resolve_base_dir(self) -> Path | None:
        candidates = (
            self._brains_dir / "Qwen3-TTS-12Hz-0.6B-Base",
            self._models_link_dir / "Qwen3-TTS-12Hz-0.6B-Base",
        )
        return next((path for path in candidates if path.is_dir() and any(path.glob("*.safetensors"))), None)

    @staticmethod
    def _runtime_python() -> Path | None:
        configured = os.environ.get("VOZSTUDIO_QWEN_RUNTIME_PYTHON", "").strip()
        candidates = (
            Path(configured) if configured else None,
            PROJECT_ROOT / ".runtimes" / "qwen3-tts" / "python.exe",
        )
        return next((path for path in candidates if path is not None and path.is_file()), None)

    def is_available(self) -> bool:
        """Expone Qwen solo cuando pesos y runtime oficial aislado son utilizables."""
        return self._resolve_voice_design_dir() is not None and self._runtime_python() is not None

    def availability_note(self) -> str:
        """Informa estado de disponibilidad local de Qwen3-TTS."""
        model_dir = self._resolve_voice_design_dir()
        runtime_python = self._runtime_python()
        if model_dir is not None and runtime_python is not None:
            return "VoiceDesign 1.7B y runtime oficial Qwen3-TTS instalados localmente."
        if model_dir is not None:
            return "Pesos Qwen detectados, pero falta el runtime .runtimes/qwen3-tts/python.exe."
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
        """Inicia el servidor residente del runtime oficial Qwen3-TTS."""
        if self._model is not None and self._provider is not None:
            return self._provider

        model_dir = self._resolve_voice_design_dir()
        runtime_python = self._runtime_python()
        if model_dir is None or runtime_python is None:
            raise FileNotFoundError(self.availability_note())

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", 0))
            port = int(probe.getsockname()[1])
        worker_path = Path(__file__).with_name("qwen3_runtime_server.py")
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        self._runtime_process = subprocess.Popen(
            [str(runtime_python), str(worker_path), "--port", str(port)],
            cwd=str(PROJECT_ROOT),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
        )
        self._runtime_port = port
        # Importar PyTorch y qwen_tts en el entorno aislado tarda varias decenas
        # de segundos en Windows; no debe confundirse con un fallo de inicio.
        deadline = time.monotonic() + 75.0
        while time.monotonic() < deadline:
            try:
                with urlopen(f"http://127.0.0.1:{port}/health", timeout=1.0) as response:
                    if response.status == 200:
                        self._model = ("native_runtime", model_dir)
                        self._provider = "CPUExecutionProvider (Qwen3-TTS native Python 3.12)"
                        return self._provider
            except URLError:
                time.sleep(0.15)
        self.unload()
        raise RuntimeError("El runtime oficial Qwen3-TTS no inició correctamente.")

    def unload(self) -> None:
        """Libera Qwen3-TTS de memoria."""
        if self._runtime_port is not None:
            try:
                request = Request(
                    f"http://127.0.0.1:{self._runtime_port}/shutdown",
                    data=b"{}",
                    method="POST",
                    headers={"Content-Type": "application/json"},
                )
                with urlopen(request, timeout=2.0):
                    pass
            except (URLError, TimeoutError):
                pass
        if self._runtime_process is not None:
            try:
                self._runtime_process.wait(timeout=3.0)
            except subprocess.TimeoutExpired:
                self._runtime_process.terminate()
        self._runtime_process = None
        self._runtime_port = None
        self._model = None
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

        if self._runtime_port is None:
            raise RuntimeError("El runtime Qwen no está activo.")

        mode = "voice_clone" if selected_id == "qwen3_es_custom_clone" else "voice_design"
        model_dir = self._resolve_base_dir() if mode == "voice_clone" else self._resolve_voice_design_dir()
        if model_dir is None:
            raise FileNotFoundError("No se encontraron los pesos locales requeridos por Qwen3-TTS.")

        default_designs = {
            "qwen3_es_clara": "Mujer adulta latinoamericana, tono cálido, natural, cercano y sin eco.",
            "qwen3_es_mateo": "Hombre adulto latinoamericano, tono documental, natural, claro y sin eco.",
            "qwen3_voice_design": "Voz latinoamericana natural, humana, cercana y sin reverberación.",
        }
        instruction = (
            params.voice_design_prompt
            or params.instruct_prompt
            or default_designs.get(selected_id, default_designs["qwen3_voice_design"])
        ).strip()
        with tempfile.NamedTemporaryFile(prefix="vozstudio_qwen_", suffix=".wav", delete=False) as tmp:
            output_path = Path(tmp.name)
        payload = {
            "mode": mode,
            "model_dir": str(model_dir),
            "output_path": str(output_path),
            "chunks": chunks,
            "instruct": instruction,
            "temperature": float(params.temperature),
            "reference_wav_path": params.reference_wav_path,
            "reference_text": params.reference_text,
        }
        try:
            request = Request(
                f"http://127.0.0.1:{self._runtime_port}/synthesize",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                method="POST",
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
            with urlopen(request, timeout=1500.0) as response:
                answer = json.loads(response.read().decode("utf-8"))
            if not bool(answer.get("ok")):
                raise RuntimeError(str(answer.get("error", "Qwen3-TTS no produjo audio.")))
            audio, sample_rate = sf.read(str(output_path), dtype="float32", always_2d=False)
            arr = np.asarray(audio, dtype=np.float32).reshape(-1)
            if arr.size == 0:
                raise ValueError("Qwen3-TTS no produjo muestras de audio.")
        except URLError as exc:
            raise RuntimeError(f"Runtime Qwen3-TTS no disponible: {exc}") from exc
        finally:
            output_path.unlink(missing_ok=True)

        model_tag = "Qwen/Qwen3-TTS-12Hz-0.6B-Base" if mode == "voice_clone" else "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
        return [np.clip(arr, -1.0, 1.0)], int(sample_rate), f"{model_tag} ({selected_id})", self._provider or "CPUExecutionProvider"
