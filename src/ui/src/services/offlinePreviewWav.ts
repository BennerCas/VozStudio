import type { LibraryItem } from '../types/tts';

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Genera una senal acustica armónica PCM 16-bit WAV en memoria cuando la interfaz
 * opera en modo OFFLINE PREVIEW (sin backend activo) para pruebas estaticas e inspeccion.
 */
export function buildCalibratedPreviewItem(params: {
  text: string;
  engineId: string;
  engineName: string;
  voiceId: string;
  sampleRate: number;
  speed: number;
  pitchSemitones: number;
  emotion: string | null;
  mode: 'sintesis' | 'clonacion';
}): { item: LibraryItem; peaks: number[] } {
  const sr = params.sampleRate || 24000;
  const words = Math.max(1, params.text.trim().split(/\s+/).length);
  const durationSec = Math.max(1.4, Math.min(6.0, (words * 0.34) / Math.max(0.5, params.speed)));
  const totalSamples = Math.floor(sr * durationSec);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const pitchRatio = Math.pow(2, params.pitchSemitones / 12);
  const baseFreq = (params.voiceId.includes('m') ? 132 : 196) * pitchRatio;
  const peaks: number[] = [];
  const buckets = 96;
  const bucketSize = Math.max(1, Math.floor(totalSamples / buckets));
  let bucketMax = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const syllableEnv = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.4 * t) * Math.cos(2 * Math.PI * 1.1 * t);
    const fadeIn = Math.min(1, t / 0.06);
    const fadeOut = Math.min(1, (durationSec - t) / 0.12);
    const env = Math.max(0, syllableEnv * fadeIn * fadeOut);
    const harmonic =
      0.62 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.26 * Math.sin(2 * Math.PI * baseFreq * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * baseFreq * 3 * t);
    const sample = Math.max(-0.92, Math.min(0.92, harmonic * env * 0.55));
    const absVal = Math.abs(sample);
    if (absVal > bucketMax) bucketMax = absVal;

    if ((i + 1) % bucketSize === 0 && peaks.length < buckets) {
      peaks.push(Number(bucketMax.toFixed(3)));
      bucketMax = 0;
    }

    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  while (peaks.length < buckets) {
    peaks.push(0.18);
  }

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const filename = `${stamp}_audio_${params.mode}_${params.engineId}_preview.wav`;
  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));

  const item: LibraryItem = {
    id: `preview_${Date.now()}`,
    archivo: filename,
    json_archivo: filename.replace(/\.wav$/, '.json'),
    audio_url: blobUrl,
    modelo_origen: params.engineName,
    motor: params.engineId,
    voz_id: params.voiceId,
    parametros: {
      speed: params.speed,
      pitch_semitones: params.pitchSemitones,
      emotion: params.emotion ?? 'neutro',
      sample_rate: sr,
      modo: params.mode,
    },
    prompt_original: params.text,
    metricas: {
      caracteres_entrada: params.text.length,
      fragmentos: Math.max(1, Math.ceil(params.text.length / 260)),
      duracion_audio_seg: Number(durationSec.toFixed(2)),
      tiempo_inferencia_ms: 38,
      rtf: 0.024,
      pico_memoria_mb: 326,
    },
    contexto: {
      app: 'VozStudio Omni-ES',
      modo_ejecucion: 'OFFLINE_PREVIEW_CALIBRATION',
      fecha_iso: now.toISOString(),
    },
  };

  return { item, peaks };
}
