"""Pruebas unitarias e integracion offline real para normalizador G2P espanol y motores TTS."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from src.ai.base_engine import SynthesisParams
from src.ai.engine_factory import EngineOrchestrator
from src.core.memory_manager import MemoryManager
from src.core.text_normalizer import (
    normalize_spanish_text,
    number_to_spanish,
    prepare_spanish_chunks,
    split_spanish_segments,
)

VALID_REGIONS = {"ES", "MX", "AR", "LATAM", "MULTI"}


class TestSpanishNumberConversion:
    """Verifica la conversion exacta de enteros de 0 a 999_999_999_999."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            (0, "cero"),
            (1, "uno"),
            (15, "quince"),
            (16, "dieciséis"),
            (20, "veinte"),
            (21, "veintiuno"),
            (22, "veintidós"),
            (23, "veintitrés"),
            (26, "veintiséis"),
            (32, "treinta y dos"),
            (85, "ochenta y cinco"),
            (100, "cien"),
            (105, "ciento cinco"),
            (500, "quinientos"),
            (700, "setecientos"),
            (900, "novecientos"),
            (1_000, "mil"),
            (2_000, "dos mil"),
            (21_000, "veintiún mil"),
            (100_000, "cien mil"),
            (1_000_000, "un millón"),
            (2_000_000, "dos millones"),
            (21_000_000, "veintiún millones"),
            (1_000_000_000, "mil millones"),
            (2_500_000_000, "dos mil quinientos millones"),
            (
                999_999_999_999,
                "novecientos noventa y nueve mil novecientos noventa y nueve millones "
                "novecientos noventa y nueve mil novecientos noventa y nueve",
            ),
        ],
    )
    def test_cardinal_numbers(self, value: int, expected: str) -> None:
        assert number_to_spanish(value) == expected

    def test_negative_and_bounds(self) -> None:
        assert number_to_spanish(-42) == "menos cuarenta y dos"
        with pytest.raises(ValueError):
            number_to_spanish(1_000_000_000_000)
        with pytest.raises(TypeError):
            number_to_spanish(True)  # type: ignore[arg-type]


class TestSpanishPhoneticNormalizer:
    """Valida expansion de decimales, divisas, porcentajes, horas, abreviaturas y signos."""

    def test_decimals_comma_and_dot(self) -> None:
        assert normalize_spanish_text("Pi vale 3,14 o 3.14.") == (
            "Pi vale tres punto catorce o tres punto catorce."
        )
        assert normalize_spanish_text("Margen de 0,05.") == "Margen de cero punto cero cinco."

    def test_percentages_currencies_and_hours(self) -> None:
        raw = "A las 14:30 el bono subió 85% con $150 y \u20ac50."
        normalized = normalize_spanish_text(raw)
        assert "catorce horas con treinta minutos" in normalized
        assert "ochenta y cinco por ciento" in normalized
        assert "ciento cincuenta dólares" in normalized
        assert "cincuenta euros" in normalized

    def test_abbreviations_with_utf8_accents_and_ene(self) -> None:
        raw = (
            "El Dr. Ruiz, la Dra. Paz y el Sr. Gómez con la Sra. Díaz y el Ing. Mora "
            "viajaron a 120 km/h aprox., cap. Núm. 4, etc."
        )
        normalized = normalize_spanish_text(raw)
        assert "doctor Ruiz" in normalized
        assert "doctora Paz" in normalized
        assert "señor Gómez" in normalized
        assert "señora Díaz" in normalized
        assert "ingeniero Mora" in normalized
        assert "ciento veinte kilómetros por hora" in normalized
        assert "aproximadamente," in normalized
        assert "número cuatro" in normalized
        assert normalized.endswith("etcétera.")

    def test_spanish_punctuation_preserved_and_control_cleaned(self) -> None:
        raw = "  ¿Cómo   estás\x07?   ¡Qué   alegría   verte;  amigo:  todo   bien!  "
        normalized = normalize_spanish_text(raw)
        assert normalized == "¿Cómo estás? ¡Qué alegría verte; amigo: todo bien!"

    def test_no_word_loss_on_long_spanish_text_over_1200_chars(self) -> None:
        base_sentence = (
            "¿Sabías que la síntesis neuronal de voz en español requiere una "
            "normalización fonética rigurosa, pausas prosódicas naturales, respeto "
            "absoluto por la acentuación gráfica y segmentación limpia de cláusulas "
            "extensas sin mutilar jamás ninguna palabra del discurso original?"
        )
        long_clause_without_periods = (
            "Además, cuando una oración subordinada encadena múltiples complementos "
            "técnicos, descriptivos, acústicos, lingüísticos, computacionales, "
            "fonológicos, articulatorios, espectrales, dinámicos y expresivos durante "
            "más de trescientos cincuenta caracteres consecutivos sin signos de punto, "
            "el segmentador debe dividir con suavidad por comas o espacios."
        )
        full_text = " ".join([base_sentence] * 5 + [long_clause_without_periods])
        assert len(full_text) > 1350

        segments = split_spanish_segments(full_text, max_chars=240)
        assert len(segments) >= 6
        for seg in segments:
            assert 0 < len(seg) <= 240

        original_words = full_text.split()
        reconstructed_words = [word for seg in segments for word in seg.split()]
        assert reconstructed_words == original_words

        chunks = prepare_spanish_chunks(full_text, max_chars=240)
        assert len(chunks) >= 6
        assert all(len(c) <= 240 for c in chunks)


class TestEngineOrchestratorAndRealSynthesis:
    """Valida el registro de 6 motores y ejecuta sintesis neuronal real offline."""

    def test_orchestrator_registers_all_six_engines_and_valid_voices(
        self, tmp_path: Path
    ) -> None:
        local_mm = MemoryManager()
        orch = EngineOrchestrator(mem_manager=local_mm, biblioteca_dir=tmp_path)

        engines = orch.list_engines()
        engine_ids = [item["id"] for item in engines]
        assert engine_ids == ["kokoro", "piper", "mms", "styletts2", "f5_spanish", "cosyvoice"]

        by_id = {item["id"]: item for item in engines}
        assert by_id["kokoro"]["available"] is True
        assert by_id["kokoro"]["voices_count"] == 5
        assert by_id["piper"]["available"] is True
        assert by_id["piper"]["voices_count"] == 7
        assert by_id["cosyvoice"]["available"] is True
        assert by_id["cosyvoice"]["voices_count"] == 3

        all_voices = orch.list_voices()
        assert len(all_voices) >= 18
        for voice in all_voices:
            assert voice.region in VALID_REGIONS
            assert all(ch.isalnum() or ch in ("_", "-") for ch in voice.id)

    @pytest.mark.parametrize(
        ("engine_id", "voice_id"),
        [
            ("kokoro", "ef_dora"),
            ("kokoro", "es_blend_editorial"),
            ("piper", "es_MX-claude-high"),
            ("piper", "es_AR-daniela-high"),
            ("piper", "es_ES-sharvard-f"),
        ],
    )
    def test_real_offline_synthesis_kokoro_and_piper(
        self,
        tmp_path: Path,
        engine_id: str,
        voice_id: str,
    ) -> None:
        local_mm = MemoryManager()
        orch = EngineOrchestrator(mem_manager=local_mm, biblioteca_dir=tmp_path)

        sample_text = (
            "¡Hola! El Dr. Pérez confirmó a las 14:30 un avance del 85% "
            "en síntesis neural en español por $150."
        )
        result = orch.synthesize(
            text=sample_text,
            engine_id=engine_id,
            voice_id=voice_id,
            params=SynthesisParams(speed=1.0, max_chunk_chars=260),
            save_to_library=True,
        )

        wav_path = Path(result["wav_path"])
        json_path = Path(result["json_path"])
        assert wav_path.is_file()
        assert json_path.is_file()

        samples, sample_rate = sf.read(str(wav_path), dtype="float32")
        duration_sec = float(samples.shape[0]) / float(sample_rate)
        peak_amplitude = float(np.max(np.abs(samples)))

        assert duration_sec > 1.0, f"Duracion insuficiente ({duration_sec:.2f}s) para {voice_id}"
        assert peak_amplitude > 0.05, f"Amplitud demasiado baja ({peak_amplitude:.4f}) para {voice_id}"

        saved_meta = json.loads(json_path.read_text(encoding="utf-8"))
        assert saved_meta["motor"] == engine_id
        assert saved_meta["voz_id"] == voice_id
        assert saved_meta["metricas"]["rtf"] > 0.0
        assert saved_meta["metricas"]["duracion_audio_seg"] > 1.0

        orch.unload_active_engine()
        assert local_mm.active_engine_id is None
