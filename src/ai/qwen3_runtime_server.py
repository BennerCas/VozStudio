"""Servidor local residente para la inferencia oficial de Qwen3-TTS.

Se ejecuta con el entorno aislado ``.runtimes/qwen3-tts`` para no mezclar sus
dependencias con el backend principal de VozStudio. Solo escucha en loopback y
acepta solicitudes del adaptador ``Qwen3TTSEngine``.
"""

from __future__ import annotations

import argparse
import gc
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import which
from threading import Thread
from typing import Any

if which("sox") is None:
    winget_links = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links"
    if (winget_links / "sox.exe").is_file():
        os.environ["PATH"] = f"{winget_links}{os.pathsep}{os.environ.get('PATH', '')}"

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

logging.getLogger("http.server").setLevel(logging.WARNING)


class RuntimeState:
    """Mantiene un único modelo Qwen cargado y lo intercambia solo si cambia el modo."""

    def __init__(self) -> None:
        self.model: Any | None = None
        self.model_key = ""

    def get_model(self, *, mode: str, model_dir: Path) -> Qwen3TTSModel:
        key = f"{mode}:{model_dir.resolve()}"
        if self.model is not None and self.model_key == key:
            return self.model

        self.model = None
        self.model_key = ""
        gc.collect()
        model = Qwen3TTSModel.from_pretrained(
            str(model_dir),
            device_map="cpu",
            dtype=torch.float32,
        )
        self.model = model
        self.model_key = key
        return model


def _as_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("'chunks' debe ser una lista.")
    chunks = [str(item).strip() for item in value if str(item).strip()]
    if not chunks:
        raise ValueError("No hay texto para sintetizar.")
    return chunks


def synthesize(state: RuntimeState, payload: dict[str, Any]) -> dict[str, Any]:
    mode = str(payload.get("mode", "voice_design")).strip()
    if mode not in {"voice_design", "voice_clone"}:
        raise ValueError("Modo Qwen no compatible.")

    model_dir = Path(str(payload.get("model_dir", ""))).expanduser()
    if not model_dir.is_dir():
        raise FileNotFoundError(f"Pesos Qwen no encontrados: {model_dir}")

    output_path = Path(str(payload.get("output_path", ""))).expanduser()
    if not output_path.parent.is_dir():
        raise FileNotFoundError("La carpeta temporal de salida no existe.")

    chunks = _as_text_list(payload.get("chunks"))
    instruct = str(payload.get("instruct", "")).strip()
    temperature = float(payload.get("temperature", 0.7))
    model = state.get_model(mode=mode, model_dir=model_dir)

    generated: list[np.ndarray] = []
    sample_rate = 24000
    for chunk in chunks:
        if mode == "voice_design":
            wavs, sample_rate = model.generate_voice_design(
                text=chunk,
                language="Spanish",
                instruct=instruct,
                do_sample=True,
                temperature=temperature,
            )
        else:
            reference_wav = str(payload.get("reference_wav_path", "")).strip()
            reference_text = str(payload.get("reference_text", "")).strip()
            if not reference_wav:
                raise ValueError("Qwen Base requiere audio de referencia para clonación.")
            wavs, sample_rate = model.generate_voice_clone(
                text=chunk,
                language="Spanish",
                ref_audio=reference_wav,
                ref_text=reference_text,
                do_sample=True,
                temperature=temperature,
            )
        if not wavs:
            raise ValueError("Qwen3-TTS no produjo audio.")
        generated.append(np.asarray(wavs[0], dtype=np.float32).reshape(-1))

    audio = np.concatenate(generated) if generated else np.empty(0, dtype=np.float32)
    if audio.size == 0:
        raise ValueError("Qwen3-TTS no produjo muestras de audio.")
    sf.write(str(output_path), audio, int(sample_rate), subtype="FLOAT")
    return {"sample_rate": int(sample_rate), "segments": len(generated)}


def run_server(port: int) -> None:
    state = RuntimeState()

    class Handler(BaseHTTPRequestHandler):
        def _reply(self, code: int, body: dict[str, Any]) -> None:
            raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def log_message(self, _format: str, *_args: object) -> None:
            return

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._reply(200, {"ok": True, "loaded": state.model is not None})
                return
            self._reply(404, {"ok": False, "error": "Ruta no encontrada."})

        def do_POST(self) -> None:  # noqa: N802
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                if self.path == "/synthesize":
                    self._reply(200, {"ok": True, **synthesize(state, payload)})
                    return
                if self.path == "/shutdown":
                    self._reply(200, {"ok": True})
                    Thread(target=self.server.shutdown, daemon=True).start()
                    return
                self._reply(404, {"ok": False, "error": "Ruta no encontrada."})
            except Exception as exc:  # El adaptador devuelve este mensaje al usuario.
                self._reply(500, {"ok": False, "error": str(exc)})

    server = ThreadingHTTPServer(("127.0.0.1", int(port)), Handler)
    server.serve_forever(poll_interval=0.2)
    server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Runtime local de Qwen3-TTS para VozStudio")
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    run_server(args.port)
