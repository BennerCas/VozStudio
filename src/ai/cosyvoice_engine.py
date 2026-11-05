"""Adaptador ONNX puro de clonacion zero-shot y control emocional para CosyVoice3-0.5B."""

from __future__ import annotations

import gc
import logging
import math
from pathlib import Path
import re
from typing import Any

import numpy as np
import onnxruntime as ort
from scipy.ndimage import zoom
from scipy.signal import get_window, resample_poly
import soundfile as sf

from src.ai.base_engine import BaseTTSEngine, SynthesisParams, VoiceDescriptor
from src.core.config import BRAINS_SPACE_DIR, CPU_THREADS, MODELS_LINK_DIR
from src.core.hardware import build_session_options, create_onnx_session_with_fallback

logger = logging.getLogger(__name__)

COSYVOICE_SAMPLE_RATE = 24000

_DEFAULT_PROMPT_TRANSCRIPT = (
    "Hello, my name is Sarah. I'm excited to help you with your project today. "
    "Let me know if you have any questions."
)

_LANG_TAG_RE = re.compile(r"<\|[a-zA-Z0-9_-]+\|>")

_REQUIRED_ONNX_SPECS: dict[str, tuple[str, ...]] = {
    "campplus": ("campplus.onnx", "campplus_fp16.onnx", "campplus_fp32.onnx"),
    "speech_tokenizer": ("speech_tokenizer_v3.onnx", "speech_tokenizer_v3_fp16.onnx"),
    "text_embedding": ("text_embedding_fp32.onnx",),
    "llm_backbone_initial": ("llm_backbone_initial_fp16.onnx", "llm_backbone_initial_fp32.onnx"),
    "llm_backbone_decode": ("llm_backbone_decode_fp16.onnx", "llm_backbone_decode_fp32.onnx"),
    "llm_decoder": ("llm_decoder_fp16.onnx", "llm_decoder_fp32.onnx"),
    "llm_speech_embedding": ("llm_speech_embedding_fp16.onnx", "llm_speech_embedding_fp32.onnx"),
    "flow_token_embedding": ("flow_token_embedding_fp16.onnx", "flow_token_embedding_fp32.onnx"),
    "flow_speaker_projection": (
        "flow_speaker_projection_fp16.onnx",
        "flow_speaker_projection_fp32.onnx",
    ),
    "flow_pre_lookahead": ("flow_pre_lookahead_fp16.onnx", "flow_pre_lookahead_fp32.onnx"),
    "flow_estimator": ("flow.decoder.estimator.fp16.onnx", "flow.decoder.estimator.fp32.onnx"),
    "hift_f0_predictor": ("hift_f0_predictor_fp32.onnx",),
    "hift_source_generator": ("hift_source_generator_fp32.onnx",),
    "hift_decoder": ("hift_decoder_fp32.onnx",),
}

_EMOTION_PROFILES: dict[str, dict[str, float | int]] = {
    "neutral": {"sampling_k": 25, "speed_factor": 1.00, "gain": 1.00},
    "alegre": {"sampling_k": 30, "speed_factor": 1.06, "gain": 1.00},
    "calmo": {"sampling_k": 16, "speed_factor": 0.92, "gain": 0.96},
    "energico": {"sampling_k": 32, "speed_factor": 1.10, "gain": 1.00},
    "susurro": {"sampling_k": 14, "speed_factor": 0.90, "gain": 0.78},
}


def _hz_to_mel_slaney(frequencies: np.ndarray | float) -> np.ndarray:
    """Conversion de Hz a escala Mel Slaney (equivalente a librosa htk=False)."""
    freq = np.asanyarray(frequencies, dtype=np.float64)
    f_min = 0.0
    f_sp = 200.0 / 3.0
    mels = (freq - f_min) / f_sp

    min_log_hz = 1000.0
    min_log_mel = (min_log_hz - f_min) / f_sp
    logstep = math.log(6.4) / 27.0

    if freq.ndim > 0:
        log_t = freq >= min_log_hz
        mels[log_t] = min_log_mel + np.log(freq[log_t] / min_log_hz) / logstep
    elif freq >= min_log_hz:
        mels = np.asarray(min_log_mel + math.log(float(freq) / min_log_hz) / logstep)
    return mels


def _mel_to_hz_slaney(mels: np.ndarray) -> np.ndarray:
    """Conversion inversa de escala Mel Slaney a Hz."""
    mel_arr = np.asanyarray(mels, dtype=np.float64)
    f_min = 0.0
    f_sp = 200.0 / 3.0
    freqs = f_min + f_sp * mel_arr

    min_log_hz = 1000.0
    min_log_mel = (min_log_hz - f_min) / f_sp
    logstep = math.log(6.4) / 27.0

    log_t = mel_arr >= min_log_mel
    freqs[log_t] = min_log_hz * np.exp(logstep * (mel_arr[log_t] - min_log_mel))
    return freqs


def _build_mel_filterbank(
    sr: int,
    n_fft: int,
    n_mels: int,
    fmin: float,
    fmax: float,
) -> np.ndarray:
    """Construye banco de filtros Mel normalizado Slaney usando solo NumPy."""
    fftfreqs = np.fft.rfftfreq(n=n_fft, d=1.0 / float(sr))
    min_mel = float(_hz_to_mel_slaney(fmin))
    max_mel = float(_hz_to_mel_slaney(fmax))
    mels = np.linspace(min_mel, max_mel, n_mels + 2)
    mel_f = _mel_to_hz_slaney(mels)

    fdiff = np.diff(mel_f)
    ramps = np.subtract.outer(mel_f, fftfreqs)

    weights = np.zeros((n_mels, len(fftfreqs)), dtype=np.float32)
    for idx in range(n_mels):
        lower = -ramps[idx] / fdiff[idx]
        upper = ramps[idx + 2] / fdiff[idx + 1]
        weights[idx] = np.maximum(0.0, np.minimum(lower, upper)).astype(np.float32)

    enorm = 2.0 / (mel_f[2 : n_mels + 2] - mel_f[:n_mels])
    weights *= enorm[:, np.newaxis].astype(np.float32)
    return weights


def _compute_mel_spectrogram(
    audio: np.ndarray,
    *,
    sr: int,
    n_fft: int,
    hop_length: int,
    n_mels: int,
    fmin: float,
    fmax: float,
) -> np.ndarray:
    """Calcula espectrograma de potencia Mel [n_mels, frames] sin depender de librosa/numba."""
    y = np.asarray(audio, dtype=np.float32).reshape(-1)
    pad = n_fft // 2
    if y.size == 0:
        return np.zeros((n_mels, 1), dtype=np.float32)
    pad_mode = "reflect" if y.size > pad else "edge"
    y_padded = np.pad(y, (pad, pad), mode=pad_mode)

    window = get_window("hann", n_fft, fftbins=True).astype(np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(y_padded, n_fft)[::hop_length]
    windowed = frames * window[np.newaxis, :]
    stft_matrix = np.fft.rfft(windowed, n=n_fft, axis=-1)
    power_spec = (np.real(stft_matrix) ** 2 + np.imag(stft_matrix) ** 2).T.astype(np.float32)

    mel_basis = _build_mel_filterbank(sr=sr, n_fft=n_fft, n_mels=n_mels, fmin=fmin, fmax=fmax)
    return np.matmul(mel_basis, power_spec).astype(np.float32)


def _load_audio_mono(audio_path: Path, target_sr: int) -> np.ndarray:
    """Carga un archivo de audio en mono float32 remuestreado con scipy.signal.resample_poly."""
    data, orig_sr = sf.read(str(audio_path), dtype="float32", always_2d=False)
    mono = np.asarray(data, dtype=np.float32)
    if mono.ndim > 1:
        mono = np.mean(mono, axis=1, dtype=np.float32)
    mono = mono.reshape(-1)
    if int(orig_sr) != int(target_sr) and mono.size > 0:
        divisor = math.gcd(int(target_sr), int(orig_sr))
        up = int(target_sr) // divisor
        down = int(orig_sr) // divisor
        mono = resample_poly(mono, up, down).astype(np.float32)
    return mono


def _stretch_waveform_linear(audio: np.ndarray, speed: float) -> np.ndarray:
    """Ajusta duracion temporal suave si speed difiere significativamente de 1.0."""
    if audio.size < 16 or abs(speed - 1.0) < 0.03:
        return audio
    new_len = max(16, int(round(audio.size / speed)))
    src_x = np.linspace(0.0, 1.0, num=audio.size, dtype=np.float32)
    dst_x = np.linspace(0.0, 1.0, num=new_len, dtype=np.float32)
    return np.interp(dst_x, src_x, audio).astype(np.float32)


class _CosyVoiceOnnxPipeline:
    """Pipeline ONNX puro para CosyVoice3-0.5B compatible con raiz o subcarpeta onnx/."""

    def __init__(self, model_dir: Path, *, prefer_dml: bool = True) -> None:
        self.model_dir = model_dir
        self.sample_rate = COSYVOICE_SAMPLE_RATE
        self.hidden_dim = 896
        self.speech_token_size = 6561
        self.sos = self.speech_token_size + 0
        self.eos_token = self.speech_token_size + 1
        self.task_id = self.speech_token_size + 2

        self.tokenizer = self._load_tokenizer(model_dir)
        self.sessions: dict[str, ort.InferenceSession] = {}
        self.active_provider = self._load_sessions(model_dir, prefer_dml=prefer_dml)
        self._prompt_cache: dict[tuple[str, int], tuple[np.ndarray, np.ndarray, np.ndarray]] = {}

    @staticmethod
    def resolve_onnx_file(model_dir: Path, candidates: tuple[str, ...]) -> Path | None:
        """Busca un archivo ONNX directamente en model_dir o dentro de model_dir/onnx."""
        search_dirs = (model_dir, model_dir / "onnx")
        for folder in search_dirs:
            if not folder.is_dir():
                continue
            for filename in candidates:
                candidate = folder / filename
                if candidate.is_file():
                    return candidate
        return None

    @staticmethod
    def resolve_tokenizer_dir(model_dir: Path) -> Path | None:
        """Localiza vocab.json del tokenizador Qwen2 incluido en CosyVoice3-ONNX."""
        for folder in (model_dir / "CosyVoice-BlankEN", model_dir, model_dir / "onnx"):
            if (folder / "vocab.json").is_file():
                return folder
        return None

    @classmethod
    def _load_tokenizer(cls, model_dir: Path) -> Any:
        tok_dir = cls.resolve_tokenizer_dir(model_dir)
        if tok_dir is None:
            raise FileNotFoundError(
                f"No se encontro vocab.json del tokenizador Qwen2 en {model_dir}"
            )
        from transformers import AutoTokenizer

        return AutoTokenizer.from_pretrained(
            str(tok_dir),
            local_files_only=True,
            trust_remote_code=True,
        )

    def _load_sessions(self, model_dir: Path, *, prefer_dml: bool) -> str:
        probe_path = self.resolve_onnx_file(model_dir, _REQUIRED_ONNX_SPECS["text_embedding"])
        if probe_path is None:
            raise FileNotFoundError("Falta text_embedding_fp32.onnx en CosyVoice3-ONNX.")

        _, selected_provider = create_onnx_session_with_fallback(
            probe_path,
            prefer_dml=prefer_dml,
            warmup_fn=lambda s: s.run(None, {"input_ids": np.array([[1, 2]], dtype=np.int64)}),
        )

        use_dml = selected_provider == "DmlExecutionProvider"
        for key, candidates in _REQUIRED_ONNX_SPECS.items():
            onnx_file = self.resolve_onnx_file(model_dir, candidates)
            if onnx_file is None:
                raise FileNotFoundError(
                    f"Archivo ONNX requerido '{candidates[0]}' ausente en {model_dir}"
                )

            if use_dml:
                sess, _ = create_onnx_session_with_fallback(onnx_file, prefer_dml=True)
            else:
                cpu_opts = build_session_options(for_dml=False, cpu_threads=CPU_THREADS)
                sess = ort.InferenceSession(
                    str(onnx_file),
                    sess_options=cpu_opts,
                    providers=["CPUExecutionProvider"],
                )
            self.sessions[key] = sess

        return selected_provider

    def close(self) -> None:
        self.sessions.clear()
        self._prompt_cache.clear()
        self.tokenizer = None

    def _extract_prompt_features(
        self, prompt_wav: Path
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        stat = prompt_wav.stat()
        cache_key = (str(prompt_wav.resolve()), int(stat.st_mtime_ns))
        cached = self._prompt_cache.get(cache_key)
        if cached is not None:
            return cached

        audio_16k = _load_audio_mono(prompt_wav, target_sr=16000)
        audio_24k = _load_audio_mono(prompt_wav, target_sr=24000)

        # 1. Speaker embedding (Campplus: 80 mels, 20..7600 Hz)
        mel_80 = _compute_mel_spectrogram(
            audio_16k, sr=16000, n_fft=400, hop_length=160, n_mels=80, fmin=20.0, fmax=7600.0
        )
        log_mel_80 = np.log(np.maximum(mel_80, 1e-10)).T
        log_mel_80 = log_mel_80 - log_mel_80.mean(axis=0, keepdims=True)
        camp_feat = log_mel_80[np.newaxis, :, :].astype(np.float32)
        camp_sess = self.sessions["campplus"]
        spk_emb = camp_sess.run(None, {camp_sess.get_inputs()[0].name: camp_feat})[0]
        spk_emb = spk_emb.flatten()[np.newaxis, :].astype(np.float32)

        # 2. Speech tokens (Whisper-style 128 mels)
        mel_128 = _compute_mel_spectrogram(
            audio_16k, sr=16000, n_fft=400, hop_length=160, n_mels=128, fmin=0.0, fmax=8000.0
        )
        log_mel_128 = np.log10(np.maximum(mel_128, 1e-10))
        log_mel_128 = np.maximum(log_mel_128, float(log_mel_128.max()) - 8.0)
        log_mel_128 = (log_mel_128 + 4.0) / 4.0
        st_feat = log_mel_128[np.newaxis, :, :].astype(np.float32)
        st_len = np.array([st_feat.shape[2]], dtype=np.int32)
        st_sess = self.sessions["speech_tokenizer"]
        st_inputs = [inp.name for inp in st_sess.get_inputs()]
        prompt_tokens = st_sess.run(
            None,
            {st_inputs[0]: st_feat, st_inputs[1]: st_len},
        )[0]
        prompt_tokens = prompt_tokens.flatten()[np.newaxis, :].astype(np.int64)

        # 3. Prompt Mel 24 kHz para Flow conditioning
        mel_24k = _compute_mel_spectrogram(
            audio_24k, sr=24000, n_fft=1024, hop_length=256, n_mels=80, fmin=0.0, fmax=12000.0
        )
        prompt_mel = np.log(np.maximum(mel_24k, 1e-10)).T[np.newaxis, :, :].astype(np.float32)

        bundle = (spk_emb, prompt_tokens, prompt_mel)
        if len(self._prompt_cache) >= 8:
            self._prompt_cache.clear()
        self._prompt_cache[cache_key] = bundle
        return bundle

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        shifted = x - np.max(x)
        exp_x = np.exp(shifted)
        return exp_x / np.sum(exp_x)

    @staticmethod
    def _log_softmax(x: np.ndarray) -> np.ndarray:
        max_val = np.max(x)
        shifted = x - max_val
        return shifted - np.log(np.sum(np.exp(shifted)))

    def _tokenize_text(self, text: str) -> np.ndarray:
        tokens = self.tokenizer.encode(text, add_special_tokens=False)
        return np.array([tokens], dtype=np.int64)

    def _get_text_embedding(self, token_ids: np.ndarray) -> np.ndarray:
        return self.sessions["text_embedding"].run(None, {"input_ids": token_ids})[0]

    def _get_speech_embedding(self, token_ids: np.ndarray) -> np.ndarray:
        return self.sessions["llm_speech_embedding"].run(None, {"token": token_ids})[0]

    def _llm_inference(
        self,
        text: str,
        prompt_text: str,
        prompt_speech_tokens: np.ndarray,
        sampling_k: int = 25,
        max_len: int = 500,
        min_len: int = 10,
    ) -> np.ndarray:
        prompt_ids = self._tokenize_text(prompt_text)
        tts_ids = self._tokenize_text(text)
        tts_text_len = int(tts_ids.shape[1])

        combined_ids = np.concatenate([prompt_ids, tts_ids], axis=1)
        text_emb = self._get_text_embedding(combined_ids)
        sos_emb = self._get_speech_embedding(np.array([[self.sos]], dtype=np.int64))
        task_emb = self._get_speech_embedding(np.array([[self.task_id]], dtype=np.int64))

        if prompt_speech_tokens is not None and prompt_speech_tokens.shape[1] > 0:
            prompt_speech_emb = self._get_speech_embedding(prompt_speech_tokens)
        else:
            prompt_speech_emb = np.zeros((1, 0, self.hidden_dim), dtype=np.float32)

        lm_input = np.concatenate(
            [sos_emb, text_emb, task_emb, prompt_speech_emb], axis=1
        ).astype(np.float32)

        seq_len = int(lm_input.shape[1])
        attention_mask = np.ones((1, seq_len), dtype=np.float32)
        init_outputs = self.sessions["llm_backbone_initial"].run(
            None,
            {"inputs_embeds": lm_input, "attention_mask": attention_mask},
        )
        hidden_states = init_outputs[0]
        past_key_values = (
            init_outputs[1]
            if len(init_outputs) > 1
            else np.zeros((48, 1, 2, seq_len, 64), dtype=np.float32)
        )

        logits = self.sessions["llm_decoder"].run(
            None,
            {"hidden_state": hidden_states[:, -1:, :]},
        )[0]

        eff_min_len = max(min_len, int(tts_text_len * 2))
        eff_max_len = max(eff_min_len + 4, min(max_len, int(tts_text_len * 20)))
        safe_k = max(1, int(sampling_k))

        out_tokens: list[int] = []
        decode_sess = self.sessions["llm_backbone_decode"]
        decoder_head = self.sessions["llm_decoder"]

        for step_idx in range(eff_max_len):
            logp = self._log_softmax(logits.squeeze())
            top_k_idx = np.argsort(logp)[-safe_k:]
            top_k_probs = self._softmax(logp[top_k_idx])
            sampled_idx = int(np.random.choice(len(top_k_idx), p=top_k_probs))
            token_id = int(top_k_idx[sampled_idx])

            if token_id == self.eos_token and step_idx >= eff_min_len:
                break

            out_tokens.append(token_id)
            next_emb = self._get_speech_embedding(np.array([[token_id]], dtype=np.int64))
            total_len = seq_len + len(out_tokens)
            step_mask = np.ones((1, total_len), dtype=np.float32)

            step_outputs = decode_sess.run(
                None,
                {
                    "inputs_embeds": next_emb.astype(np.float32),
                    "attention_mask": step_mask,
                    "past_key_values": past_key_values,
                },
            )
            hidden_states = step_outputs[0]
            past_key_values = step_outputs[1]
            logits = decoder_head.run(None, {"hidden_state": hidden_states})[0]

        if not out_tokens:
            out_tokens = [0]
        return np.array([out_tokens], dtype=np.int64)

    def _flow_inference(
        self,
        speech_tokens: np.ndarray,
        embedding: np.ndarray,
        prompt_tokens: np.ndarray,
        prompt_mel: np.ndarray,
        n_timesteps: int = 10,
    ) -> np.ndarray:
        emb_norm = embedding / (np.linalg.norm(embedding, axis=1, keepdims=True) + 1e-8)
        spks = self.sessions["flow_speaker_projection"].run(
            None,
            {"embedding": emb_norm.astype(np.float32)},
        )[0]

        if prompt_tokens is not None and prompt_tokens.shape[1] > 0:
            all_tokens = np.concatenate([prompt_tokens, speech_tokens], axis=1)
            prompt_token_len = int(prompt_tokens.shape[1])
        else:
            all_tokens = speech_tokens
            prompt_token_len = 0

        token_embedded = self.sessions["flow_token_embedding"].run(
            None,
            {"token": all_tokens.astype(np.int64)},
        )[0]
        h = self.sessions["flow_pre_lookahead"].run(
            None,
            {"token_embedded": token_embedded.astype(np.float32)},
        )[0]

        token_mel_ratio = 2
        mel_len = int(h.shape[1])
        mel_len1 = prompt_token_len * token_mel_ratio if prompt_token_len > 0 else 0

        conds = np.zeros((1, 80, mel_len), dtype=np.float32)
        if prompt_mel is not None and prompt_mel.shape[1] > 0 and mel_len1 > 0:
            prompt_mel_t = prompt_mel.transpose(0, 2, 1)
            src_len = int(prompt_mel_t.shape[2])
            if src_len != mel_len1:
                zoom_factor = mel_len1 / float(src_len)
                resized = zoom(prompt_mel_t, (1, 1, zoom_factor), order=1)
                conds[:, :, :mel_len1] = resized[:, :, :mel_len1]
            else:
                conds[:, :, :mel_len1] = prompt_mel_t[:, :, :mel_len1]

        mu = h.transpose(0, 2, 1).astype(np.float32)
        mask = np.ones((1, 1, mel_len), dtype=np.float32)
        x = np.random.randn(1, 80, mel_len).astype(np.float32)

        x_batch = np.concatenate([x, x], axis=0)
        mask_batch = np.concatenate([mask, mask], axis=0)
        mu_batch = np.concatenate([mu, mu], axis=0)
        spks_batch = np.concatenate([spks, spks], axis=0).astype(np.float32)
        conds_batch = np.concatenate([conds, conds], axis=0)

        estimator = self.sessions["flow_estimator"]
        dt = 1.0 / float(n_timesteps)
        for step in range(n_timesteps):
            t_arr = np.array([step / float(n_timesteps)] * 2, dtype=np.float32)
            velocity = estimator.run(
                None,
                {
                    "x": x_batch,
                    "mask": mask_batch,
                    "mu": mu_batch,
                    "t": t_arr,
                    "spks": spks_batch,
                    "cond": conds_batch,
                },
            )[0]
            x_batch = x_batch + velocity * dt

        mel = x_batch[:1]
        if mel_len1 > 0 and mel.shape[2] > mel_len1:
            mel = mel[:, :, mel_len1:]
        return mel.astype(np.float32)

    @staticmethod
    def _stft_16(x: np.ndarray, n_fft: int = 16, hop_len: int = 4) -> tuple[np.ndarray, np.ndarray]:
        window = get_window("hann", n_fft, fftbins=True).astype(np.float32)
        sig = np.asarray(x, dtype=np.float32).reshape(-1)
        pad_len = n_fft // 2
        sig = np.pad(sig, (pad_len, pad_len), mode="reflect")
        frames = np.lib.stride_tricks.sliding_window_view(sig, n_fft)[::hop_len] * window
        spec = np.fft.rfft(frames, n=n_fft, axis=-1).T
        return np.real(spec).astype(np.float32), np.imag(spec).astype(np.float32)

    @staticmethod
    def _istft_16(
        magnitude: np.ndarray,
        phase: np.ndarray,
        n_fft: int = 16,
        hop_len: int = 4,
    ) -> np.ndarray:
        window = get_window("hann", n_fft, fftbins=True).astype(np.float32)
        mag = np.clip(magnitude, a_min=None, a_max=100.0)
        complex_spec = mag * np.exp(1j * phase)
        frames = np.fft.irfft(complex_spec.T, n=n_fft, axis=-1).astype(np.float32)
        win_frames = frames * window[np.newaxis, :]
        win_sq = (window ** 2).astype(np.float32)

        n_frames = win_frames.shape[0]
        output_len = n_fft + (n_frames - 1) * hop_len
        audio = np.zeros(output_len, dtype=np.float32)
        window_sum = np.zeros(output_len, dtype=np.float32)

        for idx in range(n_frames):
            start = idx * hop_len
            audio[start : start + n_fft] += win_frames[idx]
            window_sum[start : start + n_fft] += win_sq

        audio = audio / np.maximum(window_sum, 1e-8)
        return np.clip(audio, -0.99, 0.99).astype(np.float32)

    def _hift_inference(self, mel: np.ndarray) -> np.ndarray:
        f0 = self.sessions["hift_f0_predictor"].run(
            None,
            {"mel": mel.astype(np.float32)},
        )[0]
        f0_input = f0[:, np.newaxis, :].astype(np.float32)
        source = self.sessions["hift_source_generator"].run(
            None,
            {"f0": f0_input},
        )[0]
        stft_real, stft_imag = self._stft_16(source.squeeze(), n_fft=16, hop_len=4)
        source_stft = np.concatenate([stft_real, stft_imag], axis=0)[np.newaxis, :, :]
        outputs = self.sessions["hift_decoder"].run(
            None,
            {
                "mel": mel.astype(np.float32),
                "source_stft": source_stft.astype(np.float32),
            },
        )
        return self._istft_16(outputs[0].squeeze(0), outputs[1].squeeze(0), n_fft=16, hop_len=4)

    def synthesize_one(
        self,
        text: str,
        *,
        prompt_wav: Path,
        prompt_text: str,
        sampling_k: int = 25,
    ) -> np.ndarray:
        clean_target = _LANG_TAG_RE.sub("", text).strip()
        clean_prompt = _LANG_TAG_RE.sub("", prompt_text).strip()
        if not clean_prompt:
            clean_prompt = _DEFAULT_PROMPT_TRANSCRIPT

        spk_emb, prompt_tokens, prompt_mel = self._extract_prompt_features(prompt_wav)
        speech_tokens = self._llm_inference(
            clean_target,
            prompt_text=clean_prompt,
            prompt_speech_tokens=prompt_tokens,
            sampling_k=sampling_k,
        )
        mel = self._flow_inference(
            speech_tokens=speech_tokens,
            embedding=spk_emb,
            prompt_tokens=prompt_tokens,
            prompt_mel=prompt_mel,
            n_timesteps=10,
        )
        return self._hift_inference(mel)


class CosyVoiceEngine(BaseTTSEngine):
    """Motor CosyVoice3-ONNX para clonacion zero-shot cross-lingual y modulacion emocional."""

    engine_id = "cosyvoice"
    display_name = "CosyVoice3 0.5B Zero-Shot ONNX"
    category = "clone"
    estimated_mb = 3850.0
    license_name = "Apache-2.0"
    description = (
        "Clonacion de voz zero-shot cross-lingual y control emocional en espanol "
        "100% sobre ONNX Runtime (14 subgrafos sin dependencia de PyTorch)."
    )

    def __init__(
        self,
        models_link_dir: Path | None = None,
        brains_dir: Path | None = None,
        *,
        prefer_dml: bool = False,
    ) -> None:
        self._models_link_dir = models_link_dir if models_link_dir is not None else MODELS_LINK_DIR
        self._brains_dir = brains_dir if brains_dir is not None else BRAINS_SPACE_DIR
        self._prefer_dml = prefer_dml
        self._pipeline: _CosyVoiceOnnxPipeline | None = None
        self._provider: str | None = None

    def resolve_model_dir(self) -> Path | None:
        """Detecta CosyVoice3-ONNX verificando los 14 archivos ONNX en raiz o subcarpeta onnx/."""
        for base in (self._models_link_dir, self._brains_dir):
            folder = base / "CosyVoice3-ONNX"
            if not folder.is_dir():
                continue
            if _CosyVoiceOnnxPipeline.resolve_tokenizer_dir(folder) is None:
                continue
            all_present = all(
                _CosyVoiceOnnxPipeline.resolve_onnx_file(folder, cands) is not None
                for cands in _REQUIRED_ONNX_SPECS.values()
            )
            if all_present:
                return folder
        return None

    def is_available(self) -> bool:
        """Retorna True si los 14 grafos ONNX y vocab.json estan disponibles localmente."""
        return self.resolve_model_dir() is not None

    def availability_note(self) -> str:
        """Describe estado de disponibilidad local de los 14 archivos ONNX."""
        resolved = self.resolve_model_dir()
        if resolved is not None:
            return (
                f"14 modelos ONNX y tokenizador Qwen2 verificados localmente en: {resolved}"
            )
        return (
            "Faltan archivos ONNX o vocab.json en models_link/CosyVoice3-ONNX. "
            "Ejecute scripts/setup_links.ps1."
        )

    def get_voices(self) -> list[VoiceDescriptor]:
        """Expone perfiles zero-shot incluidos y ranura de clonacion personalizada."""
        return [
            VoiceDescriptor(
                id="cosy_nova_es",
                name="Nova Cross-Lingual",
                engine=self.engine_id,
                region="MULTI",
                gender="F",
                sample_rate=COSYVOICE_SAMPLE_RATE,
                quality="studio",
                description=(
                    "Perfil femenino calido cross-lingual al espanol con soporte de "
                    "emociones y reemplazo de audio de referencia."
                ),
                supports_cloning=True,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="cosy_onyx_es",
                name="Onyx Cross-Lingual",
                engine=self.engine_id,
                region="MULTI",
                gender="M",
                sample_rate=COSYVOICE_SAMPLE_RATE,
                quality="studio",
                description=(
                    "Perfil masculino profundo cross-lingual al espanol con soporte de "
                    "emociones y reemplazo de audio de referencia."
                ),
                supports_cloning=True,
                supports_emotion=True,
            ),
            VoiceDescriptor(
                id="cosy_custom_clone",
                name="Clonacion Zero-Shot Usuario",
                engine=self.engine_id,
                region="MULTI",
                gender="MIX",
                sample_rate=COSYVOICE_SAMPLE_RATE,
                quality="studio",
                description=(
                    "Clonacion zero-shot personalizada a partir de 3-10 s de audio WAV "
                    "y su transcripcion de referencia."
                ),
                supports_cloning=True,
                supports_emotion=True,
            ),
        ]

    def load(self) -> str:
        """Carga las 14 sesiones ONNX y el tokenizador local."""
        if self._pipeline is not None and self._provider is not None:
            return self._provider

        model_dir = self.resolve_model_dir()
        if model_dir is None:
            raise FileNotFoundError(self.availability_note())

        self._pipeline = _CosyVoiceOnnxPipeline(model_dir, prefer_dml=self._prefer_dml)
        self._provider = self._pipeline.active_provider
        logger.info("CosyVoice3-ONNX cargado en %s.", self._provider)
        return self._provider

    def unload(self) -> None:
        """Cierra las 14 sesiones ONNX y libera ~3.8 GB de memoria."""
        if self._pipeline is not None:
            self._pipeline.close()
        self._pipeline = None
        self._provider = None
        gc.collect()

    def _resolve_prompt(
        self,
        model_dir: Path,
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[Path, str]:
        """Determina el archivo WAV de referencia y su transcripcion exacta."""
        if params.reference_wav_path:
            user_wav = Path(params.reference_wav_path)
            if not user_wav.is_file():
                raise FileNotFoundError(f"Audio de referencia no encontrado: {user_wav}")
            user_text = (params.reference_text or "").strip()
            if not user_text:
                raise ValueError(
                    "CosyVoice3 zero-shot requiere 'reference_text' (transcripcion del audio "
                    "de referencia) cuando se suministra 'reference_wav_path'."
                )
            return user_wav, user_text

        prompts_dir = model_dir / "prompts"
        if not prompts_dir.is_dir():
            prompts_dir = model_dir / "onnx" / "prompts"

        clean_voice = (voice_id or "cosy_nova_es").strip()
        if clean_voice == "cosy_onyx_es":
            wav_path = prompts_dir / "en_male_onyx_greeting.wav"
        elif clean_voice in ("cosy_nova_es", "cosy_custom_clone"):
            wav_path = prompts_dir / "en_female_nova_greeting.wav"
        else:
            valid = [v.id for v in self.get_voices()]
            raise ValueError(f"Voz CosyVoice '{clean_voice}' no valida. Opciones: {valid}")

        if not wav_path.is_file():
            raise FileNotFoundError(f"Prompt integrado no encontrado en: {wav_path}")

        return wav_path, _DEFAULT_PROMPT_TRANSCRIPT

    def synthesize_raw(
        self,
        chunks: list[str],
        voice_id: str,
        params: SynthesisParams,
    ) -> tuple[list[np.ndarray], int, str, str]:
        """Sintetiza fragmentos en espanol con clonacion zero-shot y estilo emocional."""
        if self._pipeline is None or self._provider is None:
            self.load()

        assert self._pipeline is not None
        prompt_wav, prompt_text = self._resolve_prompt(
            self._pipeline.model_dir,
            voice_id=voice_id,
            params=params,
        )

        emotion_key = (params.emotion or "neutral").strip().lower()
        profile = _EMOTION_PROFILES.get(emotion_key, _EMOTION_PROFILES["neutral"])
        sampling_k = int(profile["sampling_k"])
        eff_speed = float(np.clip(float(params.speed) * float(profile["speed_factor"]), 0.5, 2.0))
        gain = float(profile["gain"])

        audio_arrays: list[np.ndarray] = []
        for chunk_text in chunks:
            clean_chunk = _LANG_TAG_RE.sub("", chunk_text).strip()
            if not clean_chunk or not any(ch.isalnum() for ch in clean_chunk):
                continue

            wav = self._pipeline.synthesize_one(
                clean_chunk,
                prompt_wav=prompt_wav,
                prompt_text=prompt_text,
                sampling_k=sampling_k,
            )
            wav = _stretch_waveform_linear(wav, eff_speed) * gain
            if wav.size > 0:
                audio_arrays.append(np.clip(wav, -1.0, 1.0).astype(np.float32, copy=False))

        if not audio_arrays:
            raise ValueError("CosyVoice3-ONNX no genero muestras de audio validas.")

        selected_id = (voice_id or "cosy_nova_es").strip()
        model_origin = f"CosyVoice3-0.5B-ONNX ({selected_id}, emotion={emotion_key})"
        return (
            audio_arrays,
            COSYVOICE_SAMPLE_RATE,
            model_origin,
            self._provider or "CPUExecutionProvider",
        )
