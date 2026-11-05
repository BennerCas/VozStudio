import { useCallback, useEffect, useMemo, useState } from 'react';
import { StudioWorkspace, type StudioMode } from './App';
import { PRESET_SCRIPTS, FALLBACK_ENGINES, FALLBACK_SYSTEM_STATUS } from './data/fallbackCatalog';
import { AnimatedIcon, getEngineIconConfig, type IconName } from './icons/AnimatedIcon';
import { studioApi } from './services/api';
import type { EngineInfo, LibraryItem, SystemStatus, VoiceInfo } from './types/tts';

type HubPage = 'inicio' | 'voces' | 'motores' | 'biblioteca' | 'presets' | 'ajustes';

interface StudioLaunch {
  mode: StudioMode;
  text?: string;
  engineId?: string;
  voiceId?: string;
}

const THEME_OPTIONS = [
  { id: 'omni', label: 'Omni Cyan' },
  { id: 'violet', label: 'Violeta' },
  { id: 'ember', label: 'Ámbar' },
  { id: 'light', label: 'Claro' },
  { id: 'amoled', label: 'AMOLED' },
] as const;

const NAVIGATION: Array<{ id: HubPage; label: string; icon: IconName }> = [
  { id: 'inicio', label: 'Inicio', icon: 'audio-lines' },
  { id: 'voces', label: 'Mis voces', icon: 'mic' },
  { id: 'motores', label: 'Motores', icon: 'cpu' },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'folder' },
  { id: 'presets', label: 'Presets', icon: 'layers' },
  { id: 'ajustes', label: 'Ajustes', icon: 'sliders' },
];

function formatDuration(seconds: unknown): string {
  const value = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
  const mins = Math.floor(value / 60);
  const secs = Math.round(value % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function themeFromStorage(): string {
  try {
    const stored = window.localStorage.getItem('vozstudio-workspace-theme');
    return THEME_OPTIONS.some((option) => option.id === stored) ? stored! : 'omni';
  } catch {
    return 'omni';
  }
}

/**
 * Adaptación funcional del workspace de Figma Make. La información se obtiene
 * de la API local cuando está disponible; los valores de reserva están
 * identificados explícitamente como vista previa offline.
 */
export function WorkspaceHub() {
  const [page, setPage] = useState<HubPage>('inicio');
  const [launch, setLaunch] = useState<StudioLaunch | null>(null);
  const [theme, setTheme] = useState(themeFromStorage);
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState<SystemStatus>(FALLBACK_SYSTEM_STATUS);
  const [engines, setEngines] = useState<EngineInfo[]>(FALLBACK_ENGINES);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const openStudio = useCallback((next: StudioLaunch) => {
    setLaunch(next);
  }, []);

  const refreshLocalData = useCallback(async () => {
    setLoading(true);
    try {
      const liveStatus = await studioApi.getSystemStatus();
      const liveEngines = await studioApi.getEngines();
      const activeEngines = liveEngines.length > 0 ? liveEngines : FALLBACK_ENGINES;
      const [voiceGroups, libraryItems] = await Promise.all([
        Promise.all(activeEngines.map((engine) => studioApi.getVoices(engine.id).catch(() => []))),
        studioApi.getLibrary(),
      ]);
      setStatus(liveStatus);
      setEngines(activeEngines);
      setVoices(voiceGroups.flat());
      setLibrary(libraryItems);
      setIsOnline(true);
      setNotice('Datos locales actualizados.');
    } catch {
      setIsOnline(false);
      setNotice('El backend local no responde. Se muestra la vista previa offline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLocalData();
  }, [refreshLocalData]);

  useEffect(() => {
    try {
      window.localStorage.setItem('vozstudio-workspace-theme', theme);
    } catch {
      // La interfaz sigue siendo usable si el navegador bloquea el almacenamiento.
    }
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    if (!query) return library;
    return library.filter((item) =>
      [item.archivo, item.motor, item.voz_id, item.prompt_original]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [library, libraryQuery]);

  const voiceCount = isOnline ? voices.length : engines.reduce((total, engine) => total + engine.voices_count, 0);
  const activeEngine = engines.find((engine) => engine.id === status.active_engine) ?? engines.find((engine) => engine.active);

  if (launch) {
    return (
      <StudioWorkspace
        initialMode={launch.mode}
        initialText={launch.text}
        initialEngineId={launch.engineId}
        initialVoiceId={launch.voiceId}
        onReturnHome={() => setLaunch(null)}
      />
    );
  }

  return (
    <div className="workspace-shell" data-theme={theme} data-testid="workspace-hub">
      <aside className="workspace-sidebar" aria-label="Navegación principal">
        <button type="button" className="workspace-brand" onClick={() => setPage('inicio')}>
          <span className="workspace-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>VOZSTUDIO</strong>
            <small>OMNI-ES / LOCAL</small>
          </span>
        </button>

        <button data-testid="open-live-studio" className="workspace-studio-action" type="button" onClick={() => openStudio({ mode: 'direct' })}>
          <AnimatedIcon name="audio-waveform" variant="oscillate" trigger="hover" />
          Abrir estudio neural
        </button>

        <nav className="workspace-nav">
          <p>ESPACIO DE TRABAJO</p>
          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? 'active' : ''}
              onClick={() => setPage(item.id)}
            >
              <AnimatedIcon name={item.icon} variant={item.id === page ? 'pulse' : 'none'} trigger="active" active={item.id === page} />
              <span>{item.label}</span>
              {item.id === 'voces' && voiceCount > 0 ? <b>{voiceCount}</b> : null}
              {item.id === 'biblioteca' && library.length > 0 ? <b>{library.length}</b> : null}
            </button>
          ))}
        </nav>

        <div className="workspace-sidebar-bottom">
          <div className={`workspace-connection ${isOnline ? 'online' : 'offline'}`}>
            <span />
            <div>
              <strong>{isOnline ? 'Backend local conectado' : 'Vista previa offline'}</strong>
              <small>{isOnline ? status.active_provider ?? 'Proveedor local' : 'Sin acciones remotas'}</small>
            </div>
          </div>
          <p>HUMAN AI SYNERGY<br />BY BENNER CASTILLO</p>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span className="workspace-kicker">VOZSTUDIO / {page.toUpperCase()}</span>
            <strong>{activeEngine?.name ?? 'Estación local de voz neural'}</strong>
          </div>
          <div className="workspace-topbar-actions">
            <label className="theme-control">
              <span>INTERFAZ</span>
              <select aria-label="Tema de interfaz" value={theme} onChange={(event) => setTheme(event.target.value)}>
                {THEME_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" className="workspace-icon-button" onClick={() => void refreshLocalData()} disabled={loading} title="Actualizar datos locales">
              <AnimatedIcon name={loading ? 'loader' : 'refresh'} variant={loading ? 'spin' : 'none'} trigger={loading ? 'always' : 'hover'} />
            </button>
          </div>
        </header>

        <section className="workspace-content">
          {notice ? <div className="workspace-notice" role="status">{notice}</div> : null}
          {page === 'inicio' ? (
            <HomePage
              online={isOnline}
              status={status}
              engines={engines}
              voiceCount={voiceCount}
              libraryCount={library.length}
              onOpenStudio={openStudio}
              onNavigate={setPage}
            />
          ) : null}
          {page === 'voces' ? <VoicesPage online={isOnline} engines={engines} voices={voices} onOpenStudio={openStudio} /> : null}
          {page === 'motores' ? <EnginesPage online={isOnline} engines={engines} onOpenStudio={openStudio} /> : null}
          {page === 'biblioteca' ? (
            <LibraryPage
              online={isOnline}
              query={libraryQuery}
              items={visibleLibrary}
              onQueryChange={setLibraryQuery}
              onOpenStudio={openStudio}
            />
          ) : null}
          {page === 'presets' ? <PresetsPage onOpenStudio={openStudio} /> : null}
          {page === 'ajustes' ? <SettingsPage online={isOnline} status={status} onOpenStudio={openStudio} /> : null}
        </section>
      </main>
    </div>
  );
}

function HomePage({
  online,
  status,
  engines,
  voiceCount,
  libraryCount,
  onOpenStudio,
  onNavigate,
}: {
  online: boolean;
  status: SystemStatus;
  engines: EngineInfo[];
  voiceCount: number;
  libraryCount: number;
  onOpenStudio: (launch: StudioLaunch) => void;
  onNavigate: (page: HubPage) => void;
}) {
  const readyEngines = engines.filter((engine) => engine.available).length;
  return (
    <>
      <div className="workspace-page-head">
        <div>
          <span>PRODUCCIÓN LOCAL · SIN TELEMETRÍA EXTERNA</span>
          <h1>Tu espacio de voz neural.</h1>
          <p>La nueva interfaz organiza lo que ya está disponible localmente: motores, voces, síntesis, clonación, diseño y entregables WAV.</p>
        </div>
        <button data-testid="open-live-studio-home" className="workspace-primary" type="button" onClick={() => onOpenStudio({ mode: 'direct' })}>
          <AnimatedIcon name="audio-waveform" variant="oscillate" trigger="hover" />
          Crear en el estudio
        </button>
      </div>

      <div className="workspace-metrics">
        <Metric icon="cpu" value={`${readyEngines}/${engines.length}`} label="motores disponibles" caption={online ? 'Lectura en vivo del backend local' : 'Catálogo local de referencia'} />
        <Metric icon="mic" value={String(voiceCount)} label="voces disponibles" caption={online ? 'Voces leídas del backend' : 'Catálogo offline'} />
        <Metric icon="folder" value={String(libraryCount)} label="entregables en biblioteca" caption={online ? 'Archivos indexados localmente' : 'Conecta el backend para leerlos'} />
        <Metric icon="hard-drive" value={`${status.hardware.vram_limit_gb} GB`} label="límite de VRAM" caption={`${status.hardware.cpu_threads} hilos CPU configurados`} />
      </div>

      <div className="workspace-home-grid">
        <section className="workspace-feature-panel workspace-signal-panel">
          <div className="workspace-panel-heading"><span>ESTUDIO NEURAL</span><b>{status.active_provider ?? 'Motor local listo'}</b></div>
          <div className="workspace-signal" aria-hidden="true">{Array.from({ length: 44 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 72)}%` }} />)}</div>
          <h2>Escribe, prueba y exporta una voz de producción.</h2>
          <p>El estudio conserva el motor efectivo, la voz seleccionada, los controles de tono y velocidad, la forma de onda y la biblioteca.</p>
          <div className="workspace-inline-actions">
            <button className="workspace-primary" type="button" onClick={() => onOpenStudio({ mode: 'direct' })}>Abrir síntesis</button>
            <button className="workspace-secondary" type="button" onClick={() => onOpenStudio({ mode: 'clone' })}>Clonar una voz</button>
          </div>
        </section>

        <section className="workspace-feature-panel workspace-quick-panel">
          <div className="workspace-panel-heading"><span>ACCESOS REALES</span><b>Sin demos simuladas</b></div>
          <button type="button" className="workspace-quick-card" onClick={() => onOpenStudio({ mode: 'clone' })}>
            <AnimatedIcon name="fingerprint" variant="pulse" trigger="hover" />
            <span><strong>Clonación zero-shot</strong><small>Carga una referencia y ejecuta el motor compatible.</small></span>
            <AnimatedIcon name="chevron-right" />
          </button>
          <button type="button" className="workspace-quick-card" onClick={() => onOpenStudio({ mode: 'dna' })}>
            <AnimatedIcon name="sparkles" variant="oscillate" trigger="hover" />
            <span><strong>Diseño de voz DNA</strong><small>Genera una voz desde una descripción usando los modelos locales.</small></span>
            <AnimatedIcon name="chevron-right" />
          </button>
          <button type="button" className="workspace-quick-card" onClick={() => onNavigate('biblioteca')}>
            <AnimatedIcon name="folder" variant="bounce" trigger="hover" />
            <span><strong>Biblioteca auditable</strong><small>Revisa WAV y metadatos generados por el backend.</small></span>
            <AnimatedIcon name="chevron-right" />
          </button>
        </section>
      </div>

      <section className="workspace-section">
        <div className="workspace-section-heading"><div><span>CONFIGURACIONES PREDEFINIDAS</span><h2>Comienza con un guion y continúa en la consola real.</h2></div><button type="button" className="workspace-text-button" onClick={() => onNavigate('presets')}>Ver todos <AnimatedIcon name="chevron-right" /></button></div>
        <div className="workspace-preset-grid">
          {PRESET_SCRIPTS.slice(0, 3).map((preset, index) => (
            <button key={preset.label} type="button" className="workspace-preset-card" onClick={() => onOpenStudio({ mode: 'direct', text: preset.text })}>
              <span className="workspace-preset-number">0{index + 1}</span>
              <AnimatedIcon name={index === 0 ? 'book-open' : index === 1 ? 'audio-lines' : 'wand'} variant="oscillate" trigger="hover" />
              <strong>{preset.label}</strong>
              <small>{preset.text.slice(0, 88)}…</small>
              <em>Abrir en estudio <AnimatedIcon name="chevron-right" /></em>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ icon, value, label, caption }: { icon: IconName; value: string; label: string; caption: string }) {
  return <article className="workspace-metric"><AnimatedIcon name={icon} variant="pulse" trigger="hover" /><div><strong>{value}</strong><span>{label}</span><small>{caption}</small></div></article>;
}

function VoicesPage({ online, engines, voices, onOpenStudio }: { online: boolean; engines: EngineInfo[]; voices: VoiceInfo[]; onOpenStudio: (launch: StudioLaunch) => void }) {
  const fallbackVoices: VoiceInfo[] = engines.flatMap((engine) => Array.from({ length: engine.voices_count }, (_, index) => ({
    id: `${engine.id}-${index}`,
    name: `${engine.name} · voz ${index + 1}`,
    engine: engine.id,
    region: 'LOCAL',
    gender: 'MIX',
    sample_rate: 0,
    quality: 'CATÁLOGO',
    description: 'Nombre disponible al conectar el backend local.',
    supports_cloning: false,
    supports_emotion: false,
  })));
  const listedVoices = online ? voices : fallbackVoices;
  return <PageHead eyebrow="CATÁLOGO LOCAL" title="Mis voces" description={online ? 'Voces detectadas por los motores disponibles. Selecciona una para continuar en la consola.' : 'Conecta el backend local para consultar los nombres y metadatos reales de cada voz.'} action={<button className="workspace-primary" type="button" onClick={() => onOpenStudio({ mode: 'clone' })}>Nueva voz clonada</button>}>
    <div className="workspace-catalog-grid">
      {listedVoices.map((voice) => {
        const config = getEngineIconConfig(voice.engine);
        return <article className="workspace-voice-card" key={voice.id}><div><AnimatedIcon name={config.name} variant={config.variant} trigger="hover" /><span>{voice.engine}</span></div><h2>{voice.name}</h2><p>{voice.description ?? 'Catálogo local de voz.'}</p><footer><small>{voice.region} · {voice.gender} · {voice.quality}</small><button type="button" onClick={() => onOpenStudio({ mode: 'direct', engineId: voice.engine, voiceId: voice.id })}>Usar <AnimatedIcon name="chevron-right" /></button></footer></article>;
      })}
    </div>
  </PageHead>;
}

function EnginesPage({ online, engines, onOpenStudio }: { online: boolean; engines: EngineInfo[]; onOpenStudio: (launch: StudioLaunch) => void }) {
  return <PageHead eyebrow="INVENTARIO DE EJECUCIÓN" title="Motores locales" description={online ? 'Disponibilidad, memoria estimada y proveedor activo leídos desde el backend local.' : 'Información del catálogo local. Conecta el backend para comprobar disponibilidad real.'} action={<button className="workspace-secondary" type="button" onClick={() => onOpenStudio({ mode: 'direct' })}>Abrir consola</button>}>
    <div className="workspace-engine-list">
      {engines.map((engine) => { const config = getEngineIconConfig(engine.id); return <article key={engine.id} className={`workspace-engine-row ${engine.active ? 'active' : ''}`}><AnimatedIcon name={config.name} variant={config.variant} trigger="hover" /><div><h2>{engine.name}</h2><p>{engine.description}</p><small>{engine.category} · {engine.license}</small></div><div className="workspace-engine-meta"><span className={engine.available ? 'ready' : 'missing'}>{engine.available ? 'Disponible' : 'No disponible'}</span><strong>{Math.round(engine.estimated_mb)} MB</strong><button type="button" onClick={() => onOpenStudio({ mode: 'direct', engineId: engine.id })}>Usar</button></div></article>; })}
    </div>
  </PageHead>;
}

function LibraryPage({ online, query, items, onQueryChange, onOpenStudio }: { online: boolean; query: string; items: LibraryItem[]; onQueryChange: (value: string) => void; onOpenStudio: (launch: StudioLaunch) => void }) {
  return <PageHead eyebrow="ENTREGABLES LOCALES" title="Biblioteca" description={online ? 'Resultados indexados por la API local. Cada archivo conserva el origen de motor y voz.' : 'La biblioteca se carga al conectar el backend local.'} action={<button className="workspace-primary" type="button" onClick={() => onOpenStudio({ mode: 'direct' })}>Nueva síntesis</button>}>
    <label className="workspace-search"><AnimatedIcon name="search" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar por archivo, motor, voz o texto…" /></label>
    {items.length === 0 ? <div className="workspace-empty"><AnimatedIcon name="folder" variant="bounce" trigger="hover" /><h2>No hay resultados para mostrar.</h2><p>{online ? 'Genera una toma en el estudio para verla aquí.' : 'Inicia el backend local y actualiza la interfaz.'}</p></div> : <div className="workspace-library-list">{items.map((item) => <article key={item.id}><button type="button" className="workspace-library-play" onClick={() => window.open(item.audio_url, '_blank', 'noopener,noreferrer')} title="Abrir WAV"><AnimatedIcon name="play" /></button><div><strong>{item.archivo}</strong><span>{item.motor} · {item.voz_id} · {formatDuration(item.metricas?.duracion_audio_seg)}</span><small>{item.prompt_original}</small></div><button type="button" className="workspace-secondary" onClick={() => onOpenStudio({ mode: 'direct', engineId: item.motor, voiceId: item.voz_id })}>Continuar</button></article>)}</div>}
  </PageHead>;
}

function PresetsPage({ onOpenStudio }: { onOpenStudio: (launch: StudioLaunch) => void }) {
  return <PageHead eyebrow="RECETAS DE PARTIDA" title="Presets de guion" description="Estos presets cargan su texto directamente en el compositor real; no crean proyectos ficticios.">
    <div className="workspace-preset-grid wide">{PRESET_SCRIPTS.map((preset, index) => <button key={preset.label} type="button" className="workspace-preset-card" onClick={() => onOpenStudio({ mode: 'direct', text: preset.text })}><span className="workspace-preset-number">{String(index + 1).padStart(2, '0')}</span><AnimatedIcon name={index % 2 ? 'audio-lines' : 'book-open'} variant="oscillate" trigger="hover" /><strong>{preset.label}</strong><small>{preset.text}</small><em>Abrir en estudio <AnimatedIcon name="chevron-right" /></em></button>)}</div>
  </PageHead>;
}

function SettingsPage({ online, status, onOpenStudio }: { online: boolean; status: SystemStatus; onOpenStudio: (launch: StudioLaunch) => void }) {
  const hardware = status.hardware;
  return <PageHead eyebrow="ESTADO DEL ENTORNO" title="Ajustes de la estación" description="Lectura de la configuración local. Los parámetros de cada toma se controlan dentro del estudio.">
    <div className="workspace-settings-grid"><article><AnimatedIcon name="activity" variant="pulse" trigger="hover" /><span>Conexión</span><strong>{online ? 'Backend local conectado' : 'Vista previa offline'}</strong><small>{online ? 'La API está disponible en este equipo.' : 'El modo de vista previa no ejecuta síntesis.'}</small></article><article><AnimatedIcon name="cpu" variant="pulse" trigger="hover" /><span>Proveedor activo</span><strong>{status.active_provider ?? 'Sin motor cargado'}</strong><small>{hardware.available_providers.join(' · ') || 'Proveedor no informado'}</small></article><article><AnimatedIcon name="hard-drive" variant="pulse" trigger="hover" /><span>Recursos</span><strong>{hardware.ram_used_gb.toFixed(1)} / {hardware.ram_total_gb.toFixed(0)} GB RAM</strong><small>VRAM límite: {hardware.vram_limit_gb} GB · CPU: {hardware.cpu_threads} hilos</small></article></div><div className="workspace-setting-callout"><div><AnimatedIcon name="info" /><span><strong>Privacidad local</strong><small>La interfaz no añade telemetría ni llamadas externas. La síntesis se mantiene en tu entorno local.</small></span></div><button type="button" className="workspace-primary" onClick={() => onOpenStudio({ mode: 'direct' })}>Abrir estudio</button></div>
  </PageHead>;
}

function PageHead({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <><div className="workspace-page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>{children}</>;
}
