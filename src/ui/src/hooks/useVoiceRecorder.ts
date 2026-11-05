import { useCallback, useEffect, useRef, useState } from 'react';
import { audioBufferToWavBlob } from '../utils/wavEncoder';

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  durationSec: number;
  audioLevel: number; // 0.0 a 1.0 para vumetro reactivo
  recordedFile: File | null;
  recordedUrl: string | null;
  isPlaying: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearRecording: () => void;
  playRecorded: () => void;
  stopPlayback: () => void;
  setRecordedFromBlob: (blob: Blob, filename?: string) => Promise<void>;
}

const MAX_RECORDING_SEC = 15;

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => undefined);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const updateLevelMeter = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    // Normalizar a 0.0 - 1.0 con respuesta logaritmica suave
    const normalized = Math.min(1.0, Math.pow(avg / 128.0, 1.4));
    setAudioLevel(normalized);

    animFrameRef.current = requestAnimationFrame(updateLevelMeter);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Fallback defensivo
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setAudioLevel(0);
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    clearRecording();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('El navegador no soporta captura de microfono.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 24000,
        },
      });

      mediaStreamRef.current = stream;

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const rawBlob = new Blob(recordedChunksRef.current, {
            type: mimeType || 'audio/webm',
          });
          const arrayBuf = await rawBlob.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arrayBuf);
          const wavBlob = audioBufferToWavBlob(decoded);
          const dateStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
          const file = new File([wavBlob], `grabacion_${dateStr}.wav`, {
            type: 'audio/wav',
          });

          const url = URL.createObjectURL(wavBlob);
          setRecordedFile(file);
          setRecordedUrl(url);
        } catch (decodeErr) {
          setError(
            decodeErr instanceof Error
              ? `Fallo al procesar audio: ${decodeErr.message}`
              : 'Error al decodificar audio de microfono.',
          );
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setDurationSec(0);

      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setDurationSec(Math.min(MAX_RECORDING_SEC, elapsed));
        if (elapsed >= MAX_RECORDING_SEC) {
          stopRecording();
        }
      }, 100);

      animFrameRef.current = requestAnimationFrame(updateLevelMeter);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permiso de microfono denegado por el usuario.'
          : err instanceof Error
            ? err.message
            : 'No se pudo acceder al microfono.';
      setError(msg);
      setIsRecording(false);
    }
  }, [updateLevelMeter, stopRecording]);

  const clearRecording = useCallback(() => {
    stopRecording();
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedFile(null);
    setRecordedUrl(null);
    setDurationSec(0);
    setAudioLevel(0);
    setError(null);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setIsPlaying(false);
  }, [stopRecording, recordedUrl]);

  const playRecorded = useCallback(() => {
    if (!recordedUrl) return;
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    const audio = new Audio(recordedUrl);
    audioElementRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [recordedUrl]);

  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const setRecordedFromBlob = useCallback(async (blob: Blob, filename = 'audio_procesado.wav') => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    const file = new File([blob], filename, { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    setRecordedFile(file);
    setRecordedUrl(url);
  }, [recordedUrl]);

  return {
    isRecording,
    durationSec,
    audioLevel,
    recordedFile,
    recordedUrl,
    isPlaying,
    error,
    startRecording,
    stopRecording,
    clearRecording,
    playRecorded,
    stopPlayback,
    setRecordedFromBlob,
  };
}
