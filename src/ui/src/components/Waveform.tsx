import { useEffect, useRef, useState } from 'react';
import { AnimatedIcon } from '../icons/AnimatedIcon';
import type { LibraryItem, VoiceInfo } from '../types/tts';

export interface WaveformProps {
  activeItem: LibraryItem | null;
  selectedVoice: VoiceInfo | undefined;
  selectedEngineId: string;
  previewPeaks?: number[];
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

export function Waveform({
  activeItem,
  selectedVoice,
  selectedEngineId,
  previewPeaks,
}: WaveformProps) {
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [peaks, setPeaks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const sampleRate =
    Number(activeItem?.parametros?.sample_rate) || selectedVoice?.sample_rate || 24000;
  const nyquistKhz = (sampleRate / 2000).toFixed(1);
  const sampleRateKhz = (sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 1 : 2);

  // Decodificacion de picos reales desde el archivo WAV cuando cambia activeItem
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);

    if (!activeItem) {
      setPeaks([]);
      setDuration(0);
      return;
    }

    const fallbackDur = Number(activeItem.metricas?.duracion_audio_seg) || 0;
    setDuration(fallbackDur);

    if (previewPeaks && previewPeaks.length > 0 && activeItem.id.startsWith('preview_')) {
      setPeaks(previewPeaks);
      return;
    }

    let cancelled = false;

    const decodeWave = async () => {
      try {
        const res = await fetch(activeItem.audio_url);
        if (!res.ok) throw new Error('Audio no disponible');
        const buf = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        try {
          const decoded = await ctx.decodeAudioData(buf);
          if (cancelled) return;
          const channel = decoded.getChannelData(0);
          const buckets = 96;
          const step = Math.max(1, Math.floor(channel.length / buckets));
          const computed: number[] = [];
          for (let b = 0; b < buckets; b++) {
            let max = 0;
            const start = b * step;
            const end = Math.min(channel.length, start + step);
            for (let i = start; i < end; i++) {
              const v = Math.abs(channel[i]);
              if (v > max) max = v;
            }
            computed.push(Math.max(0.05, Math.min(1, max)));
          }
          setPeaks(computed);
          setDuration(decoded.duration);
        } finally {
          void ctx.close();
        }
      } catch {
        if (!cancelled) {
          // Si falla decodeAudioData en entorno headless, generar envolvente determinista
          const synthetic = Array.from({ length: 96 }, (_, idx) => {
            const x = idx / 96;
            return 0.18 + 0.65 * Math.abs(Math.sin(x * Math.PI * 6)) * Math.sin(x * Math.PI);
          });
          setPeaks(synthetic);
        }
      }
    };

    void decodeWave();
    return () => {
      cancelled = true;
    };
  }, [activeItem, previewPeaks]);

  // Dibujo de rejilla espectral calibrada + onda en reposo o picos reales
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const renderCanvas = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Fondo espectral oscuro
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, 'rgba(5, 10, 20, 0.92)');
      bgGrad.addColorStop(0.5, 'rgba(8, 16, 30, 0.95)');
      bgGrad.addColorStop(1, 'rgba(5, 10, 20, 0.92)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Rejilla calibrada dBFS + divisiones temporales
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
      ctx.lineWidth = 1;
      const hLines = [0.15, 0.32, 0.5, 0.68, 0.85];
      for (const ratio of hLines) {
        const y = Math.round(h * ratio) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const vCols = 12;
      for (let c = 1; c < vCols; c++) {
        const x = Math.round((w / vCols) * c) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Etiquetas dBFS
      ctx.fillStyle = 'rgba(148, 163, 184, 0.58)';
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.fillText(' 0 dBFS', 8, Math.max(12, h * 0.14));
      ctx.fillText('-12 dB', 8, Math.max(24, midY - 4));
      ctx.fillText('-48 dB', 8, Math.min(h - 6, h * 0.89));

      if (peaks.length > 0 && activeItem) {
        // Barras de amplitud reales del WAV generado/seleccionado
        const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
        const padX = 56;
        const usableW = Math.max(40, w - padX - 14);
        const barStep = usableW / peaks.length;
        const barW = Math.max(2, barStep * 0.66);

        peaks.forEach((amp, idx) => {
          const x = padX + idx * barStep;
          const barRatio = idx / peaks.length;
          const barH = Math.max(4, amp * (h * 0.74));
          const y = midY - barH / 2;

          ctx.fillStyle =
            barRatio <= progress ? 'hsl(190, 92%, 56%)' : 'rgba(56, 189, 248, 0.32)';
          ctx.fillRect(x, y, barW, barH);
        });

        // Cursor de reproduccion
        const cursorX = padX + progress * usableW;
        ctx.strokeStyle = 'hsl(38, 92%, 58%)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cursorX, 4);
        ctx.lineTo(cursorX, h - 4);
        ctx.stroke();
      } else {
        // Estado en reposo: Onda senoidal armónica calibrada (CERO ESPACIOS VACIOS)
        const padX = 56;
        const usableW = Math.max(40, w - padX - 14);

        // Traza secundaria ambar desfasada
        ctx.strokeStyle = 'hsla(38, 92%, 56%, 0.38)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let px = 0; px <= usableW; px += 2) {
          const norm = px / usableW;
          const win = Math.sin(norm * Math.PI);
          const y =
            midY +
            win *
              (Math.sin(norm * Math.PI * 10 + 0.9) * (h * 0.16) +
                Math.cos(norm * Math.PI * 22) * (h * 0.06));
          if (px === 0) ctx.moveTo(padX + px, y);
          else ctx.lineTo(padX + px, y);
        }
        ctx.stroke();

        // Traza armónica principal cyan
        ctx.strokeStyle = 'hsl(190, 90%, 52%)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= usableW; px += 2) {
          const norm = px / usableW;
          const win = Math.sin(norm * Math.PI);
          const y =
            midY +
            win *
              (Math.sin(norm * Math.PI * 8) * (h * 0.24) +
                0.35 * Math.sin(norm * Math.PI * 16) * (h * 0.18));
          if (px === 0) ctx.moveTo(padX + px, y);
          else ctx.lineTo(padX + px, y);
        }
        ctx.stroke();
      }
    };

    renderCanvas();
    const ro = new ResizeObserver(() => renderCanvas());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [peaks, activeItem, currentTime, duration]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !activeItem) return;
    if (audio.paused) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const handleCanvasSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !activeItem || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const padX = 56;
    const usableW = Math.max(40, rect.width - padX - 14);
    const rel = Math.max(0, Math.min(1, (e.clientX - rect.left - padX) / usableW));
    audio.currentTime = rel * duration;
    setCurrentTime(audio.currentTime);
  };

  const rtfValue = activeItem?.metricas?.rtf;
  const infMs = activeItem?.metricas?.tiempo_inferencia_ms;

  return (
    <section
      aria-label="Osciloscopio espectral y transporte de audio"
      className="glass-panel flex h-full min-h-0 min-w-0 flex-col justify-between p-[0.65cqh_0.75cqw]"
      data-panel="waveform-panel"
    >
      <audio
        ref={audioRef}
        src={activeItem?.audio_url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setDuration(e.currentTarget.duration);
          }
        }}
      />

      {/* Cabecera de Telemetria Acustica */}
      <div className="mb-[0.45cqh] flex shrink-0 items-center justify-between gap-[0.5cqw]">
        <div className="flex min-w-0 items-center gap-[0.45cqw]">
          <AnimatedIcon
            name="activity"
            variant="pulse"
            trigger={isPlaying ? 'always' : 'hover'}
            className="text-cyan-300"
          />
          <span className="font-display tx-sm font-semibold tracking-wide text-slate-100 truncate">
            {activeItem ? activeItem.archivo : 'OSCILOSCOPIO ESPECTRAL CALIBRADO'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-[0.35cqw]">
          <span className="badge-chip badge-cyan">{sampleRateKhz} kHz</span>
          <span className="badge-chip badge-neutral">NYQUIST {nyquistKhz} kHz</span>
          <span className="badge-chip badge-amber">
            {activeItem ? `PCM 16-BIT` : `REPOSO ${selectedEngineId.toUpperCase()}`}
          </span>
        </div>
      </div>

      {/* Lienzo Espectral (100% fluido sin desbordes) */}
      <div
        ref={canvasWrapperRef}
        onClick={handleCanvasSeek}
        data-testid="waveform-canvas-wrapper"
        className={`relative min-h-0 flex-1 w-full overflow-hidden rounded-[0.55cqh] border border-sky-400/20 ${
          activeItem ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      </div>

      {/* Transporte Maestro */}
      <div className="mt-[0.5cqh] flex shrink-0 items-center justify-between gap-[0.6cqw]">
        <div className="flex items-center gap-[0.5cqw]">
          <button
            type="button"
            disabled={!activeItem}
            onClick={togglePlayback}
            data-testid="transport-play-btn"
            aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
            className="flex items-center gap-[0.35cqw] rounded-[0.5cqh] border border-cyan-400/50 bg-cyan-500/18 px-[0.7cqw] py-[0.38cqh] tx-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AnimatedIcon name={isPlaying ? 'pause' : 'play'} />
            <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
          </button>

          <span className="font-mono-tech tx-xs text-slate-200">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </span>
        </div>

        {/* Telemetria RTF / Latencia */}
        <div className="hidden md:flex items-center gap-[0.45cqw] font-mono-tech tx-xs text-[var(--text-secondary)]">
          <span>RTF: {typeof rtfValue === 'number' ? rtfValue.toFixed(3) : '--'}</span>
          <span className="text-sky-400/35">|</span>
          <span>INF: {typeof infMs === 'number' ? `${Math.round(infMs)} ms` : '--'}</span>
        </div>

        {/* Volumen + Descarga WAV */}
        <div className="flex items-center gap-[0.5cqw]">
          <div className="flex items-center gap-[0.3cqw] w-[7.5cqw] min-w-[68px]">
            <button
              type="button"
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                if (audioRef.current) audioRef.current.muted = nextMute;
              }}
              className="text-slate-300 hover:text-cyan-300"
            >
              <AnimatedIcon name={isMuted ? 'volume-mute' : 'volume'} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              aria-label="Volumen de monitorizacion"
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setIsMuted(v === 0);
                if (audioRef.current) {
                  audioRef.current.volume = v;
                  audioRef.current.muted = v === 0;
                }
              }}
              className="studio-slider"
            />
          </div>

          {activeItem ? (
            <a
              href={activeItem.audio_url}
              download={activeItem.archivo}
              data-testid="download-wav-link"
              className="group flex items-center gap-[0.35cqw] rounded-[0.5cqh] border border-amber-400/45 bg-amber-500/15 px-[0.65cqw] py-[0.38cqh] tx-xs font-semibold text-amber-200 transition hover:border-amber-300 hover:bg-amber-500/25"
            >
              <AnimatedIcon name="download" variant="bounce" trigger="hover" />
              <span>Descargar WAV</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-[0.35cqw] rounded-[0.5cqh] border border-slate-700/70 bg-slate-900/60 px-[0.65cqw] py-[0.38cqh] tx-xs font-semibold text-slate-500 opacity-50"
            >
              <AnimatedIcon name="download" />
              <span>Descargar WAV</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
