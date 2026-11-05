"""Almacen persistente de timbres y voces personalizadas clonadas."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import re
import secrets
from typing import Any

import numpy as np
import soundfile as sf

from src.ai.base_engine import VoiceDescriptor
from src.core.audio_dsp import _to_mono_float32, sanitize_slug
from src.core.config import BIBLIOTECA_DIR

logger = logging.getLogger(__name__)

CUSTOM_VOICES_FILE = ".custom_voices.json"
CUSTOM_VOICES_AUDIO_DIR = "voces_clonadas"


class CustomVoiceStore:
    """Gestiona el ciclo de vida y persistencia de timbres vocales clonados."""

    def __init__(self, biblioteca_dir: Path | None = None) -> None:
        self.biblioteca_dir = (
            biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR
        ).resolve()
        self.audio_dir = self.biblioteca_dir / CUSTOM_VOICES_AUDIO_DIR
        self.metadata_file = self.biblioteca_dir / CUSTOM_VOICES_FILE
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        self.biblioteca_dir.mkdir(parents=True, exist_ok=True)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        if not self.metadata_file.exists():
            self._save_raw({})

    def _load_raw(self) -> dict[str, dict[str, Any]]:
        try:
            if not self.metadata_file.exists():
                return {}
            data = json.loads(self.metadata_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
            return {}
        except Exception as exc:
            logger.warning("Fallo al leer %s: %s", self.metadata_file, exc)
            return {}

    def _save_raw(self, data: dict[str, dict[str, Any]]) -> None:
        tmp = self.metadata_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.metadata_file)

    def add_custom_voice(
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
        """Registra un nuevo timbre clonado, persiste su audio y actualiza el catalogo."""
        clean_engine = sanitize_slug(engine_id, max_len=20)
        clean_name = name.strip() or f"Voz {clean_engine.upper()}"
        slug_name = sanitize_slug(clean_name, max_len=24)
        token = secrets.token_hex(3)
        voice_id = f"custom_{clean_engine}_{slug_name}_{token}"

        wav_path = (self.audio_dir / f"{voice_id}.wav").resolve()
        mono = _to_mono_float32(samples)
        if mono.size == 0:
            raise ValueError("El audio de referencia de la voz no puede estar vacio.")

        sr = max(8000, int(sample_rate))
        sf.write(str(wav_path), mono, sr, subtype="PCM_16")

        desc = description.strip() or f"Timbre personalizado clonado para {clean_engine.upper()}."

        record: dict[str, Any] = {
            "id": voice_id,
            "name": clean_name,
            "engine": clean_engine,
            "region": region.upper() if region else "ES",
            "gender": gender.upper() if gender else "MIX",
            "sample_rate": sr,
            "quality": "STUDIO",
            "description": desc,
            "supports_cloning": False,
            "supports_emotion": True,
            "reference_wav_path": str(wav_path),
            "reference_text": (reference_text or "").strip(),
            "is_custom": True,
        }

        all_records = self._load_raw()
        all_records[voice_id] = record
        self._save_raw(all_records)

        return VoiceDescriptor(
            id=record["id"],
            name=record["name"],
            engine=record["engine"],
            region=record["region"],
            gender=record["gender"],
            sample_rate=record["sample_rate"],
            quality=record["quality"],
            description=record["description"],
            supports_cloning=record["supports_cloning"],
            supports_emotion=record["supports_emotion"],
        )

    def list_custom_voices(self, engine_id: str | None = None) -> list[VoiceDescriptor]:
        """Retorna las voces personalizadas registradas, opcionalmente filtradas por motor."""
        all_records = self._load_raw()
        target_engine = engine_id.strip().lower() if engine_id else None
        descriptors: list[VoiceDescriptor] = []

        for r in all_records.values():
            if target_engine and r.get("engine", "").lower() != target_engine:
                continue
            # Verificar que el archivo WAV siga existiendo en disco
            wav_path_str = r.get("reference_wav_path")
            if wav_path_str and not Path(wav_path_str).exists():
                continue

            descriptors.append(
                VoiceDescriptor(
                    id=r["id"],
                    name=r["name"],
                    engine=r["engine"],
                    region=r.get("region", "ES"),
                    gender=r.get("gender", "MIX"),
                    sample_rate=int(r.get("sample_rate", 24000)),
                    quality=r.get("quality", "STUDIO"),
                    description=r.get("description", "Voz personalizada clonada."),
                    supports_cloning=False,
                    supports_emotion=True,
                )
            )
        return descriptors

    def get_custom_voice_record(self, voice_id: str) -> dict[str, Any] | None:
        """Recupera la metadata completa (incluyendo reference_wav_path) de una voz clonada."""
        all_records = self._load_raw()
        return all_records.get(voice_id)

    def delete_custom_voice(self, voice_id: str) -> bool:
        """Elimina la voz personalizada de la persistencia y su archivo de audio."""
        all_records = self._load_raw()
        if voice_id not in all_records:
            return False

        record = all_records.pop(voice_id)
        self._save_raw(all_records)

        wav_path_str = record.get("reference_wav_path")
        if wav_path_str:
            try:
                p = Path(wav_path_str)
                if p.is_file():
                    p.unlink()
            except OSError as exc:
                logger.warning("No se pudo eliminar archivo WAV %s: %s", wav_path_str, exc)
        return True
