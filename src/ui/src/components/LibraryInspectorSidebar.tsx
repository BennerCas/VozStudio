import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ENGINE_TECHNICAL_SPECS } from '../data/fallbackCatalog';
import { useFitCount } from '../hooks/useFitCount';
import { AnimatedIcon } from '../icons/AnimatedIcon';
import type { EngineInfo, LibraryItem, VoiceInfo } from '../types/tts';
import { Paginator } from './Paginator';

export interface LibraryInspectorSidebarProps {
  stageRef: RefObject<HTMLElement | null>;
  items: LibraryItem[];
  activeItem: LibraryItem | null;
  selectedEngine: EngineInfo | undefined;
  selectedVoice: VoiceInfo | undefined;
  searchQuery: string;
  filterByEngine: boolean;
  onSearchQueryChange: (q: string) => void;
  onToggleFilterByEngine: () => void;
  onRefreshLibrary: () => void;
  onSelectItem: (item: LibraryItem) => void;
  onDeleteItem: (id: string) => void;
}

export function LibraryInspectorSidebar({
  stageRef,
  items,
  activeItem,
  selectedEngine,
  selectedVoice,
  searchQuery,
  filterByEngine,
  onSearchQueryChange,
  onToggleFilterByEngine,
  onRefreshLibrary,
  onSelectItem,
  onDeleteItem,
}: LibraryInspectorSidebarProps) {
  const [libPage, setLibPage] = useState<number>(1);
  const [inspectorTab, setInspectorTab] = useState<'engine' | 'json'>('engine');
  const libraryListRef = useRef<HTMLDivElement | null>(null);

  const fitLibCount = useFitCount(libraryListRef, stageRef, {
    itemCqh: 6.8,
    gapCqh: 0.5,
    minItems: 2,
    maxItems: 4,
  });

  useEffect(() => {
    if (activeItem) {
      setInspectorTab('json');
    } else {
      setInspectorTab('engine');
    }
  }, [activeItem]);

  useEffect(() => {
    setLibPage(1);
  }, [searchQuery, filterByEngine]);

  const totalPages = Math.max(1, Math.ceil(items.length / fitLibCount));
  const safePage = Math.min(libPage, totalPages);

  const visibleItems = useMemo(() => {
    const start = (safePage - 1) * fitLibCount;
    return items.slice(start, start + fitLibCount);
  }, [items, safePage, fitLibCount]);

  const techSpec = ENGINE_TECHNICAL_SPECS[selectedEngine?.id ?? 'kokoro'] ?? ENGINE_TECHNICAL_SPECS.kokoro;

  const inspectorEntries: Array<{ key: string; value: string }> = useMemo(() => {
    if (inspectorTab === 'json' && activeItem) {
      const dur = activeItem.metricas?.duracion_audio_seg;
      const inf = activeItem.metricas?.tiempo_inferencia_ms;
      const rtf = activeItem.metricas?.rtf;
      const mem = activeItem.metricas?.pico_memoria_mb;
      const chars = activeItem.metricas?.caracteres_entrada;
      const frags = activeItem.metricas?.fragmentos;

      return [
        { key: 'ARCHIVO', value: activeItem.archivo },
        { key: 'MODELO ORIGEN', value: activeItem.modelo_origen },
        { key: 'MOTOR / VOZ', value: `${activeItem.motor} / ${activeItem.voz_id}` },
        {
          key: 'DURACION / RTF',
          value: `${typeof dur === 'number' ? `${dur}s` : '--'} / ${typeof rtf === 'number' ? rtf.toFixed(3) : '--'}`,
        },
        {
          key: 'LATENCIA / RAM',
          value: `${typeof inf === 'number' ? `${Math.round(inf)} ms` : '--'} / ${typeof mem === 'number' ? `${Math.round(mem)} MB` : '--'}`,
        },
        {
          key: 'ENTRADA / BLOQUES',
          value: `${chars ?? activeItem.prompt_original.length} car. / ${frags ?? 1} seg.`,
        },
        {
          key: 'PARAMETROS',
          value: `vel ${String(activeItem.parametros?.speed ?? 1.0)}x | ${String(activeItem.parametros?.emotion ?? 'neutro')}`,
        },
        { key: 'PROMPT', value: activeItem.prompt_original },
      ];
    }

    return [
      { key: 'MOTOR ACTIVO', value: selectedEngine?.name ?? 'Kokoro-82M v1.0' },
      { key: 'LICENCIA OSS', value: selectedEngine?.license ?? 'Apache-2.0' },
      { key: 'ARQUITECTURA', value: techSpec.architecture },
      { key: 'BACKEND RUNTIME', value: techSpec.runtimeBackend },
      { key: 'TIMBRE / ID', value: selectedVoice ? `${selectedVoice.name} (${selectedVoice.id})` : '--' },
      {
        key: 'REGION / GENERO',
        value: selectedVoice ? `${selectedVoice.region} / ${selectedVoice.gender}` : 'LATAM / FEM',
      },
      {
        key: 'SAMPLE RATE',
        value: `${selectedVoice?.sample_rate ?? techSpec.defaultSampleRate} Hz PCM`,
      },
      {
        key: 'CAPACIDADES',
        value: techSpec.zeroShot ? 'Clonacion Zero-Shot + Prosodia' : 'Sintesis Neural Directa',
      },
    ];
  }, [inspectorTab, activeItem, selectedEngine, selectedVoice, techSpec]);

  return (
    <aside
      aria-label="Biblioteca de audios auditados e inspector tecnico"
      className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.7cqh] overflow-hidden"
      data-panel="right-sidebar"
    >
      {/* Mitad Superior: Biblioteca Auditada biblioteca/ */}
      <section
        className="glass-panel flex min-h-0 flex-[54] flex-col justify-between p-[0.75cqh_0.7cqw]"
        data-panel="library-panel"
      >
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-[0.35cqw]">
            <div className="flex items-center gap-[0.35cqw] min-w-0">
              <AnimatedIcon name="folder" className="text-cyan-300" />
              <span className="font-display tx-sm font-semibold tracking-wide text-slate-100 truncate">
                BIBLIOTECA AUDITADA
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-[0.28cqw]">
              <button
                type="button"
                onClick={onToggleFilterByEngine}
                data-testid="library-filter-engine-btn"
                className={`rounded-[0.38cqh] border px-[0.42cqw] py-[0.18cqh] font-mono-tech text-[clamp(7.5px,0.86cqh,11px)] font-semibold transition ${
                  filterByEngine
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                    : 'border-sky-400/15 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {filterByEngine ? selectedEngine?.id.toUpperCase() : 'TODOS'}
              </button>
              <button
                type="button"
                onClick={onRefreshLibrary}
                aria-label="Actualizar biblioteca"
                data-testid="library-refresh-btn"
                className="flex h-[2.2cqh] w-[2.2cqh] min-h-[17px] min-w-[17px] items-center justify-center rounded border border-sky-400/20 bg-slate-950/65 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200"
              >
                <AnimatedIcon name="refresh" variant="spin" trigger="hover" className="!w-[1.2cqh] !h-[1.2cqh]" />
              </button>
            </div>
          </div>

          {/* Buscador compacto */}
          <div className="relative mt-[0.45cqh] flex items-center">
            <AnimatedIcon
              name="search"
              className="pointer-events-none absolute left-[0.45cqw] text-slate-400 !w-[1.25cqh] !h-[1.25cqh]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Filtrar archivo o prompt en biblioteca/..."
              aria-label="Buscar en biblioteca"
              data-testid="library-search-input"
              className="w-full rounded-[0.45cqh] border border-sky-400/20 bg-slate-950/75 py-[0.28cqh] pr-[0.5cqw] pl-[1.65cqw] tx-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Lista Paginada de Audios */}
        <div
          ref={libraryListRef}
          className="my-[0.5cqh] flex min-h-0 flex-1 flex-col justify-start gap-[0.45cqh] overflow-hidden"
          data-testid="library-list-container"
        >
          {visibleItems.length > 0 ? (
            visibleItems.map((item) => {
              const isSelected = activeItem?.id === item.id;
              const dur = item.metricas?.duracion_audio_seg;

              return (
                <div
                  key={item.id}
                  style={{ height: '6.5cqh' }}
                  className={`flex w-full shrink-0 items-center justify-between gap-[0.35cqw] rounded-[0.55cqh] border px-[0.55cqw] py-[0.38cqh] transition overflow-hidden ${
                    isSelected
                      ? 'border-cyan-400/75 bg-cyan-500/15'
                      : 'border-sky-400/15 bg-slate-950/60 hover:border-sky-400/35'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="flex min-w-0 flex-1 flex-col justify-between text-left h-full overflow-hidden"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-[0.3cqw]">
                      <span className="font-mono-tech tx-xs truncate font-semibold text-slate-100">
                        {item.archivo}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-[0.3cqw]">
                      <span className="truncate text-[clamp(8px,0.92cqh,11.5px)] text-[var(--text-secondary)]">
                        {item.motor.toUpperCase()} / {item.voz_id}
                      </span>
                      <span className="font-mono-tech shrink-0 text-[clamp(7.5px,0.88cqh,11px)] text-cyan-300">
                        {typeof dur === 'number' ? `${dur.toFixed(1)}s` : 'WAV'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label={`Eliminar ${item.archivo}`}
                    className="flex h-[2.4cqh] w-[2.4cqh] min-h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded border border-slate-700/70 bg-slate-900/80 text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300"
                  >
                    <AnimatedIcon name="trash" className="!w-[1.2cqh] !h-[1.2cqh]" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-[0.6cqh] border border-sky-400/15 bg-slate-950/45 px-[0.7cqw] py-[0.6cqh] text-center">
              <AnimatedIcon name="file-audio" variant="pulse" trigger="always" className="text-cyan-300/80 mb-[0.35cqh]" />
              <div className="tx-xs font-semibold text-slate-200">
                Repositorio biblioteca/ preparado
              </div>
              <p className="mt-[0.2cqh] font-mono-tech text-[clamp(7.5px,0.88cqh,11px)] text-[var(--text-muted)]">
                Patron YYYYMMDD_HHMMSS_audio_*.wav + auditoria .json automatica
              </p>
            </div>
          )}
        </div>

        <Paginator
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={items.length}
          label="WAV"
          onPageChange={setLibPage}
          testIdPrefix="library-paginator"
        />
      </section>

      {/* Mitad Inferior: Inspector Tecnico / Metadatos JSON en 2 Columnas */}
      <section
        className="glass-panel glass-panel-amber flex min-h-0 flex-[46] flex-col justify-between p-[0.75cqh_0.7cqw]"
        data-panel="inspector-panel"
      >
        <div className="flex shrink-0 items-center justify-between gap-[0.35cqw]">
          <span className="font-display tx-sm font-semibold tracking-wide text-slate-100 truncate">
            INSPECTOR TECNICO
          </span>

          <div className="flex shrink-0 items-center gap-[0.25cqw]">
            <button
              type="button"
              data-testid="inspector-tab-engine"
              onClick={() => setInspectorTab('engine')}
              className={`rounded-[0.38cqh] border px-[0.45cqw] py-[0.18cqh] font-mono-tech text-[clamp(7.5px,0.86cqh,11px)] font-semibold transition ${
                inspectorTab === 'engine'
                  ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                  : 'border-sky-400/15 bg-slate-950/60 text-slate-400'
              }`}
            >
              FICHA MOTOR
            </button>
            <button
              type="button"
              data-testid="inspector-tab-json"
              disabled={!activeItem}
              onClick={() => setInspectorTab('json')}
              className={`rounded-[0.38cqh] border px-[0.45cqw] py-[0.18cqh] font-mono-tech text-[clamp(7.5px,0.86cqh,11px)] font-semibold transition disabled:opacity-35 ${
                inspectorTab === 'json'
                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                  : 'border-sky-400/15 bg-slate-950/60 text-slate-400'
              }`}
            >
              JSON AUDIT
            </button>
          </div>
        </div>

        {/* Matriz 2x4 (8 celdas en 2 columnas) con truncado limpio ellipsis */}
        <div
          className="mt-[0.45cqh] grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-[0.38cqh_0.4cqw] overflow-hidden"
          data-testid="inspector-grid"
        >
          {inspectorEntries.slice(0, 8).map((entry) => (
            <div
              key={entry.key}
              className="flex min-h-0 min-w-0 flex-col justify-center rounded-[0.45cqh] border border-sky-400/14 bg-slate-950/65 px-[0.5cqw] py-[0.22cqh] overflow-hidden"
              title={`${entry.key}: ${entry.value}`}
            >
              <span className="font-mono-tech truncate text-[clamp(7px,0.82cqh,10.5px)] text-[var(--text-muted)]">
                {entry.key}
              </span>
              <span className="tx-xs truncate font-medium text-slate-100">{entry.value}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
