import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloneLabPanel } from './components/CloneLabPanel';
import { ComposerPanel } from './components/ComposerPanel';
import { EngineVoiceSidebar } from './components/EngineVoiceSidebar';
import { HeaderBar } from './components/HeaderBar';
import { LibraryInspectorSidebar } from './components/LibraryInspectorSidebar';
import { OrientationGuard } from './components/OrientationGuard';
import { Waveform } from './components/Waveform';
import {
  FALLBACK_ENGINES,
  FALLBACK_SYSTEM_STATUS,
  FALLBACK_VOICES_BY_ENGINE,
  PRESET_SCRIPTS,
} from './data/fallbackCatalog';
import { useViewportGuard } from './hooks/useViewportGuard';
import { AnimatedIcon } from './icons/AnimatedIcon';
import { studioApi } from './services/api';
import { buildCalibratedPreviewItem } from './services/offlinePreviewWav';
import type { EngineInfo, LibraryItem, SystemStatus, VoiceInfo } from './types/tts';
import {
  joinDocumentBlocks,
  segmentSpanishText,
  updateBlockWithAutoSplit,
} from './utils/textSegmenter';

export function App() {
  const viewport = useViewportGuard();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(FALLBACK_SYSTEM_STATUS);
  const [engines, setEngines] = useState<EngineInfo[]>(FALLBACK_ENGINES);
  const [selectedEngineId, setSelectedEngineId] = useState<string>('kokoro');
  const [voicesByEngine, setVoicesByEngine] =
    useState<Record<string, VoiceInfo[]>>(FALLBACK_VOICES_BY_ENGINE);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('ef_dora');

  const [centerMode, setCenterMode] = useState<'direct' | 'clone'>('direct');

  // Estado de composicion directa paginada por bloques sin scroll
  const [blocks, setBlocks] = useState<string[]>(() =>
    segmentSpanishText(PRESET_SCRIPTS[0].text),
  );
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0.0);
  const [emotion, setEmotion] = useState<string>('neutro');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // Estado del Laboratorio Zero-Shot (sin modal, conmutado en panel central)
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceText, setReferenceText] = useState<string>(
    'Esta grabacion sirve como patron timbrico de referencia en espanol para transferencia vocal.',
  );
  const [cloneBlocks, setCloneBlocks] = useState<string[]>([
    'La clonacion zero-shot sintetiza este mensaje conservando el timbre y la resonancia de la voz semilla sobre DirectML.',
  ]);
  const [activeCloneBlockIndex, setActiveCloneBlockIndex] = useState<number>(0);
  const [isCloning, setIsCloning] = useState<boolean>(false);

  // Biblioteca e Inspector
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null);
  const [previewPeaks, setPreviewPeaks] = useState<number[] | undefined>(undefined);
  const [libraryQuery, setLibraryQuery] = useState<string>('');
  const [filterLibraryByEngine, setFilterLibraryByEngine] = useState<boolean>(false);

  // Telemetria / Mensajes de estado discretos en Header
  const [isUnloading, setIsUnloading] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const currentVoices = useMemo(
    () => voicesByEngine[selectedEngineId] ?? FALLBACK_VOICES_BY_ENGINE[selectedEngineId] ?? [],
    [voicesByEngine, selectedEngineId],
  );

  const selectedEngine = useMemo(
    () => engines.find((e) => e.id === selectedEngineId) ?? engines[0],
    [engines, selectedEngineId],
  );

  const selectedVoice = useMemo(
    () => currentVoices.find((v) => v.id === selectedVoiceId) ?? currentVoices[0],
    [currentVoices, selectedVoiceId],
  );

  // Sincronizar voz activa cuando cambia la lista del motor seleccionado
  useEffect(() => {
    if (currentVoices.length > 0 && !currentVoices.some((v) => v.id === selectedVoiceId)) {
      setSelectedVoiceId(currentVoices[0].id);
    }
  }, [currentVoices, selectedVoiceId]);

  const fetchLibrarySafe = useCallback(
    async (onlineOverride?: boolean) => {
      const online = onlineOverride ?? isOnline;
      if (!online) return;
      try {
        const engineParam = filterLibraryByEngine ? selectedEngineId : '';
        const items = await studioApi.getLibrary(engineParam, libraryQuery.trim());
        setLibraryItems(items);
      } catch {
        // Conservar estado local ante desconexion transitoria
      }
    },
    [isOnline, filterLibraryByEngine, selectedEngineId, libraryQuery],
  );

  const fetchLibraryRef = useRef(fetchLibrarySafe);
  useEffect(() => {
    fetchLibraryRef.current = fetchLibrarySafe;
  }, [fetchLibrarySafe]);

  // Sonda periodica de conexion con el backend FastAPI (127.0.0.1:8880)
  useEffect(() => {
    let mounted = true;

    const syncBackend = async () => {
      try {
        const st = await studioApi.getSystemStatus();
        if (!mounted) return;
        setSystemStatus(st);
        setIsOnline((wasOnline) => {
          if (!wasOnline) {
            void (async () => {
              try {
                const remoteEngines = await studioApi.getEngines();
                if (mounted && remoteEngines.length > 0) {
                  setEngines(remoteEngines);
                }
              } catch {
                // Mantener catalogo base si falla listado inicial
              }
              void fetchLibraryRef.current(true);
            })();
          }
          return true;
        });
      } catch {
        if (!mounted) return;
        setIsOnline(false);
      }
    };

    void syncBackend();
    const interval = window.setInterval(() => {
      void syncBackend();
    }, 8000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Cargar voces reales del motor cuando el backend esta en linea
  useEffect(() => {
    if (!isOnline) return;
    let active = true;
    void (async () => {
      try {
        const remoteVoices = await studioApi.getVoices(selectedEngineId);
        if (active && remoteVoices.length > 0) {
          setVoicesByEngine((prev) => ({
            ...prev,
            [selectedEngineId]: remoteVoices,
          }));
        }
      } catch {
        // Fallback local transparente
      }
    })();
    return () => {
      active = false;
    };
  }, [isOnline, selectedEngineId]);

  // Actualizar biblioteca cuando cambian filtros en modo online
  useEffect(() => {
    if (!isOnline) return;
    const debounce = window.setTimeout(() => {
      void fetchLibrarySafe(true);
    }, 180);
    return () => window.clearTimeout(debounce);
  }, [isOnline, libraryQuery, filterLibraryByEngine, selectedEngineId, fetchLibrarySafe]);

  const filteredLibraryItems = useMemo(() => {
    if (isOnline) return libraryItems;
    return libraryItems.filter((it) => {
      const matchEngine = !filterLibraryByEngine || it.motor === selectedEngineId;
      const q = libraryQuery.trim().toLowerCase();
      const matchQuery =
        q.length === 0 ||
        it.archivo.toLowerCase().includes(q) ||
        it.prompt_original.toLowerCase().includes(q) ||
        it.voz_id.toLowerCase().includes(q);
      return matchEngine && matchQuery;
    });
  }, [isOnline, libraryItems, filterLibraryByEngine, selectedEngineId, libraryQuery]);

  const handleSelectEngine = (engineId: string) => {
    setSelectedEngineId(engineId);
    const nextVoices = voicesByEngine[engineId] ?? FALLBACK_VOICES_BY_ENGINE[engineId] ?? [];
    if (nextVoices.length > 0) {
      setSelectedVoiceId(nextVoices[0].id);
    }
  };

  const handleChangeActiveBlock = (val: string) => {
    const updated = updateBlockWithAutoSplit(blocks, activeBlockIndex, val);
    setBlocks(updated.blocks);
    setActiveBlockIndex(updated.activeIndex);

    // Si se pegaron multiples bloques y el backend esta activo, previsualizar normalizacion asincronamente
    if (isOnline && val.length > 520) {
      void studioApi
        .normalizePreview(joinDocumentBlocks(updated.blocks), 460)
        .then((norm) => {
          if (norm.segments.length > 1) {
            setStatusBanner(
              `Texto normalizado en ${norm.segments_count} segmentos foneticos (${norm.total_chars} caracteres).`,
            );
          }
        })
        .catch(() => undefined);
    }
  };

  const handleChangeCloneBlock = (val: string) => {
    const updated = updateBlockWithAutoSplit(cloneBlocks, activeCloneBlockIndex, val);
    setCloneBlocks(updated.blocks);
    setActiveCloneBlockIndex(updated.activeIndex);
  };

  const runSynthesisText = async (textToSynthesize: string) => {
    const clean = textToSynthesize.trim();
    if (!clean || isSynthesizing) return;

    setIsSynthesizing(true);
    setStatusBanner(`Sintetizando con ${selectedEngine?.name ?? selectedEngineId}...`);

    try {
      if (isOnline) {
        const item = await studioApi.synthesize({
          text: clean,
          engine_id: selectedEngineId,
          voice_id: selectedVoice?.id ?? selectedVoiceId,
          speed,
          pitch_semitones: pitchSemitones,
          emotion,
        });
        setPreviewPeaks(undefined);
        setActiveItem(item);
        setLibraryItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
        setStatusBanner(
          `Audio archivado en biblioteca/: ${item.archivo} (RTF ${item.metricas?.rtf ?? '--'})`,
        );
        const st = await studioApi.getSystemStatus().catch(() => null);
        if (st) setSystemStatus(st);
      } else {
        const preview = buildCalibratedPreviewItem({
          text: clean,
          engineId: selectedEngineId,
          engineName: selectedEngine?.name ?? selectedEngineId,
          voiceId: selectedVoice?.id ?? selectedVoiceId,
          sampleRate: selectedVoice?.sample_rate ?? 24000,
          speed,
          pitchSemitones,
          emotion,
          mode: 'sintesis',
        });
        setPreviewPeaks(preview.peaks);
        setActiveItem(preview.item);
        setLibraryItems((prev) => [preview.item, ...prev]);
        setStatusBanner(
          'Muestra acustica de calibracion generada en modo OFFLINE PREVIEW (inicie backend en 127.0.0.1:8880 para inferencia ONNX).',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error durante la sintesis neural';
      setStatusBanner(`Aviso de motor: ${msg}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleRunClone = async () => {
    const fullText = joinDocumentBlocks(cloneBlocks);
    if (!fullText || isCloning) return;

    const availableCloneEngine =
      engines.find((e) => (e.id === 'cosyvoice' || e.id === 'f5_spanish') && e.available)?.id ??
      'cosyvoice';

    const targetEngine =
      selectedEngineId === 'f5_spanish' || selectedEngineId === 'cosyvoice'
        ? selectedEngineId
        : availableCloneEngine;

    let cloneVoiceId: string | null = selectedVoice?.id ?? null;
    if (targetEngine !== selectedEngineId) {
      handleSelectEngine(targetEngine);
      const targetVoices =
        voicesByEngine[targetEngine] ?? FALLBACK_VOICES_BY_ENGINE[targetEngine] ?? [];
      cloneVoiceId = targetVoices[0]?.id ?? null;
    }

    setIsCloning(true);
    setStatusBanner(`Ejecutando clonacion zero-shot con ${targetEngine.toUpperCase()}...`);

    try {
      if (isOnline) {
        const item = await studioApi.cloneVoice({
          text: fullText,
          engine_id: targetEngine,
          voice_id: cloneVoiceId,
          reference_text: referenceText.trim(),
          speed,
          emotion,
          reference_audio: referenceFile,
        });
        setPreviewPeaks(undefined);
        setActiveItem(item);
        setLibraryItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
        setStatusBanner(`Clonacion archivada en biblioteca/: ${item.archivo}`);
      } else {
        const preview = buildCalibratedPreviewItem({
          text: fullText,
          engineId: targetEngine,
          engineName: targetEngine === 'cosyvoice' ? 'CosyVoice 3 ONNX' : 'F5-Spanish ONNX',
          voiceId: selectedVoice?.id ?? 'semilla_zero_shot',
          sampleRate: 24000,
          speed,
          pitchSemitones: 0,
          emotion,
          mode: 'clonacion',
        });
        setPreviewPeaks(preview.peaks);
        setActiveItem(preview.item);
        setLibraryItems((prev) => [preview.item, ...prev]);
        setStatusBanner(
          'Previsualizacion zero-shot generada en modo OFFLINE PREVIEW (conecte backend FastAPI para inferencia real).',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en clonacion zero-shot';
      setStatusBanner(`Aviso de laboratorio: ${msg}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleDeleteLibraryItem = async (id: string) => {
    if (isOnline && !id.startsWith('preview_')) {
      try {
        await studioApi.deleteLibraryItem(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo eliminar el registro';
        setStatusBanner(msg);
        return;
      }
    }
    setLibraryItems((prev) => prev.filter((item) => item.id !== id));
    if (activeItem?.id === id) {
      setActiveItem(null);
    }
  };

  const handleUnloadEngines = async () => {
    setIsUnloading(true);
    try {
      if (isOnline) {
        await studioApi.unloadEngines();
        const st = await studioApi.getSystemStatus().catch(() => null);
        if (st) setSystemStatus(st);
      } else {
        setSystemStatus((prev) => ({
          ...prev,
          active_engine: null,
          estimated_engine_mb: 0,
        }));
      }
      setStatusBanner('Sesiones ONNX desalojadas y memoria VRAM/RAM liberada correctamente.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al liberar VRAM';
      setStatusBanner(msg);
    } finally {
      setIsUnloading(false);
    }
  };

  const handleVoiceSaved = useCallback(
    async (engineId: string, voiceId: string) => {
      try {
        const remoteVoices = await studioApi.getVoices(engineId);
        if (remoteVoices.length > 0) {
          setVoicesByEngine((prev) => ({
            ...prev,
            [engineId]: remoteVoices,
          }));
        }
        setSelectedEngineId(engineId);
        setSelectedVoiceId(voiceId);
        setStatusBanner(`Timbre registrado y seleccionado en ${engineId.toUpperCase()}`);
      } catch (err) {
        console.error('Error al actualizar voces tras guardado:', err);
      }
    },
    [],
  );

  if (viewport.isCompactOrPortrait) {
    return <OrientationGuard width={viewport.width} height={viewport.height} />;
  }

  return (
    <div className="acoustic-viewport">
      <div className="acoustic-mesh" aria-hidden="true" />

      <div ref={stageRef} className="studio-stage" data-testid="studio-stage-16-9">
        {/* Fila 1 (7.5%): Header Semántico */}
        <HeaderBar
          status={systemStatus}
          isOnline={isOnline}
          isUnloading={isUnloading}
          statusBanner={statusBanner}
          onUnloadEngines={handleUnloadEngines}
        />

        {/* Fila 2 (Body 3 columnas: 23% | 52% | 25%) */}
        <div className="studio-body">
          {/* Columna Izquierda (23%): Motores + Voces */}
          <EngineVoiceSidebar
            stageRef={stageRef}
            engines={engines}
            selectedEngineId={selectedEngineId}
            voices={currentVoices}
            selectedVoiceId={selectedVoice?.id ?? selectedVoiceId}
            onSelectEngine={handleSelectEngine}
            onSelectVoice={setSelectedVoiceId}
          />

          {/* Columna Central (52%): Composicion / Clonacion + Osciloscopio */}
          <main
            className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-[0.7cqh] overflow-hidden"
            data-panel="center-main"
          >
            {/* Panel Superior (60%): Pestañas Sintesis Directa | Laboratorio Zero-Shot */}
            <section
              aria-label="Estacion de composicion y clonacion vocal"
              className="glass-panel flex min-h-0 flex-[60] flex-col justify-between p-[0.75cqh_0.8cqw]"
              data-panel="composer-shell"
            >
              <div
                role="tablist"
                aria-label="Modo de sintesis"
                className="mb-[0.55cqh] flex shrink-0 items-center justify-between border-b border-sky-400/15 pb-[0.5cqh]"
              >
                <div className="flex items-center gap-[0.45cqw]">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={centerMode === 'direct'}
                    data-testid="mode-tab-direct"
                    onClick={() => setCenterMode('direct')}
                    className={`flex items-center gap-[0.38cqw] rounded-[0.5cqh] border px-[0.75cqw] py-[0.35cqh] font-display tx-xs font-semibold tracking-wide transition ${
                      centerMode === 'direct'
                        ? 'border-cyan-400/75 bg-cyan-500/18 text-cyan-100 shadow-[0_0_12px_rgba(12,211,245,0.16)]'
                        : 'border-sky-400/15 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AnimatedIcon name="audio-lines" variant="oscillate" trigger="hover" />
                    <span>Sintesis Directa</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={centerMode === 'clone'}
                    data-testid="mode-tab-clone"
                    onClick={() => setCenterMode('clone')}
                    className={`flex items-center gap-[0.38cqw] rounded-[0.5cqh] border px-[0.75cqw] py-[0.35cqh] font-display tx-xs font-semibold tracking-wide transition ${
                      centerMode === 'clone'
                        ? 'border-amber-400/75 bg-amber-500/18 text-amber-100 shadow-[0_0_12px_rgba(245,166,35,0.16)]'
                        : 'border-sky-400/15 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AnimatedIcon name="fingerprint" variant="pulse" trigger="hover" />
                    <span>Laboratorio Zero-Shot</span>
                  </button>
                </div>

                <div className="flex items-center gap-[0.35cqw]">
                  <span className="badge-chip badge-cyan">
                    {selectedVoice?.name ?? selectedVoiceId}
                  </span>
                  <span className="badge-chip badge-neutral">
                    {selectedVoice?.region ?? 'LATAM'} / {selectedVoice?.gender ?? 'FEM'}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                {centerMode === 'direct' ? (
                  <ComposerPanel
                    blocks={blocks}
                    activeBlockIndex={activeBlockIndex}
                    speed={speed}
                    pitchSemitones={pitchSemitones}
                    emotion={emotion}
                    isSynthesizing={isSynthesizing}
                    onChangeActiveBlock={handleChangeActiveBlock}
                    onSelectBlock={setActiveBlockIndex}
                    onLoadPreset={(txt) => {
                      setBlocks(segmentSpanishText(txt));
                      setActiveBlockIndex(0);
                    }}
                    onClearText={() => {
                      setBlocks(['']);
                      setActiveBlockIndex(0);
                    }}
                    onSpeedChange={setSpeed}
                    onPitchChange={setPitchSemitones}
                    onEmotionChange={setEmotion}
                    onSynthesizeActiveBlock={() =>
                      void runSynthesisText(blocks[activeBlockIndex] ?? '')
                    }
                    onSynthesizeFullDocument={() =>
                      void runSynthesisText(joinDocumentBlocks(blocks))
                    }
                  />
                ) : (
                  <CloneLabPanel
                    selectedEngineId={selectedEngineId}
                    selectedVoiceId={selectedVoice?.id ?? selectedVoiceId}
                    referenceFile={referenceFile}
                    referenceText={referenceText}
                    cloneBlocks={cloneBlocks}
                    activeCloneBlockIndex={activeCloneBlockIndex}
                    speed={speed}
                    emotion={emotion}
                    isCloning={isCloning}
                    onSwitchToCloningEngine={handleSelectEngine}
                    onReferenceFileChange={setReferenceFile}
                    onReferenceTextChange={setReferenceText}
                    onChangeCloneBlock={handleChangeCloneBlock}
                    onSelectCloneBlock={setActiveCloneBlockIndex}
                    onSpeedChange={setSpeed}
                    onEmotionChange={setEmotion}
                    onRunClone={() => void handleRunClone()}
                    onVoiceSaved={handleVoiceSaved}
                  />
                )}
              </div>
            </section>

            {/* Panel Inferior (40%): Visor Espectral de Onda + Transporte */}
            <div className="min-h-0 flex-[40] overflow-hidden">
              <Waveform
                activeItem={activeItem}
                selectedVoice={selectedVoice}
                selectedEngineId={selectedEngineId}
                previewPeaks={previewPeaks}
              />
            </div>
          </main>

          {/* Columna Derecha (25%): Biblioteca + Inspector */}
          <LibraryInspectorSidebar
            stageRef={stageRef}
            items={filteredLibraryItems}
            activeItem={activeItem}
            selectedEngine={selectedEngine}
            selectedVoice={selectedVoice}
            searchQuery={libraryQuery}
            filterByEngine={filterLibraryByEngine}
            onSearchQueryChange={setLibraryQuery}
            onToggleFilterByEngine={() => setFilterLibraryByEngine((v) => !v)}
            onRefreshLibrary={() => void fetchLibrarySafe()}
            onSelectItem={(item) => setActiveItem(item)}
            onDeleteItem={(id) => void handleDeleteLibraryItem(id)}
          />
        </div>

        {/* Fila 3 (5%): Footer Oficial Obligatorio DISENO.md */}
        <footer
          className="glass-panel flex h-full w-full items-center justify-between px-[1cqw] tx-xs"
          data-panel="footer-bar"
          data-testid="studio-footer"
        >
          <div className="flex min-w-0 items-center gap-[0.6cqw] font-mono-tech text-[var(--text-muted)] truncate">
            <span className="text-cyan-300 font-semibold">ONNX + DIRECTML</span>
            <span>/</span>
            <span>LIMITE VRAM 25 GB</span>
            <span>/</span>
            <span>12 HILOS CPU</span>
            <span>/</span>
            <span>CERO TELEMETRIA EXTERNA</span>
          </div>

          <div
            className="font-display shrink-0 font-bold tracking-wider text-slate-200"
            data-testid="official-footer-signature"
          >
            HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®
          </div>
        </footer>
      </div>
    </div>
  );
}
