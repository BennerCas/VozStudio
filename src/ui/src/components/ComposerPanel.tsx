import { useMemo } from 'react';
import { PRESET_SCRIPTS } from '../data/fallbackCatalog';
import { AnimatedIcon } from '../icons/AnimatedIcon';
import { MAX_BLOCK_CHARS } from '../utils/textSegmenter';

export interface ComposerPanelProps {
  blocks: string[];
  activeBlockIndex: number;
  speed: number;
  pitchSemitones: number;
  emotion: string;
  isSynthesizing: boolean;
  onChangeActiveBlock: (value: string) => void;
  onSelectBlock: (index: number) => void;
  onLoadPreset: (text: string) => void;
  onClearText: () => void;
  onSpeedChange: (val: number) => void;
  onPitchChange: (val: number) => void;
  onEmotionChange: (val: string) => void;
  onSynthesizeActiveBlock: () => void;
  onSynthesizeFullDocument: () => void;
}

const EMOTIONS = ['neutro', 'narrativo', 'calido', 'informativo', 'expresivo'] as const;

export function ComposerPanel({
  blocks,
  activeBlockIndex,
  speed,
  pitchSemitones,
  emotion,
  isSynthesizing,
  onChangeActiveBlock,
  onSelectBlock,
  onLoadPreset,
  onClearText,
  onSpeedChange,
  onPitchChange,
  onEmotionChange,
  onSynthesizeActiveBlock,
  onSynthesizeFullDocument,
}: ComposerPanelProps) {
  const safeIndex = Math.min(Math.max(0, activeBlockIndex), Math.max(0, blocks.length - 1));
  const currentText = blocks[safeIndex] ?? '';

  const totalDocumentChars = useMemo(
    () => blocks.reduce((acc, item) => acc + item.length, 0),
    [blocks],
  );

  // Ventana deslizante de chips Bloque k/N para que jamas desborde horizontalmente
  const visibleChipIndices = useMemo(() => {
    const maxVisible = 4;
    if (blocks.length <= maxVisible) {
      return blocks.map((_, idx) => idx);
    }
    let start = Math.max(0, safeIndex - 1);
    if (start + maxVisible > blocks.length) {
      start = blocks.length - maxVisible;
    }
    return Array.from({ length: maxVisible }, (_, i) => start + i);
  }, [blocks, safeIndex]);

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.55cqh] overflow-hidden"
      data-testid="direct-composer-panel"
    >
      {/* Barra superior: Presets en espanol + Contador de caracteres */}
      <div className="flex shrink-0 items-center justify-between gap-[0.4cqw]">
        <div className="flex min-w-0 items-center gap-[0.35cqw]">
          {PRESET_SCRIPTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-testid={`preset-${preset.id}`}
              onClick={() => onLoadPreset(preset.text)}
              className="rounded-[0.45cqh] border border-sky-400/20 bg-slate-950/65 px-[0.55cqw] py-[0.28cqh] tx-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/12 hover:text-cyan-200 truncate"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            data-testid="clear-composer-btn"
            onClick={onClearText}
            className="rounded-[0.45cqh] border border-slate-700/70 bg-slate-950/55 px-[0.5cqw] py-[0.28cqh] tx-xs text-slate-400 transition hover:border-amber-400/45 hover:text-amber-200"
          >
            Limpiar
          </button>
        </div>

        <div className="font-mono-tech shrink-0 tx-xs text-[var(--text-secondary)]">
          <span>
            BLOQUE {currentText.length}/{MAX_BLOCK_CHARS}
          </span>
          <span className="mx-[0.35cqw] text-sky-400/40">|</span>
          <span className="text-cyan-300">TOTAL {totalDocumentChars} CAR.</span>
        </div>
      </div>

      {/* Barra de Chips Paginados de Bloques (Bloque 1/N) */}
      <div
        className="flex shrink-0 items-center justify-between gap-[0.4cqw] rounded-[0.5cqh] border border-sky-400/15 bg-slate-950/55 px-[0.55cqw] py-[0.3cqh]"
        data-testid="composer-blocks-bar"
      >
        <div className="flex min-w-0 items-center gap-[0.3cqw] overflow-hidden">
          <AnimatedIcon name="layers" className="text-cyan-300" />
          <span className="tx-xs font-semibold text-slate-300 shrink-0">Segmentos:</span>

          <div className="flex items-center gap-[0.28cqw] overflow-hidden">
            {visibleChipIndices.map((idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  data-testid={`block-chip-${idx + 1}`}
                  onClick={() => onSelectBlock(idx)}
                  className={`rounded-[0.38cqh] border px-[0.5cqw] py-[0.18cqh] font-mono-tech text-[clamp(8px,0.95cqh,12px)] font-semibold transition whitespace-nowrap ${
                    active
                      ? 'border-cyan-400/75 bg-cyan-400/20 text-cyan-200'
                      : 'border-sky-400/15 bg-slate-900/70 text-slate-400 hover:border-sky-400/35 hover:text-slate-200'
                  }`}
                >
                  Bloque {idx + 1}/{blocks.length}
                </button>
              );
            })}
          </div>
        </div>

        {blocks.length > 1 && (
          <div className="flex shrink-0 items-center gap-[0.25cqw]">
            <button
              type="button"
              disabled={safeIndex <= 0}
              onClick={() => onSelectBlock(safeIndex - 1)}
              aria-label="Bloque anterior"
              data-testid="block-prev-btn"
              className="flex h-[2.1cqh] w-[2.1cqh] min-h-[16px] min-w-[16px] items-center justify-center rounded border border-sky-400/25 bg-slate-900 text-sky-300 disabled:opacity-35"
            >
              <AnimatedIcon name="chevron-left" className="!w-[1.2cqh] !h-[1.2cqh]" />
            </button>
            <button
              type="button"
              disabled={safeIndex >= blocks.length - 1}
              onClick={() => onSelectBlock(safeIndex + 1)}
              aria-label="Bloque siguiente"
              data-testid="block-next-btn"
              className="flex h-[2.1cqh] w-[2.1cqh] min-h-[16px] min-w-[16px] items-center justify-center rounded border border-sky-400/25 bg-slate-900 text-sky-300 disabled:opacity-35"
            >
              <AnimatedIcon name="chevron-right" className="!w-[1.2cqh] !h-[1.2cqh]" />
            </button>
          </div>
        )}
      </div>

      {/* Editor sin scroll (overflow: hidden; resize: none) */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <label htmlFor="studio-script-textarea" className="sr-only">
          Guion en espanol para sintetizar
        </label>
        <textarea
          id="studio-script-textarea"
          data-testid="composer-textarea"
          className="studio-textarea"
          value={currentText}
          onChange={(e) => onChangeActiveBlock(e.target.value)}
          placeholder="Escriba o pegue su guion en espanol. Textos extensos se dividen automaticamente en bloques paginados sin scroll..."
          spellCheck={false}
        />
      </div>

      {/* Controles de Prosodia + Botones de Sintesis */}
      <div className="grid shrink-0 grid-cols-12 items-center gap-[0.55cqw] rounded-[0.6cqh] border border-sky-400/15 bg-slate-950/60 px-[0.65cqw] py-[0.5cqh]">
        {/* Velocidad */}
        <div className="col-span-3 flex min-w-0 flex-col">
          <div className="flex items-center justify-between font-mono-tech tx-xs">
            <label htmlFor="speed-slider" className="text-[var(--text-muted)]">
              VELOCIDAD
            </label>
            <span className="text-cyan-300">{speed.toFixed(2)}x</span>
          </div>
          <input
            id="speed-slider"
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="studio-slider mt-[0.35cqh]"
          />
        </div>

        {/* Tono */}
        <div className="col-span-3 flex min-w-0 flex-col">
          <div className="flex items-center justify-between font-mono-tech tx-xs">
            <label htmlFor="pitch-slider" className="text-[var(--text-muted)]">
              TONO
            </label>
            <span className="text-amber-300">
              {pitchSemitones > 0 ? `+${pitchSemitones.toFixed(1)}` : pitchSemitones.toFixed(1)} st
            </span>
          </div>
          <input
            id="pitch-slider"
            type="range"
            min={-6}
            max={6}
            step={0.5}
            value={pitchSemitones}
            onChange={(e) => onPitchChange(Number(e.target.value))}
            className="studio-slider mt-[0.35cqh]"
          />
        </div>

        {/* Estilo Prosodico */}
        <div className="col-span-2 flex min-w-0 flex-col">
          <label
            htmlFor="emotion-select"
            className="font-mono-tech tx-xs text-[var(--text-muted)] truncate"
          >
            MATIZ
          </label>
          <select
            id="emotion-select"
            value={emotion}
            onChange={(e) => onEmotionChange(e.target.value)}
            className="mt-[0.15cqh] rounded-[0.4cqh] border border-sky-400/25 bg-slate-900 px-[0.35cqw] py-[0.22cqh] tx-xs font-medium text-slate-100 uppercase"
          >
            {EMOTIONS.map((emo) => (
              <option key={emo} value={emo} className="bg-slate-950 text-slate-100">
                {emo.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Acciones de Sintesis */}
        <div className="col-span-4 flex items-center justify-end gap-[0.38cqw]">
          {blocks.length > 1 && (
            <button
              type="button"
              disabled={isSynthesizing || currentText.trim().length === 0}
              onClick={onSynthesizeActiveBlock}
              data-testid="synthesize-block-btn"
              className="rounded-[0.5cqh] border border-cyan-400/40 bg-cyan-500/12 px-[0.55cqw] py-[0.55cqh] tx-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/22 disabled:opacity-40 whitespace-nowrap"
            >
              Bloque {safeIndex + 1}
            </button>
          )}

          <button
            type="button"
            disabled={isSynthesizing || totalDocumentChars === 0}
            onClick={onSynthesizeFullDocument}
            data-testid="synthesize-main-btn"
            className="flex flex-1 items-center justify-center gap-[0.4cqw] rounded-[0.55cqh] border border-cyan-300/60 bg-gradient-to-r from-cyan-400 to-sky-400 px-[0.75cqw] py-[0.58cqh] tx-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(12,211,245,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
          >
            <AnimatedIcon
              name={isSynthesizing ? 'loader' : 'audio-lines'}
              variant={isSynthesizing ? 'spin' : 'oscillate'}
              trigger={isSynthesizing ? 'always' : 'hover'}
              className="text-slate-950"
            />
            <span>
              {isSynthesizing
                ? 'Sintetizando...'
                : blocks.length > 1
                  ? `Sintetizar Todo (${blocks.length})`
                  : 'Sintetizar Audio'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
