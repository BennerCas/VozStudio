import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AnimatedIcon, getEngineIconConfig } from '../icons/AnimatedIcon';
import { useFitCount } from '../hooks/useFitCount';
import type { EngineInfo, VoiceInfo } from '../types/tts';
import { Paginator } from './Paginator';

const REGION_FILTERS = ['TODOS', 'ES', 'MX', 'AR', 'LATAM', 'MULTI'] as const;

export interface EngineVoiceSidebarProps {
  stageRef: RefObject<HTMLElement | null>;
  engines: EngineInfo[];
  selectedEngineId: string;
  voices: VoiceInfo[];
  selectedVoiceId: string;
  onSelectEngine: (engineId: string) => void;
  onSelectVoice: (voiceId: string) => void;
}

function normalizeRegionBadge(region: string): string {
  const upper = (region || 'LATAM').toUpperCase();
  if (upper.includes('MX') || upper.includes('MEX')) return 'MX';
  if (upper.includes('AR') || upper.includes('ARG')) return 'AR';
  if (upper.includes('ES') || upper.includes('SPA')) return 'ES';
  if (upper.includes('MULTI')) return 'MULTI';
  return 'LATAM';
}

function normalizeGenderBadge(gender: string): string {
  const upper = (gender || '').toUpperCase();
  if (upper.includes('MIX')) return 'MIX';
  if (upper.startsWith('F') || upper.includes('FEM')) return 'FEM';
  return 'MASC';
}

export function EngineVoiceSidebar({
  stageRef,
  engines,
  selectedEngineId,
  voices,
  selectedVoiceId,
  onSelectEngine,
  onSelectVoice,
}: EngineVoiceSidebarProps) {
  const [regionFilter, setRegionFilter] = useState<string>('TODOS');
  const [voicePage, setVoicePage] = useState<number>(1);
  const voiceListRef = useRef<HTMLDivElement | null>(null);

  const fitVoicesCount = useFitCount(voiceListRef, stageRef, {
    itemCqh: 7.4,
    gapCqh: 0.55,
    minItems: 2,
    maxItems: 5,
  });

  useEffect(() => {
    setVoicePage(1);
    setRegionFilter('TODOS');
  }, [selectedEngineId]);

  const filteredVoices = useMemo(() => {
    if (regionFilter === 'TODOS') return voices;
    return voices.filter((v) => normalizeRegionBadge(v.region) === regionFilter);
  }, [voices, regionFilter]);

  const totalVoicePages = Math.max(1, Math.ceil(filteredVoices.length / fitVoicesCount));
  const safeVoicePage = Math.min(voicePage, totalVoicePages);

  useEffect(() => {
    if (voicePage > totalVoicePages) {
      setVoicePage(totalVoicePages);
    }
  }, [voicePage, totalVoicePages]);

  const visibleVoices = useMemo(() => {
    const start = (safeVoicePage - 1) * fitVoicesCount;
    return filteredVoices.slice(start, start + fitVoicesCount);
  }, [filteredVoices, safeVoicePage, fitVoicesCount]);

  return (
    <aside
      aria-label="Selector de motores neurales y catalogo de voces"
      className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.7cqh] overflow-hidden"
      data-panel="left-sidebar"
    >
      {/* Modulo Superior: Matriz de 8 Motores Neurales */}
      <section
        className="glass-panel flex shrink-0 flex-col justify-between p-[0.6cqh_0.6cqw]"
        data-panel="engines-panel"
      >
        <div className="mb-[0.4cqh] flex items-center justify-between">
          <span className="font-display tx-sm font-semibold tracking-wide text-slate-100">
            MOTORES NEURALES
          </span>
          <span className="badge-chip badge-cyan">{engines.length} ARQUITECTURAS</span>
        </div>

        <div
          role="tablist"
          aria-label="Motores TTS disponibles"
          className="grid grid-cols-2 gap-[0.35cqh_0.4cqw]"
        >
          {engines.map((engine) => {
            const isSelected = engine.id === selectedEngineId;
            const iconCfg = getEngineIconConfig(engine.id);
            const triggerMode =
              engine.id === 'piper' ||
              engine.id === 'f5_spanish' ||
              engine.id === 'cosyvoice' ||
              engine.id === 'xtts_v2' ||
              engine.id === 'qwen3_tts'
                ? 'active'
                : 'hover';

            return (
              <button
                key={engine.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`engine-tab-${engine.id}`}
                onClick={() => onSelectEngine(engine.id)}
                className={`group flex min-w-0 flex-col justify-between rounded-[0.5cqh] border p-[0.4cqh_0.45cqw] text-left transition ${
                  isSelected
                    ? 'border-cyan-400/75 bg-cyan-500/16 shadow-[0_0_14px_rgba(12,211,245,0.16)]'
                    : 'border-sky-400/15 bg-slate-950/55 hover:border-sky-400/40 hover:bg-slate-900/75'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-[0.3cqw]">
                  <span
                    className={`flex items-center justify-center ${
                      isSelected ? 'text-cyan-300' : 'text-slate-400 group-hover:text-cyan-200'
                    }`}
                  >
                    <AnimatedIcon
                      name={iconCfg.name}
                      variant={iconCfg.variant}
                      trigger={isSelected ? triggerMode : 'hover'}
                      active={isSelected}
                    />
                  </span>
                  <span
                    className={`font-mono-tech text-[clamp(7.5px,0.82cqh,10.5px)] ${
                      engine.available ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {Math.round(engine.estimated_mb)}MB
                  </span>
                </div>

                <div className="mt-[0.2cqh] min-w-0">
                  <div className="text-[clamp(8px,0.92cqh,11.5px)] truncate font-semibold text-slate-100 leading-tight">
                    {engine.name}
                  </div>
                  <div className="font-mono-tech truncate text-[clamp(7px,0.78cqh,10px)] text-[var(--text-muted)]">
                    {engine.category}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Modulo Inferior: Catalogo Paginado de Voces en Espanol */}
      <section
        className="glass-panel flex min-h-0 flex-1 flex-col justify-between p-[0.75cqh_0.7cqw]"
        data-panel="voices-panel"
      >
        <div className="shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-display tx-sm font-semibold tracking-wide text-slate-100">
              TIMBRES EN ESPANOL
            </span>
            <span className="font-mono-tech tx-xs text-cyan-300">{selectedEngineId.toUpperCase()}</span>
          </div>

          {/* Filtro rapido por region tipografica (CERO EMOJIS) */}
          <div
            className="mt-[0.5cqh] grid grid-cols-6 gap-[0.25cqw]"
            role="group"
            aria-label="Filtro dialectal"
          >
            {REGION_FILTERS.map((reg) => {
              const active = regionFilter === reg;
              return (
                <button
                  key={reg}
                  type="button"
                  data-testid={`region-filter-${reg}`}
                  onClick={() => {
                    setRegionFilter(reg);
                    setVoicePage(1);
                  }}
                  className={`rounded-[0.4cqh] border py-[0.26cqh] font-mono-tech text-[clamp(7.5px,0.88cqh,11px)] font-semibold transition ${
                    active
                      ? 'border-cyan-400/70 bg-cyan-400/20 text-cyan-200'
                      : 'border-sky-400/15 bg-slate-950/55 text-slate-400 hover:border-sky-400/35 hover:text-slate-200'
                  }`}
                >
                  {reg}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenedor medido por ResizeObserver (useFitCount) */}
        <div
          ref={voiceListRef}
          className="my-[0.55cqh] flex min-h-0 flex-1 flex-col justify-start gap-[0.5cqh] overflow-hidden"
          data-testid="voices-list-container"
        >
          {visibleVoices.length > 0 ? (
            visibleVoices.map((voice) => {
              const selected = voice.id === selectedVoiceId;
              const regBadge = normalizeRegionBadge(voice.region);
              const genBadge = normalizeGenderBadge(voice.gender);
              const khz = (voice.sample_rate / 1000).toFixed(voice.sample_rate % 1000 === 0 ? 0 : 2);

              return (
                <button
                  key={voice.id}
                  type="button"
                  data-testid={`voice-card-${voice.id}`}
                  onClick={() => onSelectVoice(voice.id)}
                  style={{ height: '7.1cqh' }}
                  className={`flex w-full shrink-0 flex-col justify-between rounded-[0.6cqh] border px-[0.6cqw] py-[0.45cqh] text-left transition overflow-hidden ${
                    selected
                      ? 'border-cyan-400/80 bg-cyan-500/15 shadow-[0_0_12px_rgba(12,211,245,0.14)]'
                      : 'border-sky-400/15 bg-slate-950/60 hover:border-sky-400/40 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-[0.35cqw]">
                    <span className="tx-xs truncate font-semibold text-slate-100">
                      {voice.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-[0.22cqw]">
                      <span className="badge-chip badge-cyan">{regBadge}</span>
                      <span className="badge-chip badge-amber">{genBadge}</span>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-[0.4cqw]">
                    <span className="truncate text-[clamp(8px,0.95cqh,12px)] text-[var(--text-secondary)]">
                      {voice.description}
                    </span>
                    <span className="font-mono-tech shrink-0 text-[clamp(7.5px,0.88cqh,11px)] text-sky-300/90">
                      {khz}kHz
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex h-full items-center justify-center rounded-[0.6cqh] border border-dashed border-sky-400/20 bg-slate-950/40 p-[0.8cqh] text-center tx-xs text-[var(--text-muted)]">
              Sin timbres registrados en la region {regionFilter}. Seleccione TODOS para listar el
              catalogo activo.
            </div>
          )}
        </div>

        <Paginator
          currentPage={safeVoicePage}
          totalPages={totalVoicePages}
          totalItems={filteredVoices.length}
          label="VOCES"
          onPageChange={setVoicePage}
          testIdPrefix="voices-paginator"
        />
      </section>
    </aside>
  );
}
