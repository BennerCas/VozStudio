"""Servidor local residente para F5-TTS Spanish en su entorno aislado."""

from __future__ import annotations

import argparse
import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import Any

import numpy as np
import soundfile as sf
from f5_tts.api import F5TTS

logging.getLogger("http.server").setLevel(logging.WARNING)


class RuntimeState:
    """Conserva F5 cargado entre solicitudes para evitar recargar los pesos."""

    def __init__(self) -> None:
        self.model: F5TTS | None = None
        self.model_dir: Path | None = None

    def get_model(self, model_dir: Path) -> F5TTS:
        if self.model is not None and self.model_dir == model_dir:
            return self.model
        checkpoint = next(iter(sorted(model_dir.glob("*.safetensors"))), None)
        if checkpoint is None:
            raise FileNotFoundError("No se encontró checkpoint .safetensors para F5-Spanish.")
        vocab = model_dir / "vocab.txt"
        self.model = F5TTS(
            ckpt_file=str(checkpoint),
            vocab_file=str(vocab) if vocab.is_file() else "",
            device="cpu",
        )
        self.model_dir = model_dir
        return self.model


def synthesize(state: RuntimeState, payload: dict[str, Any]) -> dict[str, Any]:
    model_dir = Path(str(payload.get("model_dir", ""))).expanduser()
    reference_wav = Path(str(payload.get("reference_wav_path", ""))).expanduser()
    output_path = Path(str(payload.get("output_path", ""))).expanduser()
    chunks = [str(item).strip() for item in payload.get("chunks", []) if str(item).strip()]
    if not model_dir.is_dir():
        raise FileNotFoundError(f"Pesos F5 no encontrados: {model_dir}")
    if not reference_wav.is_file():
        raise FileNotFoundError("F5-TTS requiere un audio de referencia válido.")
    if not output_path.parent.is_dir() or not chunks:
        raise ValueError("Solicitud F5 inválida.")

    runtime = state.get_model(model_dir)
    speed = float(payload.get("speed", 1.0))
    reference_text = str(payload.get("reference_text", "")).strip()
    outputs: list[np.ndarray] = []
    sample_rate = 24000
    for chunk in chunks:
        wav, sample_rate, _ = runtime.infer(
            ref_file=str(reference_wav),
            ref_text=reference_text,
            gen_text=chunk,
            speed=speed,
        )
        outputs.append(np.asarray(wav, dtype=np.float32).reshape(-1))
    audio = np.concatenate(outputs) if outputs else np.empty(0, dtype=np.float32)
    if audio.size == 0:
        raise ValueError("F5-TTS no produjo muestras de audio.")
    sf.write(str(output_path), audio, int(sample_rate), subtype="FLOAT")
    return {"sample_rate": int(sample_rate), "segments": len(outputs)}


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
            except Exception as exc:
                self._reply(500, {"ok": False, "error": str(exc)})

    server = ThreadingHTTPServer(("127.0.0.1", int(port)), Handler)
    server.serve_forever(poll_interval=0.2)
    server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Runtime local F5-TTS para VozStudio")
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    run_server(args.port)
