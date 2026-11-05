"""Pruebas de integracion REST API v1 de VozStudio Omni-ES (FastAPI + Biblioteca + Seguridad OWASP)."""

from __future__ import annotations

from pathlib import Path
from fastapi.testclient import TestClient

from src.ai.engine_factory import EngineOrchestrator
from src.main.main import create_app


def test_api_v1_full_lifecycle_and_owasp_guards(tmp_path: Path) -> None:
    """Verifica ciclo completo: telemetria, catalogo, previsualizacion, sintesis real, streaming WAV y borrado."""
    bib_dir = tmp_path / "biblioteca_test"
    bib_dir.mkdir(parents=True, exist_ok=True)

    orch = EngineOrchestrator(biblioteca_dir=bib_dir)
    app = create_app(engine_orch=orch, biblioteca_dir=bib_dir)
    client = TestClient(app)

    # 1. Telemetria y cabeceras OWASP
    r_status = client.get("/api/v1/system/status")
    assert r_status.status_code == 200
    assert r_status.headers.get("X-Content-Type-Options") == "nosniff"
    assert r_status.headers.get("X-Frame-Options") == "DENY"
    status_body = r_status.json()
    assert status_body["hardware"]["vram_limit_gb"] == 25.0
    assert status_body["hardware"]["cpu_threads"] == 12

    # 2. Catalogo de motores y voces
    r_engines = client.get("/api/v1/engines")
    assert r_engines.status_code == 200
    engines = r_engines.json()["engines"]
    engine_ids = {e["id"] for e in engines}
    assert {"kokoro", "piper", "mms", "styletts2", "f5_spanish", "cosyvoice", "xtts_v2"}.issubset(engine_ids)

    r_voices = client.get("/api/v1/voices", params={"engine_id": "piper"})
    assert r_voices.status_code == 200
    piper_voices = r_voices.json()["voices"]
    assert len(piper_voices) >= 7

    # 3. Previsualizacion de normalizacion fonetica y segmentacion
    r_norm = client.post(
        "/api/v1/normalize-preview",
        json={"text": "El Dr. Perez pago $125 por el 100% del lote.", "max_chars": 120},
    )
    assert r_norm.status_code == 200
    norm_data = r_norm.json()
    assert norm_data["segments_count"] >= 1
    assert "doctor" in norm_data["segments"][0].lower()

    # 4. Sintesis neural real mediante Piper (rapida < 500ms) archivada en biblioteca temporal
    r_syn = client.post(
        "/api/v1/synthesize",
        json={
            "text": "Prueba de integracion local sin conexion.",
            "engine_id": "piper",
            "voice_id": "es_ES-carlfm-x_low",
            "speed": 1.05,
            "pitch_semitones": 0.0,
        },
    )
    assert r_syn.status_code == 200
    item = r_syn.json()["item"]
    item_id = item["id"]
    assert item["motor"] == "piper"
    assert item["metricas"]["duracion_audio_seg"] > 0.5
    assert item["audio_url"] == f"/api/v1/library/{item_id}/audio"

    # 5. Listado y descarga streaming del WAV generado
    r_lib = client.get("/api/v1/library")
    assert r_lib.status_code == 200
    items = r_lib.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == item_id

    r_wav = client.get(item["audio_url"])
    assert r_wav.status_code == 200
    assert r_wav.headers["content-type"].startswith("audio/wav")
    assert r_wav.content[:4] == b"RIFF"

    # 6. Rechazo de Path Traversal e inputs maliciosos
    r_bad_voice = client.post(
        "/api/v1/synthesize",
        json={
            "text": "Intento invalido",
            "engine_id": "piper",
            "voice_id": "../../secret",
        },
    )
    assert r_bad_voice.status_code == 422

    r_traversal = client.get("/api/v1/library/..%2F.env/audio")
    assert r_traversal.status_code in (400, 404, 422)

    # 7. Eliminacion segura y descarga de memoria VRAM/RAM
    r_del = client.delete(f"/api/v1/library/{item_id}")
    assert r_del.status_code == 200
    assert r_del.json()["deleted"] is True

    # 8. Cadena de limpieza acustica vocal DSP (/api/v1/dsp/clean-voice)
    import io
    import numpy as np
    import soundfile as sf

    sr = 24000
    t = np.linspace(0, 1.5, int(sr * 1.5), dtype=np.float32)
    # Senal sintetica con componente nasal (1050 Hz) y ruido
    synthetic_voice = 0.5 * np.sin(2 * np.pi * 1050 * t) + 0.05 * np.random.randn(len(t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, synthetic_voice, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)

    r_clean = client.post(
        "/api/v1/dsp/clean-voice",
        files={"audio_file": ("test_mic.wav", buf.read(), "audio/wav")},
        data={"remove_noise": "true", "anti_nasal": "true", "de_esser": "true"},
    )
    assert r_clean.status_code == 200
    clean_body = r_clean.json()
    assert "audio_url" in clean_body
    assert clean_body["metrics"]["duracion_seg"] > 1.0
    assert "Anti-Nasal 1050Hz (-4.5dB)" in clean_body["metrics"]["filtros_aplicados"]
    assert clean_body["metrics"]["pico_final"] <= 0.90

    # Descarga del audio limpio procesado
    r_clean_wav = client.get(clean_body["audio_url"])
    assert r_clean_wav.status_code == 200
    assert r_clean_wav.content[:4] == b"RIFF"


    r_unload = client.post("/api/v1/engines/unload")
    assert r_unload.status_code == 200
    assert r_unload.json()["unloaded"] is True
