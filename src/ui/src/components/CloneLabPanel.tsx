import { useMemo, useRef } from 'react';
import { AnimatedIcon } from '../icons/AnimatedIcon';

export interface CloneLabPanelProps {
  selectedEngineId: string;
  selectedVoiceId: string;
  referenceFile: File | null;
  referenceText: string;
  cloneBlocks: string[];
  activeCloneBlockIndex: number;
  speed: number;
  emotion: string;
  isCloning: boolean;
  onSwitchToCloningEngine: (engineId: string) => void;
  onReferenceFileChange: (file: File | null) => void;
  onReferenceTextChange: (value: string) => void;
  onChangeCloneBlock: (value: string) => void;
  onSelectCloneBlock: (index: number) => void;
  onSpeedChange: (val: number) => void;
  onEmotionChange: (val: string) => void;
  onRunClone: () => void;
}

export function CloneLabPanel({
  selectedEngineId,
  selectedVoiceId,
  referenceFile,
  referenceText,
  cloneBlocks,
  activeCloneBlockIndex,
  speed,
  emotion,
  isCloning,
  onSwitchToCloningEngine,
  onReferenceFileChange,
  onReferenceTextChange,
  onChangeCloneBlock,
  onSelectCloneBlock,
  onSpeedChange,
  onEmotionChange,
  onRunClone,
}: CloneLabPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNativeCloningEngine =
    selectedEngineId === 'f5_spanish' || selectedEngineId === 'cosyvoice';

  const safeIdx = Math.min(
    Math.max(0, activeCloneBlockIndex),
    Math.max(0, cloneBlocks.length - 1),
  );
  const activeText = cloneBlocks[safeIdx] ?? '';

  const totalChars = useMemo(
    () => cloneBlocks.reduce((acc, b) => acc + b.length, 0),
    [cloneBlocks],
  );

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.55cqh] overflow-hidden"
      data-testid="clone-lab-panel"
    >
      {/* Cabecera de Estado Zero-Shot */}
      <div className="flex shrink-0 items-center justify-between gap-[0.5cqw] rounded-[0.5cqh] border border-amber-400/25 bg-amber-500/8 px-[0.65cqw] py-[0.35cqh]">
        <div className="flex min-w-0 items-center gap-[0.4cqw]">
          <AnimatedIcon
            name="fingerprint"
            variant="pulse"
            trigger="always"
            className="text-amber-300"
          />
          <span className="tx-xs truncate font-semibold text-amber-100">
            {isNativeCloningEngine
              ? `Motor Zero-Shot Activo: ${selectedEngineId.toUpperCase()} (${selectedVoiceId})`
              : 'Seleccione motor Zero-Shot recomendado o use semilla actual:'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-[0.3cqw]">
          <button
            type="button"
            data-testid="switch-f5-btn"
            onClick={() => onSwitchToCloningEngine('f5_spanish')}
            className={`rounded-[0.4cqh] border px-[0.5cqw] py-[0.2cqh] font-mono-tech tx-xs font-semibold transition ${
              selectedEngineId === 'f5_spanish'
                ? 'border-amber-300 bg-amber-400/25 text-amber-100'
                : 'border-sky-400/20 bg-slate-900/80 text-slate-300 hover:border-amber-400/50'
            }`}
          >
            F5-SPANISH
          </button>
          <button
            type="button"
            data-testid="switch-cosyvoice-btn"
            onClick={() => onSwitchToCloningEngine('cosyvoice')}
            className={`rounded-[0.4cqh] border px-[0.5cqw] py-[0.2cqh] font-mono-tech tx-xs font-semibold transition ${
              selectedEngineId === 'cosyvoice'
                ? 'border-amber-300 bg-amber-400/25 text-amber-100'
                : 'border-sky-400/20 bg-slate-900/80 text-slate-300 hover:border-amber-400/50'
            }`}
          >
            COSYVOICE 3
          </button>
        </div>
      </div>

      {/* Fila de Audio Semilla (.wav) + Transcripcion de Referencia */}
      <div className="grid shrink-0 grid-cols-12 gap-[0.55cqw]">
        <div className="col-span-5 flex min-w-0 flex-col justify-between rounded-[0.55cqh] border border-sky-400/20 bg-slate-950/65 p-[0.45cqh_0.55cqw]">
          <span className="font-mono-tech tx-xs text-[var(--text-muted)]">
            MUESTRA WAV (3-10 SEG OPCIONAL)
          </span>
          <div className="mt-[0.25cqh] flex items-center justify-between gap-[0.35cqw]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,audio/wav"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                onReferenceFileChange(f);
              }}
            />
            <button
              type="button"
              data-testid="upload-ref-wav-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-w-0 flex-1 items-center gap-[0.35cqw] rounded-[0.4cqh] border border-cyan-400/35 bg-cyan-500/12 px-[0.5cqw] py-[0.28cqh] tx-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
            >
              <AnimatedIcon name="upload" variant="bounce" trigger="hover" />
              <span className="truncate">
                {referenceFile ? referenceFile.name : 'Cargar semilla .WAV'}
              </span>
            </button>
            {referenceFile && (
              <button
                type="button"
                onClick={() => onReferenceFileChange(null)}
                aria-label="Quitar audio de referencia"
                className="rounded border border-slate-700 px-[0.35cqw] py-[0.24cqh] tx-xs text-slate-400 hover:text-amber-300"
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        <div className="col-span-7 flex min-w-0 flex-col justify-between rounded-[0.55cqh] border border-sky-400/20 bg-slate-950/65 p-[0.45cqh_0.55cqw]">
          <label
            htmlFor="clone-ref-text"
            className="font-mono-tech tx-xs text-[var(--text-muted)] truncate"
          >
            TRANSCRIPCION EXACTA DEL AUDIO DE REFERENCIA
          </label>
          <input
            id="clone-ref-text"
            type="text"
            data-testid="clone-reference-text"
            maxLength={200}
            value={referenceText}
            onChange={(e) => onReferenceTextChange(e.target.value)}
            placeholder="Transcripcion fiel de la semilla acustica..."
            className="mt-[0.25cqh] w-full rounded-[0.4cqh] border border-sky-400/20 bg-slate-900/90 px-[0.5cqw] py-[0.28cqh] tx-xs text-slate-100"
          />
        </div>
      </div>

      {/* Texto Objetivo a Clonar con Chips sin Scroll */}
      <div className="flex min-h-0 flex-1 flex-col gap-[0.35cqh] overflow-hidden">
        <div className="flex shrink-0 items-center justify-between tx-xs">
          <div className="flex items-center gap-[0.3cqw] overflow-hidden">
            <span className="font-semibold text-slate-300">Texto Objetivo:</span>
            {cloneBlocks.slice(0, 4).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectCloneBlock(idx)}
                className={`rounded border px-[0.42cqw] py-[0.12cqh] font-mono-tech text-[clamp(8px,0.9cqh,11.5px)] ${
                  idx === safeIdx
                    ? 'border-amber-400/75 bg-amber-400/20 text-amber-200'
                    : 'border-sky-400/15 bg-slate-900 text-slate-400'
                }`}
              >
                Bloque {idx + 1}/{cloneBlocks.length}
              </button>
            ))}
          </div>
          <span className="font-mono-tech text-amber-300">{totalChars} CAR.</span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <label htmlFor="clone-target-textarea" className="sr-only">
            Texto en espanol para clonar voz
          </label>
          <textarea
            id="clone-target-textarea"
            data-testid="clone-target-textarea"
            className="studio-textarea"
            value={activeText}
            onChange={(e) => onChangeCloneBlock(e.target.value)}
            placeholder="Escriba el guion en espanol que sera pronunciado con la huella vocal clonada..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* Barra Inferior de Ejecucion Zero-Shot */}
      <div className="grid shrink-0 grid-cols-12 items-center gap-[0.55cqw] rounded-[0.6cqh] border border-amber-400/20 bg-slate-950/65 px-[0.65cqw] py-[0.5cqh]">
        <div className="col-span-4 flex flex-col">
          <div className="flex justify-between font-mono-tech tx-xs">
            <span className="text-[var(--text-muted)]">CADENCIA</span>
            <span className="text-amber-300">{speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            aria-label="Cadencia de clonacion"
            className="studio-slider mt-[0.3cqh]"
          />
        </div>

        <div className="col-span-3 flex flex-col">
          <span className="font-mono-tech tx-xs text-[var(--text-muted)]">INTENCION</span>
          <select
            value={emotion}
            onChange={(e) => onEmotionChange(e.target.value)}
            aria-label="Intencion vocal"
            className="mt-[0.15cqh] rounded-[0.4cqh] border border-sky-400/25 bg-slate-900 px-[0.4cqw] py-[0.22cqh] tx-xs text-slate-100 uppercase"
          >
            <option value="neutro">NEUTRO</option>
            <option value="narrativo">NARRATIVO</option>
            <option value="calido">CALIDO</option>
            <option value="expresivo">EXPRESIVO</option>
          </select>
        </div>

        <div className="col-span-5 flex justify-end">
          <button
            type="button"
            disabled={isCloning || totalChars === 0}
            onClick={onRunClone}
            data-testid="execute-clone-btn"
            className="flex w-full items-center justify-center gap-[0.45cqw] rounded-[0.55cqh] border border-amber-300/70 bg-gradient-to-r from-amber-400 to-orange-400 px-[0.8cqw] py-[0.58cqh] tx-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(245,166,35,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AnimatedIcon
              name={isCloning ? 'loader' : 'fingerprint'}
              variant={isCloning ? 'spin' : 'pulse'}
              trigger={isCloning ? 'always' : 'hover'}
              className="text-slate-950"
            />
            <span>{isCloning ? 'Clonando Timbre...' : 'Ejecutar Clonacion Zero-Shot'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
