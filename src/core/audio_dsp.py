"""Procesamiento digital de senales (DSP) de audio y gestion auditada de biblioteca/."""

from __future__ import annotations

from datetime import datetime
import json
import logging
from pathlib import Path
import re
from typing import Any
import unicodedata

import numpy as np
import soundfile as sf

from src.core.config import (
    APP_NAME,
    APP_VERSION,
    BIBLIOTECA_DIR,
    CPU_THREADS,
    DEFAULT_USER,
)

logger = logging.getLogger(__name__)

_SLUG_INVALID_RE = re.compile(r"[^a-zA-Z0-9_-]+")
_MULTI_UNDERSCORE_RE = re.compile(r"_+")
_SAFE_ITEM_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,160}$")


def sanitize_slug(value: str, max_len: int = 32) -> str:
    """Limpia cadenas arbitrarias a ``[a-zA-Z0-9_-]`` previniendo Path Traversal."""
    limit = max(1, int(max_len))
    normalized = (
        unicodedata.normalize("NFKD", str(value or ""))
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    cleaned = _SLUG_INVALID_RE.sub("_", normalized)
    cleaned = _MULTI_UNDERSCORE_RE.sub("_", cleaned).strip("_-")
    if not cleaned:
        return "default"[:limit]
    return cleaned[:limit].rstrip("_-") or "default"[:limit]


def _to_mono_float32(samples: np.ndarray) -> np.ndarray:
    """Convierte arreglos arbitrarios de audio a formato 1D mono ``np.float32`` sin NaN/Inf."""
    arr = np.asarray(samples, dtype=np.float32)
    if arr.size == 0:
        return np.zeros(0, dtype=np.float32)

    arr = np.nan_to_num(arr, nan=0.0, posinf=1.0, neginf=-1.0)
    arr = np.squeeze(arr)
    if arr.ndim == 0:
        return arr.reshape(1).astype(np.float32, copy=False)

    while arr.ndim > 1:
        if arr.shape[0] <= 8 and arr.shape[-1] > arr.shape[0]:
            arr = np.mean(arr, axis=0, dtype=np.float32)
        else:
            arr = np.mean(arr, axis=-1, dtype=np.float32)

    return np.asarray(arr, dtype=np.float32).reshape(-1)


def remove_dc_and_normalize(
    samples: np.ndarray,
    target_peak: float = 0.92,
    *,
    trim_silence: bool = True,
    silence_threshold: float = 1e-5,
) -> np.ndarray:
    """Convierte a mono 1D float32, elimina offset DC, recorta silencios extremos y normaliza pico."""
    mono = _to_mono_float32(samples)
    if mono.size == 0:
        return mono

    if mono.size > 1:
        mono = mono - float(np.mean(mono, dtype=np.float64))

    abs_mono = np.abs(mono)
    raw_peak = float(np.max(abs_mono))
    if raw_peak <= silence_threshold:
        return np.zeros_like(mono, dtype=np.float32)

    if trim_silence and mono.size > 512:
        active_indices = np.flatnonzero(abs_mono > silence_threshold)
        if active_indices.size > 0:
            margin = 120
            start_idx = max(0, int(active_indices[0]) - margin)
            end_idx = min(mono.size, int(active_indices[-1]) + margin + 1)
            mono = mono[start_idx:end_idx]

    safe_target = float(np.clip(target_peak, 0.01, 0.999))
    peak = float(np.max(np.abs(mono)))
    if peak > 1e-6:
        mono = mono * (safe_target / peak)

    return np.clip(mono, -1.0, 1.0).astype(np.float32, copy=False)


def _apply_edge_fade(segment: np.ndarray, fade_samples: int) -> np.ndarray:
    """Aplica rampas suaves de entrada y salida para suprimir clics acusticos."""
    out = segment.astype(np.float32, copy=True)
    if fade_samples <= 0 or out.size < 2:
        return out

    effective_fade = min(fade_samples, out.size // 2)
    if effective_fade <= 0:
        return out

    ramp = np.linspace(0.0, 1.0, effective_fade, dtype=np.float32)
    out[:effective_fade] *= ramp
    out[-effective_fade:] *= ramp[::-1]
    return out


def concat_audio_chunks(
    chunks: list[np.ndarray],
    sample_rate: int,
    pause_ms: int = 120,
    crossfade_ms: int = 10,
) -> np.ndarray:
    """Une multiples fragmentos con fade suave y pausa natural entre frases sin clics."""
    sr = max(1, int(sample_rate))
    valid_chunks = [_to_mono_float32(ch) for ch in chunks if np.asarray(ch).size > 0]
    valid_chunks = [ch for ch in valid_chunks if ch.size > 0]

    if not valid_chunks:
        return np.zeros(0, dtype=np.float32)

    fade_samples = int(round(sr * max(0, int(crossfade_ms)) / 1000.0))
    pause_samples = int(round(sr * max(0, int(pause_ms)) / 1000.0))

    if len(valid_chunks) == 1:
        return np.clip(_apply_edge_fade(valid_chunks[0], fade_samples), -1.0, 1.0)

    if pause_samples > 0 or fade_samples <= 0:
        silence = np.zeros(pause_samples, dtype=np.float32)
        pieces: list[np.ndarray] = []
        for idx, chunk in enumerate(valid_chunks):
            pieces.append(_apply_edge_fade(chunk, fade_samples))
            if idx < len(valid_chunks) - 1 and pause_samples > 0:
                pieces.append(silence)
        return np.clip(np.concatenate(pieces), -1.0, 1.0).astype(np.float32, copy=False)

    # Modo sin pausa (pause_ms == 0) con crossfade overlap-add entre segmentos adyacentes
    accumulated = valid_chunks[0].astype(np.float32, copy=True)
    if fade_samples > 0 and accumulated.size >= 2:
        head_fade = min(fade_samples, accumulated.size // 2)
        if head_fade > 0:
            accumulated[:head_fade] *= np.linspace(0.0, 1.0, head_fade, dtype=np.float32)

    for chunk in valid_chunks[1:]:
        nxt = chunk.astype(np.float32, copy=True)
        overlap = min(fade_samples, accumulated.size // 2, nxt.size // 2)
        if overlap <= 0:
            accumulated = np.concatenate([accumulated, nxt])
            continue

        fade_out = np.linspace(1.0, 0.0, overlap, dtype=np.float32)
        fade_in = np.linspace(0.0, 1.0, overlap, dtype=np.float32)
        blended = accumulated[-overlap:] * fade_out + nxt[:overlap] * fade_in
        accumulated = np.concatenate([accumulated[:-overlap], blended, nxt[overlap:]])

    if fade_samples > 0 and accumulated.size >= 2:
        tail_fade = min(fade_samples, accumulated.size // 2)
        if tail_fade > 0:
            accumulated[-tail_fade:] *= np.linspace(1.0, 0.0, tail_fade, dtype=np.float32)

    return np.clip(accumulated, -1.0, 1.0).astype(np.float32, copy=False)


def _phase_vocoder_pitch_shift_scipy(
    mono: np.ndarray,
    sample_rate: int,
    semitones: float,
) -> np.ndarray:
    """Fallback nativo STFT Phase Vocoder + remuestreo SciPy (compatible con NumPy 2.5+ sin Numba)."""
    from scipy import signal as sp_signal

    orig_len = int(mono.size)
    if orig_len < 16:
        return mono.astype(np.float32, copy=True)

    rate = float(2.0 ** (-float(semitones) / 12.0))
    n_fft = min(1024, max(32, 1 << int(np.floor(np.log2(orig_len)))))
    hop_length = max(1, n_fft // 4)
    noverlap = n_fft - hop_length

    _, _, stft_mat = sp_signal.stft(
        mono,
        fs=sample_rate,
        window="hann",
        nperseg=n_fft,
        noverlap=noverlap,
        boundary="zeros",
        padded=True,
    )

    num_bins, num_frames = stft_mat.shape
    if num_frames < 2:
        resampled = sp_signal.resample(mono, orig_len)
        return np.asarray(resampled, dtype=np.float32)

    time_steps = np.arange(0.0, float(num_frames - 1), rate, dtype=np.float64)
    if time_steps.size == 0:
        time_steps = np.array([0.0], dtype=np.float64)

    idx0 = np.floor(time_steps).astype(np.int64)
    idx1 = np.minimum(idx0 + 1, num_frames - 1)
    alpha = (time_steps - idx0)[np.newaxis, :]

    mag0 = np.abs(stft_mat[:, idx0])
    mag1 = np.abs(stft_mat[:, idx1])
    mag = (1.0 - alpha) * mag0 + alpha * mag1

    omega = (
        2.0
        * np.pi
        * float(hop_length)
        * np.arange(num_bins, dtype=np.float64)[:, np.newaxis]
        / float(n_fft)
    )
    phase0 = np.angle(stft_mat[:, idx0])
    phase1 = np.angle(stft_mat[:, idx1])
    delta_phi = phase1 - phase0 - omega
    delta_phi = (delta_phi + np.pi) % (2.0 * np.pi) - np.pi
    step_phi = omega + delta_phi

    phase_acc = np.empty_like(mag, dtype=np.float64)
    phase_acc[:, 0] = np.angle(stft_mat[:, 0])
    if time_steps.size > 1:
        phase_acc[:, 1:] = phase_acc[:, [0]] + np.cumsum(step_phi[:, :-1], axis=1)

    stretched_stft = mag * np.exp(1j * phase_acc)
    _, stretched_audio = sp_signal.istft(
        stretched_stft,
        fs=sample_rate,
        window="hann",
        nperseg=n_fft,
        noverlap=noverlap,
        boundary=True,
    )

    expected_stretched_len = max(1, int(round(orig_len / rate)))
    if stretched_audio.size > expected_stretched_len:
        stretched_audio = stretched_audio[:expected_stretched_len]
    elif stretched_audio.size < expected_stretched_len:
        stretched_audio = np.pad(stretched_audio, (0, expected_stretched_len - stretched_audio.size))

    shifted = sp_signal.resample(stretched_audio, orig_len)
    return np.asarray(shifted, dtype=np.float32).reshape(-1)


def apply_pitch_shift(
    samples: np.ndarray,
    sample_rate: int,
    semitones: float = 0.0,
) -> np.ndarray:
    """Aplica desplazamiento de tono con librosa (y fallback SciPy ante NumPy 2.5+) si ``abs(semitones) >= 0.05``."""
    mono = _to_mono_float32(samples)
    steps = float(semitones)
    if mono.size == 0 or abs(steps) < 0.05:
        return mono

    sr = max(1, int(sample_rate))
    try:
        import librosa

        shifted = librosa.effects.pitch_shift(y=mono, sr=sr, n_steps=steps)
        return np.clip(np.asarray(shifted, dtype=np.float32).reshape(-1), -1.0, 1.0)
    except Exception as exc:
        logger.debug(
            "Fallback DSP SciPy activado en apply_pitch_shift por incompatibilidad de runtime librosa/numba: %r",
            exc,
        )
        shifted_fb = _phase_vocoder_pitch_shift_scipy(mono, sr, steps)
        return np.clip(shifted_fb, -1.0, 1.0)


def biquad_peaking_filter(
    samples: np.ndarray,
    sample_rate: int,
    center_freq_hz: float,
    gain_db: float,
    q: float = 2.0,
) -> np.ndarray:
    """Aplica un filtro ecualizador parametrico biquad IIR de segundo orden (Cookbook RBJ)."""
    from scipy import signal as sp_signal

    mono = _to_mono_float32(samples)
    if mono.size < 4 or abs(gain_db) < 0.05:
        return mono

    fs = float(sample_rate)
    f0 = float(np.clip(center_freq_hz, 20.0, fs * 0.48))
    q_val = max(0.1, float(q))
    A = 10.0 ** (float(gain_db) / 40.0)
    w0 = 2.0 * np.pi * f0 / fs
    alpha = np.sin(w0) / (2.0 * q_val)

    b0 = 1.0 + alpha * A
    b1 = -2.0 * np.cos(w0)
    b2 = 1.0 - alpha * A
    a0 = 1.0 + alpha / A
    a1 = -2.0 * np.cos(w0)
    a2 = 1.0 - alpha / A

    b = np.array([b0 / a0, b1 / a0, b2 / a0], dtype=np.float64)
    a = np.array([1.0, a1 / a0, a2 / a0], dtype=np.float64)

    filtered = sp_signal.lfilter(b, a, mono)
    return np.asarray(filtered, dtype=np.float32)


def apply_soft_noise_gate(
    samples: np.ndarray,
    sample_rate: int,
    threshold_db: float = -42.0,
    floor_gain: float = 0.12,
    frame_ms: float = 25.0,
) -> np.ndarray:
    """Aplica una compuerta de ruido suave (soft-knee gating) para atenuar fondo en pausas."""
    mono = _to_mono_float32(samples)
    if mono.size < 128:
        return mono

    fs = float(sample_rate)
    frame_len = max(32, int(fs * frame_ms / 1000.0))
    hop_len = max(16, frame_len // 2)

    num_frames = max(1, (mono.size - frame_len) // hop_len + 1)
    gain_curve = np.ones(mono.size, dtype=np.float32)

    thresh_linear = float(10.0 ** (threshold_db / 20.0))
    floor_linear = float(np.clip(floor_gain, 0.0, 1.0))

    for i in range(num_frames):
        start = i * hop_len
        end = start + frame_len
        chunk = mono[start:end]
        rms = float(np.sqrt(np.mean(chunk * chunk) + 1e-12))
        if rms < thresh_linear:
            ratio = max(0.0, min(1.0, rms / thresh_linear))
            g = floor_linear + (1.0 - floor_linear) * (ratio ** 2)
            gain_curve[start:end] = np.minimum(gain_curve[start:end], g)

    from scipy.ndimage import uniform_filter1d
    smooth_gain = uniform_filter1d(gain_curve, size=max(3, hop_len))
    return np.asarray(mono * np.clip(smooth_gain, floor_linear, 1.0), dtype=np.float32)


def apply_spectral_subtraction(
    samples: np.ndarray,
    sample_rate: int,
    alpha: float = 1.4,
    beta: float = 0.08,
) -> np.ndarray:
    """Aplica sustraccion espectral dinamica en el dominio STFT para extinguir ruido continuo (Berouti)."""
    from scipy import signal as sp_signal

    mono = _to_mono_float32(samples)
    if mono.size < 512:
        return mono

    fs = max(1, int(sample_rate))
    orig_len = mono.size
    n_fft = min(1024, max(128, 1 << int(np.floor(np.log2(orig_len)))))
    hop = max(32, n_fft // 4)
    noverlap = n_fft - hop

    _, _, stft_mat = sp_signal.stft(
        mono,
        fs=fs,
        window="hann",
        nperseg=n_fft,
        noverlap=noverlap,
        boundary="zeros",
        padded=True,
    )
    mag = np.abs(stft_mat)
    phase = np.angle(stft_mat)

    # Estimacion del espectro de ruido base mediante el percentil 15 de cada banda frecuencial
    noise_est = np.percentile(mag, 15, axis=1, keepdims=True)

    # Sustraccion no lineal con piso residual beta para evitar 'musical noise'
    subtracted = np.maximum(mag - float(alpha) * noise_est, float(beta) * mag)

    reconstructed_stft = subtracted * np.exp(1j * phase)
    _, reconstructed_audio = sp_signal.istft(
        reconstructed_stft,
        fs=fs,
        window="hann",
        nperseg=n_fft,
        noverlap=noverlap,
        boundary=True,
    )

    if reconstructed_audio.size > orig_len:
        reconstructed_audio = reconstructed_audio[:orig_len]
    elif reconstructed_audio.size < orig_len:
        reconstructed_audio = np.pad(
            reconstructed_audio, (0, orig_len - reconstructed_audio.size)
        )

    return np.asarray(reconstructed_audio, dtype=np.float32)


def clean_vocal_audio(
    samples: np.ndarray,
    sample_rate: int,
    *,
    remove_noise: bool = True,
    anti_nasal: bool = True,
    de_esser: bool = True,
    enhance_presence: bool = True,
    target_peak: float = 0.89,
    anti_nasal_freq_hz: float = 1050.0,
    anti_nasal_gain_db: float = -5.0,
    anti_boxy_gain_db: float = -2.5,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Cadena integral de post-procesamiento acustico vocal (DSP) de grado estudio."""
    from scipy import signal as sp_signal

    mono = _to_mono_float32(samples)
    orig_peak = float(np.max(np.abs(mono))) if mono.size > 0 else 0.0
    filters_applied: list[str] = []

    if mono.size == 0:
        return (
            mono,
            {
                "duracion_seg": 0.0,
                "pico_original": 0.0,
                "pico_final": 0.0,
                "filtros_aplicados": [],
                "snr_mejora_db": 0.0,
            },
        )

    fs = max(1, int(sample_rate))
    processed = mono.copy()

    # 1. Filtro Pasa-Altos Reforzado (Butterworth 4to orden a 85 Hz: 24 dB/octava)
    if remove_noise:
        nyquist = fs * 0.5
        hp_cutoff = min(85.0, nyquist * 0.4)
        if hp_cutoff > 10.0:
            sos = sp_signal.butter(4, hp_cutoff, btype="highpass", fs=fs, output="sos")
            processed = sp_signal.sosfilt(sos, processed).astype(np.float32)
            filters_applied.append(f"HPF 4to-Orden {int(hp_cutoff)}Hz")

        # Sustraccion espectral en frecuencia STFT (elimina siseo y ventiladores continuos)
        processed = apply_spectral_subtraction(processed, fs, alpha=1.4, beta=0.08)
        filters_applied.append("Sustraccion Espectral STFT")

        # Compuerta de ruido suave para silencios y pausas
        processed = apply_soft_noise_gate(processed, fs, threshold_db=-42.0)
        filters_applied.append("Noise-Gate -42dB")

    # 2. Filtro Anti-Caja / Anti-Habitacion Hueca (Notch en 450 Hz, Q=2.0)
    if anti_nasal:
        processed = biquad_peaking_filter(
            processed,
            fs,
            center_freq_hz=450.0,
            gain_db=anti_boxy_gain_db,
            q=2.0,
        )
        filters_applied.append(f"Anti-Caja 450Hz ({anti_boxy_gain_db:.1f}dB)")

        # Filtro Anti-Nasal Quirurgico Reforzado (Notch en 1050 Hz, Q=2.2)
        processed = biquad_peaking_filter(
            processed,
            fs,
            center_freq_hz=anti_nasal_freq_hz,
            gain_db=anti_nasal_gain_db,
            q=2.2,
        )
        filters_applied.append(f"Anti-Nasal {int(anti_nasal_freq_hz)}Hz ({anti_nasal_gain_db:.1f}dB)")

    # 3. De-Esser (Atenuacion de consonantes sibilantes estridentes en 6800 Hz)
    if de_esser and fs >= 16000:
        processed = biquad_peaking_filter(
            processed,
            fs,
            center_freq_hz=6800.0,
            gain_db=-4.0,
            q=2.5,
        )
        filters_applied.append("De-Esser 6.8kHz (-4.0dB)")

    # 4. Realce de Articulacion y Presencia Vocal (Campana en 3200 Hz)
    if enhance_presence and fs >= 8000:
        processed = biquad_peaking_filter(
            processed,
            fs,
            center_freq_hz=3200.0,
            gain_db=1.2,
            q=1.6,
        )
        filters_applied.append("Presencia Vocal 3.2kHz (+1.2dB)")

    # 5. Normalizacion True-Peak (-1.0 dBFS) y Cero Offset DC
    processed = remove_dc_and_normalize(processed, target_peak=target_peak, trim_silence=False)
    filters_applied.append(f"Normalizacion -1dBFS (pico {target_peak:.2f})")

    final_peak = float(np.max(np.abs(processed))) if processed.size > 0 else 0.0
    duration_sec = float(processed.size) / float(fs)

    metrics: dict[str, Any] = {
        "duracion_seg": round(duration_sec, 2),
        "pico_original": round(orig_peak, 4),
        "pico_final": round(final_peak, 4),
        "filtros_aplicados": filters_applied,
        "sample_rate": fs,
    }

    return processed, metrics


def _resolve_contained_path(base_dir: Path, filename: str) -> Path:
    """Verifica estrictamente que ``filename`` resuelva dentro de ``base_dir`` (OWASP Path Traversal)."""
    canonical_base = base_dir.resolve()
    if (
        not filename
        or "\x00" in filename
        or "/" in filename
        or "\\" in filename
        or ":" in filename
        or ".." in filename
    ):
        raise ValueError(f"Ruta o nombre de archivo no permitido: {filename!r}")

    candidate = (canonical_base / filename).resolve()
    if not candidate.is_relative_to(canonical_base) or candidate.parent != canonical_base:
        raise ValueError(f"Intento de Path Traversal fuera de biblioteca bloqueado: {filename!r}")
    return candidate


def _validate_item_id(item_id: str) -> str:
    """Valida que el identificador de biblioteca sea un stem seguro sin secuencias de escape."""
    raw = str(item_id or "").strip()
    if raw.lower().endswith(".wav"):
        raw = raw[:-4]
    elif raw.lower().endswith(".json"):
        raw = raw[:-5]

    if (
        not raw
        or "\x00" in raw
        or "/" in raw
        or "\\" in raw
        or ":" in raw
        or ".." in raw
        or not _SAFE_ITEM_ID_RE.fullmatch(raw)
    ):
        raise ValueError(f"Identificador de biblioteca invalido o inseguro: {item_id!r}")
    return raw


def save_generation_to_biblioteca(
    samples: np.ndarray,
    sample_rate: int,
    engine_id: str,
    model_origin: str,
    voice_id: str,
    prompt_text: str,
    inference_ms: float,
    chunks_count: int = 1,
    params: dict[str, Any] | None = None,
    backend_provider: str = "CPUExecutionProvider",
    peak_memory_mb: float = 0.0,
    biblioteca_dir: Path | None = None,
) -> dict[str, Any]:
    """Guarda un archivo WAV PCM_16 y su JSON gemelo auditado conforme a ESTRUCTURA.md."""
    sr = int(sample_rate)
    if sr <= 0:
        raise ValueError("La frecuencia de muestreo (sample_rate) debe ser mayor que cero.")

    mono = _to_mono_float32(samples)
    if mono.size == 0:
        raise ValueError("El arreglo de muestras de audio no puede estar vacio.")
    mono = np.clip(mono, -1.0, 1.0)

    target_dir = (biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR).resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    engine_slug = sanitize_slug(engine_id, max_len=24)
    voice_slug = sanitize_slug(voice_id, max_len=24)
    now = datetime.now()
    base_stem = f"{now.strftime('%Y%m%d_%H%M%S')}_audio_{engine_slug}_{voice_slug}"

    stem = base_stem
    collision_idx = 1
    while (
        _resolve_contained_path(target_dir, f"{stem}.wav").exists()
        or _resolve_contained_path(target_dir, f"{stem}.json").exists()
    ):
        stem = f"{base_stem}_{collision_idx:02d}"
        collision_idx += 1

    wav_filename = f"{stem}.wav"
    json_filename = f"{stem}.json"
    wav_path = _resolve_contained_path(target_dir, wav_filename)
    json_path = _resolve_contained_path(target_dir, json_filename)

    sf.write(str(wav_path), mono, sr, subtype="PCM_16", format="WAV")

    raw_params = dict(params) if params is not None else {}
    emotion_val = raw_params.get("emotion_prompt", raw_params.get("emotion", None))
    ref_audio_val = raw_params.get("reference_audio", None)

    structured_params: dict[str, Any] = {
        "speed": float(raw_params.get("speed", 1.0)),
        "pitch_semitones": float(raw_params.get("pitch_semitones", 0.0)),
        "sample_rate": sr,
        "emotion_prompt": emotion_val,
        "reference_audio": ref_audio_val,
    }
    for extra_key, extra_val in raw_params.items():
        if extra_key not in structured_params and extra_key != "emotion":
            structured_params[extra_key] = extra_val

    duration_sec = round(float(mono.shape[0]) / float(sr), 4)
    inf_ms = round(max(0.0, float(inference_ms)), 2)
    rtf = round((inf_ms / 1000.0) / duration_sec, 4) if duration_sec > 0.0 else 0.0
    peak_mb = round(max(0.0, float(peak_memory_mb)), 2)

    metadata: dict[str, Any] = {
        "id": stem,
        "archivo": wav_filename,
        "json_archivo": json_filename,
        "audio_url": f"/api/library/{stem}/audio",
        "modelo_origen": str(model_origin),
        "motor": str(engine_id),
        "voz_id": str(voice_id),
        "parametros": structured_params,
        "prompt_original": str(prompt_text),
        "metricas": {
            "caracteres_entrada": len(str(prompt_text)),
            "fragmentos": max(1, int(chunks_count)),
            "duracion_audio_seg": duration_sec,
            "tiempo_inferencia_ms": inf_ms,
            "rtf": rtf,
            "pico_memoria_mb": peak_mb,
        },
        "contexto": {
            "app": APP_NAME,
            "version": APP_VERSION,
            "timestamp": now.isoformat(timespec="seconds"),
            "usuario": DEFAULT_USER,
            "backend": str(backend_provider),
            "cpu_threads": int(CPU_THREADS),
        },
    }

    json_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return metadata


def list_biblioteca(
    biblioteca_dir: Path | None = None,
    engine_filter: str | None = None,
    query: str | None = None,
) -> list[dict[str, Any]]:
    """Lista entradas auditadas de mas reciente a mas antigua verificando existencia del WAV."""
    target_dir = (biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR).resolve()
    if not target_dir.is_dir():
        return []

    norm_engine = engine_filter.strip().lower() if engine_filter and engine_filter.strip() else None
    norm_query = query.strip().lower() if query and query.strip() else None

    entries: list[dict[str, Any]] = []
    for json_file in target_dir.glob("*.json"):
        try:
            resolved_json = _resolve_contained_path(target_dir, json_file.name)
            data = json.loads(resolved_json.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue

            wav_name = str(data.get("archivo") or f"{resolved_json.stem}.wav")
            resolved_wav = _resolve_contained_path(target_dir, wav_name)
            if not resolved_wav.is_file():
                continue

            item_id = str(data.get("id") or resolved_json.stem)
            data.setdefault("id", item_id)
            data.setdefault("archivo", wav_name)
            data.setdefault("json_archivo", resolved_json.name)
            data.setdefault("audio_url", f"/api/library/{item_id}/audio")

            if norm_engine and str(data.get("motor", "")).strip().lower() != norm_engine:
                continue

            if norm_query:
                searchable = " ".join(
                    [
                        str(data.get("id", "")),
                        str(data.get("archivo", "")),
                        str(data.get("motor", "")),
                        str(data.get("modelo_origen", "")),
                        str(data.get("voz_id", "")),
                        str(data.get("prompt_original", "")),
                    ]
                ).lower()
                if norm_query not in searchable:
                    continue

            entries.append(data)
        except Exception as exc:
            logger.warning("Entrada omitida al listar biblioteca (%s): %r", json_file.name, exc)

    entries.sort(
        key=lambda item: (
            str(item.get("contexto", {}).get("timestamp", "")),
            str(item.get("archivo", "")),
        ),
        reverse=True,
    )
    return entries


def get_biblioteca_item(
    item_id: str,
    biblioteca_dir: Path | None = None,
) -> tuple[Path, dict[str, Any]]:
    """Obtiene la ruta segura al WAV y los metadatos de un elemento validando Path Traversal."""
    clean_id = _validate_item_id(item_id)
    target_dir = (biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR).resolve()

    wav_path = _resolve_contained_path(target_dir, f"{clean_id}.wav")
    json_path = _resolve_contained_path(target_dir, f"{clean_id}.json")

    if not wav_path.is_file():
        raise FileNotFoundError(f"Archivo de audio no encontrado en biblioteca: {clean_id}")

    if json_path.is_file():
        metadata = json.loads(json_path.read_text(encoding="utf-8"))
        if not isinstance(metadata, dict):
            raise ValueError(f"Metadatos JSON corruptos para elemento: {clean_id}")
        recorded_wav = str(metadata.get("archivo") or f"{clean_id}.wav")
        wav_path = _resolve_contained_path(target_dir, recorded_wav)
        if not wav_path.is_file():
            raise FileNotFoundError(f"Archivo WAV referenciado no existe: {recorded_wav}")
        metadata.setdefault("id", clean_id)
        metadata.setdefault("json_archivo", json_path.name)
        metadata.setdefault("audio_url", f"/api/library/{clean_id}/audio")
    else:
        metadata = {
            "id": clean_id,
            "archivo": wav_path.name,
            "json_archivo": "",
            "audio_url": f"/api/library/{clean_id}/audio",
            "modelo_origen": "desconocido",
            "motor": "desconocido",
            "voz_id": "desconocido",
            "parametros": {},
            "prompt_original": "",
            "metricas": {},
            "contexto": {"app": APP_NAME, "version": APP_VERSION},
        }

    return wav_path, metadata


def delete_biblioteca_item(
    item_id: str,
    biblioteca_dir: Path | None = None,
) -> bool:
    """Elimina de forma segura el par WAV + JSON de ``biblioteca/`` previniendo Path Traversal."""
    clean_id = _validate_item_id(item_id)
    target_dir = (biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR).resolve()

    wav_path = _resolve_contained_path(target_dir, f"{clean_id}.wav")
    json_path = _resolve_contained_path(target_dir, f"{clean_id}.json")

    deleted_any = False
    if json_path.is_file():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("archivo"):
                alt_wav = _resolve_contained_path(target_dir, str(data["archivo"]))
                if alt_wav.is_file() and alt_wav != wav_path:
                    alt_wav.unlink()
                    deleted_any = True
        except ValueError:
            raise
        except Exception:
            pass
        json_path.unlink()
        deleted_any = True

    if wav_path.is_file():
        wav_path.unlink()
        deleted_any = True

    return deleted_any


__all__ = [
    "apply_pitch_shift",
    "concat_audio_chunks",
    "delete_biblioteca_item",
    "get_biblioteca_item",
    "list_biblioteca",
    "remove_dc_and_normalize",
    "sanitize_slug",
    "save_generation_to_biblioteca",
]
