// VozStudio Atlas - prototipo navegable (sin build, sin dependencias, sin red).
// Modelo: proyecto > documento > bloque > toma. Estado en memoria + localStorage.
//
// Identificadores del estado y valores de data-action SIEMPRE en ASCII.
// Solo el texto visible lleva tildes.

import {
  ENGINES,
  engineById,
  RECIPES,
  recipeById,
  ROLES,
  PROJECTS,
  projectById,
  CLIENT_PRESETS,
  GLOSSARY,
  BATCH_JOB,
  INITIAL_JOBS,
  seeded,
} from './data.js';
import { CATALOG, catalogVoice, CATALOG_TOTAL, catalogByEngine } from './voces.data.js';
import {
  PROMPT_LIBRARY,
  PROMPT_FAMILIES,
  PROMPT_TOTAL,
  searchPrompts,
  PROMPT_LIBRARY_V2,
  PROMPT_V2_STATS,
  searchPromptsV2,
} from './prompts.data.js';
import {
  READ_PRESETS,
  readPresetById,
  DOC_FORMATS,
  DOC_EXAMPLES,
  TEXT_LIMIT,
  sampleText,
  estimateRead,
} from './lectura.data.js';
import {
  CLONE_ENGINES,
  CLONE_SOURCES,
  CLONE_CLEAN_PRESETS,
  CLONE_PRESETS,
  CLONE_STEPS,
  SAMPLE_REFERENCE,
  cloneEngineById,
  clonePresetById,
  cleanPresetById,
  evaluateReference,
  estimateClone,
} from './clonacion.data.js';
import {
  VOICE_FIELDS,
  emptyProfile,
  parseDescription,
  compileProfile,
  profileParts,
  profileCoverage,
  buildPayload,
  SEED_VOICES,
  SEED_CATEGORIES,
  DEFAULT_SPEECH,
  QWEN_MAX_TEXT,
  MAX_INSTRUCTION,
  MASTER_TEMPLATE,
  PROMPT_CHECKS,
  auditPrompt,
  improvePrompt,
} from './qwen.data.js';
import { BRAND, APP_ICON_URI, appMark } from './brand.js';
import {
  esc,
  icon,
  pct,
  fmtTime,
  fmtDuration,
  clamp,
  createToasts,
  panel,
  statCard,
  field,
  rangeControl,
  voiceCard,
  engineOptions,
  paginate,
  pager,
  modalShell,
  meter,
  emptyState,
  bar,
  carrusel,
  moveTray,
  syncTrays,
  attachTrayDrag,
} from './ui.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TITLES = {
  inicio: 'Inicio',
  lectura: 'Lectura y narracion',
  diseno: 'Diseno de voz',
  clonacion: 'Clonacion de voz',
  qwen: 'Qwen Voice Studio',
  produce: 'Producir',
  voces: 'Voces',
  recetas: 'Recetas',
  elenco: 'Elenco',
  presets: 'Presets de cliente',
  glosario: 'Glosario',
  lotes: 'Lotes',
  biblioteca: 'Biblioteca',
  ajustes: 'Ajustes',
};

const THEMES = [
  ['omni', 'Omni Cyan'],
  ['amoled', 'Negro AMOLED'],
  ['grafito', 'Grafito'],
  ['ambar', 'Ambar Studio'],
  ['claro', 'Pearl Light'],
];

/* --------------------------------- ledger --------------------------------- */
const STORE_KEY = 'atlas-prototipo';
const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
})();

const savePrefs = () => {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        theme: state.theme,
        fontScale: state.fontScale,
      }),
    );
  } catch {
    /* localStorage puede estar bloqueado en un iframe sandboxeado */
  }
};

const system = {
  provider: 'DirectML',
  gpu: 41,
  ramUsed: 12.4,
  ramTotal: 32,
  vramUsed: 6.2,
  vramLimit: 25,
  engine: 'kokoro',
  phi: { available: true, device: 'DirectML' },
};

/* --------------------------------- estado --------------------------------- */
const PRESETS_LIST = READ_PRESETS;

const state = {
  route: 'inicio',
  theme: THEMES.some(([id]) => id === stored.theme) ? stored.theme : 'omni',
  fontScale: stored.fontScale || 1,
  // El splash se muestra en cada arranque, como la aplicacion real.
  splash: 'visible',
  splashClosing: false,
  projectId: 'patagonia',
  docId: '07',
  blockId: '07-004',
  // Filtro de la lista de segmentos en Producir: todos, revisar o pendiente.
  produceFilter: 'todos',
  // Cola de trabajo: desplegable e historial de lo ya cerrado.
  queueOpen: false,
  queueHistory: [],
  mode: 'final',
  search: '',
  voiceFilter: 'todas',
  voicePage: 0,
  recipeFilter: 'todas',
  inspectorTab: 'bloque',
  jobs: INITIAL_JOBS.map((job) => ({ ...job })),
  queueRunning: false,
  queueTimer: null,
  modals: [],
  palette: { open: false, query: '', active: 0 },
  player: { blockId: null, playing: false, pos: 0, dur: 0, vol: 0.8, muted: false, timer: null },
  batch: JSON.parse(JSON.stringify(BATCH_JOB)),
  batchRunning: false,
  batchTimer: null,
  nuevoProyecto: { recipeId: 'audiolibro', name: '', license: 'personal' },

  // Modulo de lectura y narracion
  lectura: {
    text: '',
    preset: 'audiolibro',
    engine: 'kokoro',
    voice: 'kokoro-em_alex',
    importFormat: 'pdf',
    files: DOC_EXAMPLES.map((doc) => ({ ...doc })),
    dropHot: false,
    generated: null,
    step: 'editar',
    progress: 0,
    // Nulos mientras no se toquen: el preset manda hasta que el usuario ajusta.
    speed: null,
    pause: null,
    chunk: null,
    emotion: null,
  },

  // Modulo Qwen Voice Studio (Qwen3-TTS VoiceDesign)
  // Version de la biblioteca de prompts que usa Diseno de voz.
  promptVersion: 'v2',

  qwen: {
    description: '',
    profile: emptyProfile(),
    parsed: null,
    phi: false,
    prompt: '',
    promptMode: 'voice_design',
    promptFilter: 'todos',
    promptOpen: null,
    query: '',
    category: 'todas',
    activeTitle: '',
    title: 'Nueva voz',
    speech: DEFAULT_SPEECH,
    master: MASTER_TEMPLATE,
    lastRender: null,
    renders: [],
    saved: [],
  },

  // Modulo de clonacion de voz (F5, XTTS y StyleTTS 2)
  clonacion: {
    step: 'fuente',
    source: 'archivo',
    reference: null,
    recording: false,
    recordSeconds: 0,
    engine: 'f5_spanish',
    cleaning: 'estudio',
    preset: 'narrador-neutro',
    transcript: '',
    cleaningApplied: false,
    testing: false,
    result: null,
    saved: [],
  },

  // Modulo de diseno de voz
  diseno: {
    engine: 'qwen3_tts',
    mode: 'voice_design',
    prompt: '',
    improved: '',
    improvedBy: '',
    sample: 'La lluvia insistia sobre el tejado mientras la ciudad se apagaba despacio.',
    gender: 'F',
    age: 'adulto',
    accent: 'castellano_neutro',
    timbre: 'calido',
    emotion: 'neutro',
    speed: 1,
    temperature: 0.7,
    topP: 0.9,
    seed: 20261109,
    maxTokens: 2048,
    clonePromptText: '',
    reference: null,
    style: 'neutro',
    samplingK: 25,
    gain: 1,
    query: '',
    family: 'todas',
    promptMode: 'todos',
    page: 0,
    generated: null,
    libraryPage: 0,
  },

  ajustes: {
    provider: 'DirectML',
    threads: 12,
    vram: 25,
    excludeNC: false,
    consentGate: true,
    phiClean: true,
    phiCast: true,
    phiNotes: false,
    watchfolder: false,
  },
  grabacion: { step: 1, seconds: 0, level: 0, consent: false, name: 'Elena (voz del autor)' },
};

const toasts = createToasts();
const notify = (title, detail = '', kind = 'ok') => toasts.push(title, detail, kind);

/* ------------------------------- utilidades ------------------------------- */
const project = () => projectById(state.projectId);
const currentDoc = () => project().docs.find((doc) => doc.id === state.docId) || project().docs[0] || null;

function allBlocks() {
  return project().docs.flatMap((doc) => doc.blocks);
}
function findBlock(id) {
  return allBlocks().find((block) => block.id === id) || null;
}
function chosenTake(block) {
  return block.takes.find((take) => take.id === block.takeId) || block.takes[0];
}
function projectStats(p = project()) {
  const blocks = p.docs.flatMap((doc) => doc.blocks);
  const approved = blocks.filter((block) => block.state === 'aprobado').length;
  const review = blocks.filter((block) => block.state === 'revisar').length;
  const duration = blocks.reduce((acc, block) => {
    const take = chosenTake(block);
    return acc + (take ? take.duration : 0);
  }, 0);
  return { total: blocks.length, approved, review, duration };
}
function estimateRender(chars, engineId = 'piper') {
  const engine = engineById(engineId) || ENGINES[0];
  return Math.max(1, Math.round((chars / 14.5) * engine.rtf));
}
function licenseForRole(project0, recipe) {
  // La app es de uso personal: ningun motor se excluye, solo se informa.
  const cast = project0.cast || [];
  const engines = cast
    .map((slot) => catalogVoice(slot.voiceId))
    .filter(Boolean)
    .map((voice) => engineById(voice.engine))
    .filter(Boolean);
  const nc = engines.filter((engine) => !engine.commercial);
  return { ok: nc.length === 0, problems: nc, personal: true, recipe: Boolean(recipe) };
}
function roleMeta(roleId) {
  return ROLES.find((r) => r.id === roleId) || ROLES[0];
}
function voiceLabel(id) {
  const voice = catalogVoice(id);
  return voice ? voice.name : 'Sin asignar';
}

/* ------------------------------ saludo y clima ---------------------------- */
const PLACES = [
  { city: 'Trujillo', region: 'La Libertad', country: 'Peru' },
  { city: 'Lima', region: 'Lima', country: 'Peru' },
  { city: 'Arequipa', region: 'Arequipa', country: 'Peru' },
];

function greetingParts() {
  const now = new Date();
  const hour = now.getHours();
  const saludo = hour < 12 ? 'Buenos dias' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const date = `${days[now.getDay()]} ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const place = PLACES[0];
  return {
    saludo,
    date,
    time,
    place: `${place.city}, ${place.region} - ${place.country}`,
    utcOffset: '-05:00',
  };
}

/* -------------------------------- simulacion ------------------------------ */
// El generador determinista vive en data.js (semilla mezclada antes de generar).
// Habia dos copias identicas; con una sola, el paquete plano no colisiona.

function waveBars(seed, count = 44) {
  const random = seeded(seed);
  return Array.from({ length: count }, () => 18 + Math.round(random() * 82));
}

/* ---------------------------------- audio --------------------------------- */
function playerBlock() {
  const id = state.player.blockId || state.blockId;
  return findBlock(id) || allBlocks()[0];
}

function startPlayer(blockId) {
  const block = findBlock(blockId);
  if (!block) return;
  stopPlayer();
  const take = chosenTake(block);
  state.player = {
    ...state.player,
    blockId,
    playing: true,
    pos: 0,
    dur: take ? take.duration : 2,
    timer: setInterval(() => {
      if (!state.player.playing) return;
      state.player.pos = Math.min(state.player.dur, state.player.pos + 0.2);
      if (state.player.pos >= state.player.dur) {
        stopPlayer();
        notify('Fin del bloque', `${block.id} · ${fmtTime(state.player.dur)}`, 'ok');
      }
      paintPlayer();
    }, 200),
  };
  paintPlayer();
}

function stopPlayer() {
  if (state.player.timer) clearInterval(state.player.timer);
  state.player.playing = false;
  state.player.timer = null;
}

function paintPlayer() {
  const block = playerBlock();
  const take = block ? chosenTake(block) : null;
  const playing = state.player.playing && state.player.blockId === (block ? block.id : null);
  $$('[data-player-bar]').forEach((node) => {
    const total = take ? take.duration : 1;
    const ratio = playing ? clamp(state.player.pos / total, 0, 1) : 0;
    node.style.setProperty('--pos', `${(ratio * 100).toFixed(1)}%`);
  });
  $$('[data-player-time]').forEach((node) => {
    node.textContent = playing ? `${fmtTime(state.player.pos)} / ${fmtTime(take ? take.duration : 0)}` : fmtTime(take ? take.duration : 0);
  });
  $$('[data-player-btn]').forEach((node) => {
    node.innerHTML = playing ? icon('pause', 'sm') : icon('play', 'sm');
    node.setAttribute('aria-label', playing ? 'Pausar' : 'Escuchar');
  });
}

/* ---------------------------------- cola ---------------------------------- */
function queueTotal() {
  return state.jobs.reduce((acc, job) => acc + (job.total || 0), 0);
}
function queueDone() {
  return state.jobs.reduce((acc, job) => acc + ((job.state === 'listo' ? job.total : job.progress) || 0), 0);
}
/** Trabajos ya cerrados, los ultimos primero: se ven al desplegar la cola. */
function queueHistory() {
  return (state.queueHistory || []).slice(-12).reverse();
}
function enqueueRender(doc, mode, blocks) {
  if (!doc) return;
  const total = blocks && blocks.length ? blocks.length : doc.blocks.filter((b) => b.state !== 'aprobado' || mode === 'final').length;
  const job = {
    id: `job-${Date.now()}`,
    kind: 'render',
    title: `${doc.title.split(' - ')[0]} · ${total} bloques`,
    detail: `${engineById(mode === 'draft' ? 'piper' : project().cast?.[0]?.voiceId ? catalogVoice(project().cast[0].voiceId)?.engine || 'kokoro' : 'kokoro').name} · ${mode === 'draft' ? 'borrador' : 'final'}`,
    state: 'pendiente',
    progress: 0,
    total,
  };
  state.jobs.push(job);
  notify('Trabajo en cola', `${job.title} · ${job.detail}`, 'ok');
  if (!state.queueRunning) runQueue();
}

function runQueue() {
  state.queueRunning = true;
  if (state.queueTimer) clearInterval(state.queueTimer);
  state.queueTimer = setInterval(() => {
    const job = state.jobs.find((item) => item.state === 'pendiente' || item.state === 'ejecutando');
    if (!job) {
      state.queueRunning = false;
      clearInterval(state.queueTimer);
      state.queueTimer = null;
      renderQueue();
      return;
    }
    job.state = 'ejecutando';
    job.progress = Math.min(job.total, job.progress + Math.max(1, Math.round(job.total / 12)));
    if (job.progress >= job.total) {
      job.state = 'listo';
      applyJobResult(job);
    }
    renderQueue();
    if (state.route === 'produce') paintProduceCounters();
  }, 420);
}

function applyJobResult(job) {
  if (!job.blocks) return;
  job.blocks.forEach((blockId) => {
    const block = findBlock(blockId);
    if (block) {
      block.state = 'revisar';
      block.takes = block.takes.map((take) => ({ ...take }));
    }
  });
  notify('Documento renderizado', `${job.title} · listo para tu escucha`, 'ok');
}

function renderQueue() {
  const node = $('#queue-strip');
  if (node) node.outerHTML = queueStripHtml();
  const badge = $('#queue-badge');
  if (badge) badge.textContent = String(state.jobs.filter((job) => job.state !== 'listo').length);
}

function queueStripHtml() {
  const active = state.jobs.find((job) => job.state === 'ejecutando');
  const pending = state.jobs.filter((job) => job.state === 'pendiente');
  const done = queueDone();
  const total = queueTotal();
  return `<div class="queue-strip" id="queue-strip" aria-live="polite">
    <span class="q-icon">${icon(active ? 'zap' : 'check', 'sm')}</span>
    <div class="q-text">
      <strong>${active ? esc(active.title) : pending.length ? `${pending.length} trabajos en cola` : 'Cola vacia: todo renderizado'}</strong>
      <span>${active ? `${esc(active.detail)} · bloque ${active.progress} de ${active.total}` : '1 worker GPU · agrupado por motor'}</span>
    </div>
    <div class="q-meta mono">${done}/${total}</div>
    <div class="q-bar"><div class="bar"><i style="width:${pct(done, total || 1)}%"></i></div></div>
    ${active ? `<button class="btn sm" data-action="queue:pause">Pausar</button>` : ''}
    <button class="btn sm icon-only" data-action="queue:toggle" aria-label="Ver trabajos de la cola" aria-expanded="${state.queueOpen ? 'true' : 'false'}">${icon(state.queueOpen ? 'chevron' : 'terminal', 'sm')}</button>
  </div>
  <div class="q-jobs">
    ${[...state.jobs, ...queueHistory()].slice(0, 24).map((job) => `<div class="q-job">
        <span class="badge ${job.state === 'listo' ? 'ok' : job.state === 'ejecutando' ? 'accent' : job.state === 'error' ? 'danger' : ''}">${esc(job.state)}</span>
        <span class="grow truncate">${esc(job.title)}</span>
        <span class="mono">${job.progress}/${job.total}</span>
        <span class="spacer"></span>
        <span class="mono">${esc(job.eta || '--')}</span>
      </div>`).join('') || '<p class="tiny dim">Sin trabajos registrados.</p>'}
  </div>`;
}

/* ---------------------------------- tema ---------------------------------- */
function themeOptions() {
  return THEMES.map(([id, label]) => `<option value="${id}"${state.theme === id ? ' selected' : ''}>${label}</option>`).join('');
}

function applyTheme() {
  const app = $('#app');
  if (!app) return;
  app.dataset.theme = state.theme;
  app.dataset.fontScale = String(state.fontScale);
}

/* ------------------------------ piezas fijas ------------------------------ */
function healthCard() {
  const gpu = Math.round(system.gpu);
  return `<div class="health">
    <header><span><i class="dot"></i> Sistema local</span><strong>Estable</strong></header>
    <div class="health-row"><span>Proveedor</span><b>${esc(system.provider)}</b></div>
    <div class="health-row"><span>Motor activo</span><b>${esc(engineById(system.engine).name)}</b></div>
    <div class="health-row"><span>GPU</span><b>${gpu} %</b></div>
    ${meter(gpu, gpu > 85 ? 'warn' : '', 'Uso de GPU')}
    <div class="health-row"><span>RAM</span><b>${system.ramUsed.toFixed(1)} / ${system.ramTotal} GB</b></div>
    ${meter(pct(system.ramUsed, system.ramTotal), '', 'Uso de RAM')}
  </div>`;
}

function sidebarHtml() {
  const stats = projectStats();
  const pending = state.jobs.filter((job) => job.state !== 'listo').length;
  const navItem = (route, iconName, label, badge) =>
    `<button data-action="nav" data-route="${route}" ${state.route === route ? 'aria-current="page"' : ''}>
      ${icon(iconName, 'sm')}<span>${label}</span>${badge ? `<em class="badge-x${state.route === route ? ' accent' : ''}">${badge}</em>` : ''}
    </button>`;
  return `<aside class="sidebar">
    <div class="brand">
      <span class="brand-mark">${appMark(38)}</span>
      <div class="brand-text"><strong>VozStudio</strong><span>Atlas · uso personal</span></div>
    </div>
    <nav class="nav" aria-label="Navegacion principal">
      <span class="nav-label">Trabajo</span>
      ${navItem('inicio', 'home', 'Inicio')}
      ${navItem('lectura', 'book', 'Lectura y narracion')}
      ${navItem('diseno', 'wand', 'Diseno de voz', String(PROMPT_TOTAL))}
      ${navItem('qwen', 'cpu', 'Qwen Voice Studio', 'Qwen3')}
      ${navItem('clonacion', 'mic', 'Clonacion de voz', String(CLONE_PRESETS.length))}
      ${navItem('produce', 'grid', 'Producir', stats.review ? String(stats.review) : '')}
      ${navItem('biblioteca', 'folder', 'Biblioteca')}
      <span class="nav-label">Recursos</span>
      ${navItem('voces', 'mic', 'Voces', String(CATALOG_TOTAL))}
      ${navItem('recetas', 'sliders', 'Recetas', String(RECIPES.length))}
      ${navItem('elenco', 'users', 'Elenco')}
      ${navItem('presets', 'star', 'Presets de cliente')}
      ${navItem('glosario', 'file', 'Glosario')}
      <span class="nav-label">Automatizar</span>
      ${navItem('lotes', 'layers', 'Lotes')}
      <span class="nav-label">Sistema</span>
      ${navItem('ajustes', 'settings', 'Ajustes')}
    </nav>
    <div class="sidebar-foot">
      ${healthCard()}
      <div class="side-profile">
        <span class="avatar">${BRAND.initials}</span>
        <div><strong>${esc(BRAND.author)}</strong><small>Proyecto local</small></div>
        <span style="margin-left:auto;color:var(--text-4)">${icon('lock', 'sm')}</span>
      </div>
    </div>
  </aside>`;
}

function footerHtml() {
  return `<footer class="app-footer" role="contentinfo">
    <span class="footer-mark" aria-hidden="true">${appMark(18)}</span>
    <span class="footer-text">Human AI Synergy <b>by Benner Castillo</b></span>
    <span class="footer-sep">·</span>
    <span class="footer-meta">VozStudio Atlas · 100% local · ${state.jobs.filter((job) => job.state !== 'listo').length} en cola</span>
  </footer>`;
}

function topbarHtml() {
  const crumbs =
    state.route === 'produce'
      ? `<span>${esc(project().name)}</span>${icon('chevron', 'sm')}<b>${esc(currentDoc() ? currentDoc().title.split(' - ')[0] : 'Sin documento')}</b>`
      : state.route === 'elenco' || state.route === 'presets' || state.route === 'lectura' || state.route === 'diseno' || state.route === 'qwen' || state.route === 'clonacion'
        ? `<span>${esc(project().name)}</span>${icon('chevron', 'sm')}<b>${TITLES[state.route]}</b>`
        : `<b>${TITLES[state.route] || 'Inicio'}</b>`;
  return `<header class="topbar">
    <div class="crumbs">${crumbs}</div>
    <div class="topbar-right">
      <button class="btn sm tb-shortcut ${state.route === 'qwen' ? 'primary' : ''}" data-action="nav" data-route="qwen" title="Abrir Qwen Voice Studio">
        ${icon('cpu', 'sm')}<span>Qwen</span>
      </button>
      <label class="sr-only" for="project-select">Proyecto</label>
      <select id="project-select" class="select" data-action="project:switch" style="width:auto;max-width:170px;height:36px" title="Cambiar de proyecto">
        ${PROJECTS.map((item) => `<option value="${item.id}" ${item.id === state.projectId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
      </select>
      <button class="search" data-action="palette:open" aria-label="Buscar o ejecutar un comando">
        ${icon('search', 'sm')}<span>Buscar voces, bloques, comandos</span><kbd>Ctrl K</kbd>
      </button>
      <span class="sys-pill" title="Datos reales del backend">
        <i class="dot"></i>${esc(system.provider)} <span class="dim">·</span> ${esc(engineById(system.engine).name)}
      </span>
      <label class="sr-only" for="theme-select">Tema</label>
      <select id="theme-select" class="select" data-action="theme:set" style="width:auto;max-width:150px;height:36px">${themeOptions()}</select>
      <button class="btn icon-only" data-action="help" aria-label="Ayuda del prototipo">${icon('info')}</button>
    </div>
  </header>`;
}

/* ================================= SPLASH ================================= */
function splashHtml() {
  if (state.splash === 'visto') return '';
  return `<div class="splash ${state.splashClosing ? 'closing' : ''}" id="splash" role="dialog" aria-label="Inicio de VozStudio Atlas">
    <div class="splash-glow"></div>
    <div class="splash-wave one" aria-hidden="true">
      ${[0, 1]
        .map(
          () => `<svg viewBox="0 0 1000 200" preserveAspectRatio="none">
        <path d="M0,100 C150,250 300,-50 500,100 C700,250 850,-50 1000,100" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linecap="round"/>
        <path d="M0,100 C200,180 300,20 500,100 C700,180 800,20 1000,100" fill="none" stroke="#ffb700" stroke-width="1" stroke-linecap="round" opacity=".5"/>
      </svg>`,
        )
        .join('')}
    </div>
    <div class="splash-wave two" aria-hidden="true">
      ${[0, 1]
        .map(
          () => `<svg viewBox="0 0 1000 200" preserveAspectRatio="none">
        <path d="M0,100 C250,-80 350,280 500,100 C650,-80 750,280 1000,100" fill="none" stroke="#00e5ff" stroke-width="4" stroke-linecap="round"/>
      </svg>`,
        )
        .join('')}
    </div>

    <div class="splash-content">
      <div class="splash-core">
        <span class="splash-ring outer"></span>
        <span class="splash-ring inner"></span>
        ${appMark(140)}
        <div class="splash-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </div>

      <div class="splash-brand">
        <h1>VOZ<span>STUDIO</span></h1>
        <h2>Atlas · produccion de contenido hablado</h2>
        <p>100% local, 100% en espanol. ${CATALOG_TOTAL} voces de ${ENGINES.length} motores y ${PROMPT_TOTAL} prompts de diseno.</p>
      </div>

      <button class="splash-start" data-action="splash:start" aria-label="Iniciar VozStudio Atlas">
        <i aria-hidden="true"></i>
        <span><strong>INICIAR</strong>${icon('arrow', 'sm')}</span>
      </button>

      <div class="splash-loader" aria-hidden="true"><i></i></div>
      <p class="splash-credit">Human AI Synergy <b>By Benner Castillo</b></p>
    </div>
    <button class="splash-skip" data-action="splash:skip">Entrar directo</button>
  </div>`;
}

function closeSplash() {
  if (state.splash === 'visto') return;
  state.splashClosing = true;
  state.splash = 'closing';
  const node = $('#splash');
  if (node) node.classList.add('closing');
  setTimeout(() => {
    state.splash = 'visto';
    state.splashClosing = false;
    const splash = $('#splash');
    if (splash) splash.remove();
  }, 620);
}

/* ============================ INICIO (saludo) ============================= */
function greetingHtml() {
  const g = greetingParts();
  return `<div class="greeting">
    <h1>${esc(g.saludo)}, Benner</h1>
    <div class="greet-line">
      <span>${icon('clock', 'sm')}<b>${esc(g.time)}</b> · hora local (UTC${g.utcOffset})</span>
      <span>${icon('info', 'sm')}<b>${esc(g.date)}</b></span>
      <span>${icon('target', 'sm')}<b>${esc(g.place)}</b></span>
    </div>
    <p class="muted tiny" style="margin-top:6px">${PROJECTS.length} proyectos · ${projectStats().review} bloques necesitan tu escucha · todo se procesa en tu equipo</p>
  </div>`;
}

function viewInicio() {
  const p = project();
  const stats = projectStats(p);
  const totalDuration = PROJECTS.reduce((acc, item) => acc + projectStats(item).duration, 0);
  const recipe = recipeById(p.recipeId);
  const license = licenseForRole(p, recipe);
  return `
  <div class="stack-4">
    <div class="row between wrap">
      ${greetingHtml()}
      <div class="row">
        <button class="btn" data-action="nav" data-route="biblioteca">${icon('folder', 'sm')} Biblioteca</button>
        <button class="btn primary" data-action="project:new">${icon('plus', 'sm')} Nuevo proyecto</button>
      </div>
    </div>

    <div class="stat-grid">
      ${statCard('Voces disponibles', String(CATALOG_TOTAL), `en ${ENGINES.length} motores · sin exclusiones`, 'accent')}
      ${statCard('Audio producido', fmtDuration(totalDuration), 'tomas aprobadas en todos los proyectos')}
      ${statCard('Bloques aprobados', `${stats.approved}<span class="dim" style="font-size:var(--text-lg)">/${stats.total}</span>`, esc(p.name) + ' · ' + pct(stats.approved, stats.total || 1) + ' %', 'ok')}
      ${statCard('En cola ahora', String(state.jobs.filter((j) => j.state !== 'listo').length), '1 worker GPU · agrupado por motor', state.queueRunning ? 'warn' : '')}
    </div>

    <div class="two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Continuar</p>
            <h2>${esc(p.name)} · ${esc(currentDoc() ? currentDoc().title : 'sin capitulos')}</h2>
          </div>
          <span class="spacer"></span>
          <span class="badge accent">${esc(recipe.name)}</span>
        </div>
        <div class="panel-body stack-3">
          <div class="row between tiny muted">
            <span>${stats.approved} de ${stats.total} bloques aprobados · ${fmtDuration(stats.duration)} de audio</span>
            <span class="mono">${pct(stats.approved, stats.total || 1)} %</span>
          </div>
          ${bar(pct(stats.approved, stats.total || 1), 'ok')}
          <div class="row wrap">
            <button class="btn primary" data-action="resume">${icon('play', 'sm')} Retomar produccion</button>
            <button class="btn" data-action="queue:render-doc">${icon('refresh', 'sm')} Renderizar pendientes</button>
            <button class="btn" data-action="modal:export">${icon('download', 'sm')} Exportar capitulo</button>
            <span class="grow"></span>
            ${
              license.ok
                ? `<span class="badge ok">${icon('shield', 'sm')} Licencias comercialmente limpias</span>`
                : `<span class="badge info" title="Uso personal declarado">${icon('info', 'sm')} ${license.problems.length} motor no comercial · permitido en uso personal</span>`
            }
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Esta semana</p><h2>Rendimiento real</h2></div></div>
        <div class="panel-body tight">
          <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Motor</th><th class="num">RTF</th><th class="num">Audio</th><th class="num">Tiempo</th></tr></thead>
            <tbody>
              <tr><td>Piper</td><td class="num mono">0,050</td><td class="num mono">6 h 12 min</td><td class="num mono">18 min</td></tr>
              <tr><td>Kokoro</td><td class="num mono">0,285</td><td class="num mono">4 h 40 min</td><td class="num mono">1 h 19 min</td></tr>
              <tr><td>CosyVoice</td><td class="num mono">0,700</td><td class="num mono">48 min</td><td class="num mono">33 min</td></tr>
              <tr><td>Qwen3</td><td class="num mono">0,900</td><td class="num mono">12 min</td><td class="num mono">11 min</td></tr>
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>

    <section class="panel projects-panel">
      <div class="panel-head">
        <div><p class="eyebrow">Bandeja</p><h2>Proyectos</h2></div>
        <span class="spacer"></span>
        <span class="badge">${PROJECTS.length}</span>
        <span class="badge">12 por vista</span>
      </div>
      <div class="panel-body tight">
        ${carrusel({
          id: 'proyectos',
          porVista: 12,
          cols: 4,
          etiqueta: 'proyectos',
          items: PROJECTS.map((item) => {
            const s = projectStats(item);
            const r = recipeById(item.recipeId);
            return `<article class="card">
              <div class="card-top">
                <span class="card-icon">${icon(r.icon)}</span>
                <div class="grow" style="min-width:0"><h3 class="truncate">${esc(item.name)}</h3><p class="tiny">${esc(r.name)} · ${s.total} bloques</p></div>
                <span class="badge ${item.id === state.projectId ? 'accent' : ''}">${item.id === state.projectId ? 'abierto' : 'ver'}</span>
              </div>
              <div class="row between tiny muted"><span>${s.approved}/${s.total} aprobados</span><span>${fmtDuration(s.duration)}</span></div>
              ${bar(pct(s.approved, s.total || 1), 'ok')}
              <div class="card-foot">
                <button class="btn sm" data-action="project:open" data-project="${item.id}">${icon('arrow', 'sm')} Abrir</button>
                <button class="btn sm" data-action="nav" data-route="produce">${icon('grid', 'sm')} Producir</button>
              </div>
            </article>`;
          }),
        })}
      </div>
    </section>
  </div>`;
}

/* ========================= LECTURA Y NARRACION ============================ */
function lecturaStats() {
  const lectura = state.lectura;
  const base = readPresetById(lectura.preset);
  // Los ajustes propios mandan; si no se han tocado, se usan los del preset.
  const preset = {
    ...base,
    speed: lectura.speed ?? base.speed,
    pause: lectura.pause ?? base.pause,
    chunk: lectura.chunk ?? base.chunk,
    emotion: lectura.emotion ?? base.emotion,
  };
  const engine = engineById(lectura.engine) || engineById('kokoro');
  const chunks = Math.max(1, Math.ceil(lectura.text.length / preset.chunk));
  const est = estimateRead(lectura.text.length, engine.rtf, chunks);
  return { text: lectura.text, preset, engine, chunks, est, chars: lectura.text.length, words: lectura.text.trim() ? lectura.text.trim().split(/\s+/).length : 0 };
}

function viewLectura() {
  const s = lecturaStats();
  const voice = catalogVoice(state.lectura.voice);
  const engineVoices = CATALOG.filter((item) => item.engine === state.lectura.engine);
  const over = s.chars > TEXT_LIMIT;
  const ratio = pct(s.chars, TEXT_LIMIT);
  const tone = over ? 'danger' : s.chars > TEXT_LIMIT * 0.85 ? 'warn' : '';
  return `
  <div class="stack-4 screen-fill">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Lectura y narracion</h1>
        <p class="tiny muted mt-2">Pega hasta ${TEXT_LIMIT.toLocaleString('es-ES')} caracteres o importa PDF, EPUB, TXT, DOCX, MD o SRT. Despues elige un preset y el motor hace el resto.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="lectura:sample">${icon('file', 'sm')} Cargar texto de ejemplo</button>
        <button class="btn primary" data-action="lectura:generate">${icon('zap', 'sm')} Generar audio</button>
      </div>
    </div>

    <div class="read-grid">
      <div class="read-col c1">
        <section class="panel">
          <div class="panel-head">
            <div><p class="eyebrow">Paso 1</p><h2>Texto o documento</h2></div>
            <span class="spacer"></span>
            <span id="lectura-badge" class="badge ${over ? 'danger' : tone === 'warn' ? 'warn' : 'ok'}">${s.chars.toLocaleString('es-ES')} / ${TEXT_LIMIT.toLocaleString('es-ES')}</span>
          </div>
          <div class="panel-body stack-3 read-editor">
            <label class="sr-only" for="lectura-text">Texto para narrar</label>
            <textarea id="lectura-text" class="textarea" maxlength="${TEXT_LIMIT + 500}" placeholder="Pega aqui el capitulo, el guion o el articulo. El normalizador fonetico expande cifras y siglas, y el segmentador lo parte en bloques de ${s.preset.chunk} caracteres." data-action="lectura:text">${esc(s.text)}</textarea>
            <div id="lectura-counter" class="counter-bar ${tone}"><i style="width:${Math.min(100, ratio)}%"></i></div>
            <div class="read-meta">
              <span><b>${s.chars.toLocaleString('es-ES')}</b> caracteres</span>
              <span><b>${s.words.toLocaleString('es-ES')}</b> palabras</span>
              <span><b>${s.chunks}</b> bloques de ${s.preset.chunk}</span>
              <span><b>${fmtDuration(s.est.seconds)}</b> de audio estimado</span>
              <span class="mono dim">RTF ${s.engine.rtf.toFixed(3)} · ${esc(s.engine.name)}</span>
              ${over ? `<span class="over">${icon('alert', 'sm')} supera el limite de una peticion: se enviara por lotes</span>` : ''}
            </div>
            <div class="row wrap">
              <button class="btn sm" data-action="lectura:clear">${icon('trash', 'sm')} Limpiar</button>
              <button class="btn sm" data-action="lectura:normalize">${icon('sparkles', 'sm')} Limpiar guion con IA</button>
              <button class="btn sm" data-action="modal:import">${icon('upload', 'sm')} Importar documento</button>
              <span class="grow"></span>
              <span class="tiny dim">${DOC_FORMATS.map((format) => format.label).join(' · ')}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="read-col c2">
        <section class="panel preset-panel">
          <div class="panel-head">
            <div><p class="eyebrow">Paso 2</p><h2>Preset de lectura</h2></div>
            <span class="spacer"></span>
            <span class="badge accent">${READ_PRESETS.length} predisenados</span>
          </div>
          <div class="panel-body preset-body">
            ${carrusel({
              id: 'presets-lectura',
              porVista: 4,
              cols: 2,
              etiqueta: 'presets de lectura',
              items: READ_PRESETS.map(
                (preset) => `<button class="preset-card" style="--tone:${preset.tone}" data-action="lectura:preset" data-preset="${preset.id}" aria-pressed="${preset.id === state.lectura.preset}">
                  <header>${icon(preset.icon, 'sm')}<h3>${esc(preset.name)}</h3></header>
                  <p>${esc(preset.desc)}</p>
                  <div class="specs">
                    <span>${preset.speed.toFixed(2)}x</span>
                    <span>${preset.pause} ms</span>
                    <span>${preset.chunk} car.</span>
                    <span>${esc(preset.lufs)}</span>
                  </div>
                </button>`,
              ),
            })}
          </div>
        </section>

        <section class="panel tray-import">
          <div class="panel-head">
            <div><p class="eyebrow">Bandeja de importacion</p><h2>Documentos</h2></div>
            <span class="spacer"></span>
            <span class="badge">${state.lectura.files.length}</span>
          </div>
          <div class="panel-body stack-3 import-body">
            <div class="drop drop-import ${state.lectura.dropHot ? 'hot' : ''}" data-drop="documentos">
              ${icon('upload', 'hero')}
              <h4>Arrastra un PDF, EPUB o TXT aqui</h4>
              <p class="tiny muted">El texto se extrae en local. Los PDF escaneados se avisan y se pueden transcribir con ASR opcional.</p>
              <div class="chips">${DOC_FORMATS.map((format) => `<span class="badge">${esc(format.label)}</span>`).join('')}</div>
              <button class="btn sm" data-action="lectura:upload">${icon('plus', 'sm')} Anadir documento de prueba</button>
            </div>
            <div class="file-list" data-scroll-area="documentos-lectura">${state.lectura.files
              .map(
                (file) => `<div class="file-row">
                  <span class="card-icon" style="--tone:var(--accent)">${icon('file', 'sm')}</span>
                  <div style="min-width:0">
                    <div class="file-name">${esc(file.name)}</div>
                    <div class="file-meta">${file.format.toUpperCase()} · ${file.chars.toLocaleString('es-ES')} caracteres${file.pages ? ` · ${file.pages} paginas` : ''}</div>
                  </div>
                  <span class="badge ${file.status === 'listo' ? 'ok' : 'warn'}">${esc(file.status)}</span>
                  <button class="btn sm" data-action="lectura:load" data-file="${file.id}">${icon('upload', 'sm')} Cargar</button>
                </div>`,
              )
              .join('')}</div>
          </div>
        </section>
      </div>

      <div class="read-col c3">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Paso 3</p><h2>Voz y motor</h2></div></div>
          <div class="panel-body stack-3">
            ${field('Motor', `<select class="select" data-action="lectura:engine">${engineOptions(CATALOG, state.lectura.engine)}</select>`)}
            ${field(
              'Voz',
              `<select class="select" data-action="lectura:voice">${engineVoices
                .map((item) => `<option value="${item.id}" ${item.id === state.lectura.voice ? 'selected' : ''}>${esc(item.name)} · ${item.gender} · ${item.region}</option>`)
                .join('')}</select>`,
            )}
            ${voice ? `<div class="spec-inline">
              <div><span>Calidad</span><b>${esc(voice.quality)}</b></div>
              <div><span>Muestra</span><b>${voice.sr / 1000} kHz</b></div>
              <div><span>Licencia</span><b>${esc(engineById(voice.engine).license)}</b></div>
              <div><span>Origen</span><b>${esc(voice.origin)}</b></div>
            </div>` : ''}
            ${rangeControl({ label: 'Velocidad', id: 'read-speed', min: 0.6, max: 1.4, step: 0.01, value: s.preset.speed, action: 'lectura:speed', format: (v) => `${Number(v).toFixed(2)}x` })}
            ${rangeControl({ label: 'Pausa entre bloques', id: 'read-pause', min: 0, max: 3000, step: 50, value: s.preset.pause, action: 'lectura:pause', format: (v) => `${v} ms` })}
            ${rangeControl({ label: 'Tamano de bloque', id: 'read-chunk', min: 80, max: 600, step: 10, value: s.preset.chunk, action: 'lectura:chunk', format: (v) => `${v} caracteres` })}
            ${field('Emocion', `<select class="select" data-action="lectura:emotion" aria-label="Emocion">${['neutro', 'narrativo', 'calido', 'informativo', 'expresivo', 'susurro', 'energico', 'solemne'].map((emotion) => `<option value="${emotion}" ${emotion === s.preset.emotion ? 'selected' : ''}>${emotion}</option>`).join('')}</select>`)}
            <button class="btn primary" data-action="lectura:generate">${icon('zap', 'sm')} Generar ${s.chunks} bloques · ${fmtDuration(s.est.seconds)}</button>
            <p class="tiny dim">${esc(s.preset.note)}</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Entregables</p><h2>${esc(s.preset.name)}</h2></div></div>
          <div class="panel-body stack-3">
            <div class="chips">${s.preset.delivery.split(' · ').map((item) => `<span class="badge">${esc(item)}</span>`).join('')}</div>
            <div class="spec-inline">
              <div><span>Motor</span><b>${esc(s.engine.name)}</b></div>
              <div><span>Loudness</span><b>${esc(s.preset.lufs)}</b></div>
              <div><span>Voz</span><b>${esc(voice ? voice.name : 'sin asignar')}</b></div>
              <div><span>RTF</span><b>${s.engine.rtf.toFixed(3)}</b></div>
            </div>
            ${
              state.lectura.generated
                ? `<div class="stack-2">
                    <div class="row between tiny muted"><span>Bloque ${state.lectura.generated.done} de ${state.lectura.generated.total}</span><span class="mono">${state.lectura.progress} %</span></div>
                    ${bar(state.lectura.progress, state.lectura.progress >= 100 ? 'ok' : '')}
                    <p class="tiny muted">${state.lectura.generated.done >= state.lectura.generated.total ? `${icon('check', 'sm')} Audio listo en Biblioteca · SRT por bloque generado` : 'Renderizando en la cola global...'}</p>
                  </div>`
                : `<p class="tiny dim">${icon('info', 'sm')} El audio aparece en Biblioteca con su JSON auditado y su SRT por bloque.</p>`
            }
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

/* ============================= DISENO DE VOZ ============================== */
function designEngine() {
  return state.diseno.engine === 'cosyvoice' ? 'cosyvoice' : 'qwen3_tts';
}

function disenoPromptFamilyLabel() {
  return state.diseno.family === 'todas' ? 'todas las familias' : (PROMPT_FAMILIES.find((item) => item.id === state.diseno.family) || {}).label;
}

function viewDiseno() {
  const engine = designEngine();
  const d = state.diseno;
  const isCosy = engine === 'cosyvoice';
  const isInstruct = isCosy && d.mode === 'instruct_tts';
  const voiceCount = CATALOG.filter((voice) => voice.engine === engine).length;
  const bars = waveBars(`design-${d.prompt.length}-${engine}`);
  const familias = [{ id: 'todas', label: 'Todas las familias', count: PROMPT_TOTAL }, ...PROMPT_FAMILIES];
  const usaV2 = state.promptVersion !== 'v1';
  const busca = usaV2 ? searchPromptsV2 : searchPrompts;
  const muestra = busca(d.query, d.family, d.promptMode).slice(0, 60);
  void voiceCount;

  return `
  <div class="stack-4 screen-fill design-screen">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Diseno de voz</h1>
        <p class="tiny muted mt-2">Qwen3 VoiceDesign describe el timbre; CosyVoice Instruct-TTS controla estilo y emocion. ${PROMPT_TOTAL} prompts en la biblioteca.</p>
      </div>
      <div class="segmented" role="group" aria-label="Motor de diseno">
        <button data-action="diseno:engine" data-engine="qwen3_tts" aria-pressed="${engine === 'qwen3_tts'}">Qwen3 VoiceDesign</button>
        <button data-action="diseno:engine" data-engine="cosyvoice" aria-pressed="${engine === 'cosyvoice'}">CosyVoice Instruct</button>
      </div>
    </div>

    <div class="design-board">

      <section class="panel design-prompt-col">
        <div class="panel-head">
          <div><p class="eyebrow">Paso 1 · Prompt</p><h2>${isInstruct ? 'Instruccion de estilo' : 'Descripcion de la voz'}</h2></div>
          <span class="spacer"></span>
          <span class="badge">${d.prompt.length} / 1500</span>
        </div>

        <!-- Mitad superior: lo que se le pide al motor. -->
        <div class="prompt-half">
          ${
            isCosy
              ? `<div class="segmented" role="group" aria-label="Modo de CosyVoice">
                  <button data-action="diseno:mode" data-mode="voice_design" aria-pressed="${d.mode === 'voice_design'}">Referencia zero-shot</button>
                  <button data-action="diseno:mode" data-mode="instruct_tts" aria-pressed="${d.mode === 'instruct_tts'}">Instruct-TTS</button>
                </div>`
              : ''
          }
          <div class="prompt-box">
            <label class="sr-only" for="design-prompt">Prompt de diseno</label>
            <textarea id="design-prompt" class="textarea" maxlength="1500" placeholder="${
              isInstruct
                ? 'Habla con tono sonriente y alegre, proyectando optimismo y energia calida en cada frase.'
                : 'Voz femenina de unos 35 anos, timbre calido y aterciopelado, cadencia pausada y reflexiva, acento castellano neutro, grabacion de estudio.'
            }" data-action="diseno:prompt">${esc(d.prompt)}</textarea>
            <div class="prompt-actions">
              <button class="btn sm primary" data-action="diseno:enhance">${icon('wand', 'sm')} Generar o mejorar prompt con IA</button>
              <button class="btn sm" data-action="diseno:random">${icon('sparkles', 'sm')} Aleatorio</button>
              <button class="btn sm" data-action="diseno:clear-prompt">${icon('trash', 'sm')} Limpiar</button>
            </div>
          </div>
          ${
            d.improved
              ? `<div class="prompt-note compact">${icon('zap', 'sm')}<div><b>Mejorado por ${esc(d.improvedBy)}</b> · ${esc(d.improved)}</div>
                  <button class="btn sm" data-action="diseno:apply-improved">Usar</button></div>`
              : `<p class="tiny dim prompt-footnote">Si Phi-3.5 local no esta disponible, el mejorador cae a heuristicas y lo dice: nunca mejora en silencio.</p>`
          }
        </div>

        <!-- Mitad inferior: la configuracion del motor, hasta el margen. -->
        <div class="engine-half">
          <div class="engine-fields">
            ${
              isInstruct
                ? `<div class="field-group">
                    <div class="field-title">${icon('sliders', 'sm')} CosyVoice Instruct-TTS</div>
                    <div class="cosy-row">
                      ${field('Estilo', `<select class="select" data-action="diseno:style">${['neutro', 'narrativo', 'calido', 'informativo', 'expresivo', 'alegre', 'calmo', 'energico', 'susurro'].map((s) => `<option value="${s}" ${s === d.style ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
                      ${field('Emocion', `<select class="select" data-action="diseno:emotion">${['neutro', 'alegre', 'triste', 'serio', 'susurro', 'misterio', 'entusiasta'].map((s) => `<option value="${s}" ${s === d.emotion ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
                      ${field('Sampling K', `<input class="input" type="number" min="10" max="40" step="1" value="${d.samplingK}" data-action="diseno:k" />`)}
                      <div class="cosy-range">${rangeControl({ label: 'Ganancia', id: 'cosy-gain', min: 0.7, max: 1.1, step: 0.01, value: d.gain, action: 'diseno:gain', format: (v) => `${Number(v).toFixed(2)}x` })}</div>
                      <div class="cosy-range">${rangeControl({ label: 'Velocidad', id: 'cosy-speed', min: 0.6, max: 1.4, step: 0.01, value: d.speed, action: 'diseno:speed', format: (v) => `${Number(v).toFixed(2)}x` })}</div>
                    </div>
                    <p class="tiny dim cosy-contract">Viaja al motor: <span class="mono">instruct</span>, <span class="mono">sampling_k</span>, <span class="mono">speed_factor</span> y <span class="mono">gain</span>.</p>
                  </div>
                  <div class="field-group">
                    <div class="field-title">${icon('mic', 'sm')} Referencia zero-shot (3 a 10 s)</div>
                    <div class="drop ${d.reference ? 'hot' : ''}" data-drop="referencia">
                      ${icon('mic', 'hero')}
                      <h4>${d.reference ? esc(d.reference.name) : 'Arrastra un WAV de referencia'}</h4>
                      <p class="tiny muted">${d.reference ? `${d.reference.seconds} s · transcripcion verificada · condicionamiento bloqueado` : 'El backend exige WAV y transcripcion exacta del fragmento.'}</p>
                      <button class="btn sm" data-action="diseno:reference">${icon('upload', 'sm')} ${d.reference ? 'Cambiar referencia' : 'Usar referencia de prueba'}</button>
                    </div>
                    <div class="ref-transcript">${field('Transcripcion de la referencia', `<textarea class="textarea" placeholder="Lo que dice exactamente el WAV" data-action="diseno:clone-text">${esc(d.clonePromptText)}</textarea>`)}</div>
                  </div>`
                : `<div class="field-group">
                    <div class="field-title">${icon('wand', 'sm')} Atributos de VoiceDesign</div>
                    <div class="grid-4">
                      ${field('Genero', `<select class="select" data-action="diseno:gender">${[['F', 'Femenina'], ['M', 'Masculina'], ['MIX', 'Androgina']].map(([v, l]) => `<option value="${v}" ${v === d.gender ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
                      ${field('Edad', `<select class="select" data-action="diseno:age">${['18-24', '25-32', '33-40', '41-50', '51-62', '63-75', '76+'].map((v) => `<option value="${v}" ${v === d.age ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
                      ${field('Acento', `<select class="select" data-action="diseno:accent">${['castellano_neutro', 'mexicano', 'rioplatense', 'colombiano', 'chileno', 'peruano', 'caribeno', 'venezolano', 'andaluz', 'neutro_latam'].map((v) => `<option value="${v}" ${v === d.accent ? 'selected' : ''}>${v.replaceAll('_', ' ')}</option>`).join('')}</select>`)}
                      ${field('Timbre', `<select class="select" data-action="diseno:timbre">${['calido', 'claro', 'grave', 'brillante', 'suave', 'metalico', 'aterciopelado', 'ronco'].map((v) => `<option value="${v}" ${v === d.timbre ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
                    </div>
                    <div class="grid-3" style="margin-top:8px">
                      ${rangeControl({ label: 'Temperatura', id: 'qwen-temp', min: 0.1, max: 1.5, step: 0.05, value: d.temperature, action: 'diseno:temp' })}
                      ${field('Top P', `<input class="input" type="number" min="0.5" max="1" step="0.01" value="${d.topP}" data-action="diseno:topp" />`, '<span class="pill-plan">planificado</span>')}
                      ${field('Semilla', `<input class="input" type="number" min="0" max="99999999" value="${d.seed}" data-action="diseno:seed" />`, '<span class="pill-plan">planificado</span>')}
                    </div>
                    <div class="prompt-note" style="margin-top:8px">${icon('info', 'sm')}<div><b>Que envia hoy el backend:</b> el prompt como <span class="mono">instruct</span> y la <b>temperatura</b>. Top-p y semilla estan en el contrato de la propuesta (voice lock) pero aun no viajan en <span class="mono">SynthesizeRequest</span>.</div></div>
                  </div>`
            }
          </div>
        </div>
      </section>

      <section class="panel design-result-col">
        <div class="panel-head">
          <div><p class="eyebrow">Paso 2 · Resultado</p><h2>Vista previa</h2></div>
          <span class="spacer"></span>
          <span class="badge accent">${esc(engineById(engine).name)}</span>
        </div>
        <div class="panel-body stack-3 result-body">
          <label class="sr-only" for="design-sample">Frase de prueba</label>
          <textarea id="design-sample" class="textarea sample-box" data-action="diseno:sample">${esc(d.sample)}</textarea>
          <div class="design-wave" aria-hidden="true">${bars.map((height) => `<i style="height:${height}%"></i>`).join('')}</div>
          ${
            d.generated
              ? `<div class="spec-inline">
                  <div><span>Voz</span><b>${esc(d.generated.name)}</b></div>
                  <div><span>Duracion</span><b>${d.generated.duration} s</b></div>
                  <div><span>RTF</span><b>${d.generated.rtf.toFixed(3)}</b></div>
                  <div><span>Semilla</span><b>${d.generated.seed}</b></div>
                </div>
                <div class="row wrap">
                  <button class="btn sm primary" data-action="voice:preview" data-voice="${d.generated.voiceId}">${icon('play', 'sm')} Escuchar</button>
                  <button class="btn sm" data-action="diseno:regenerate">${icon('refresh', 'sm')} Otra toma</button>
                  <button class="btn sm" data-action="diseno:to-elenco">${icon('users', 'sm')} Al elenco</button>
                </div>`
              : `<div class="empty">${icon('wand', 'hero')}<h3>Sin toma todavia</h3><p class="tiny muted">Escribe un prompt o elige uno de la biblioteca y pulsa Generar voz.</p></div>`
          }
          <div class="design-actions">
            <button class="btn primary" data-action="diseno:generate">${icon('zap', 'sm')} Generar voz</button>
            <button class="btn" data-action="diseno:save">${icon('plus', 'sm')} Guardar en biblioteca</button>
          </div>
        </div>
      </section>

      <section class="panel design-library-col">
        <div class="panel-head">
          <div><p class="eyebrow">Paso 3 · Biblioteca</p><h2>${PROMPT_TOTAL} prompts</h2></div>
          <span class="spacer"></span>
          <span class="badge">${d.family === 'todas' ? PROMPT_TOTAL : (PROMPT_FAMILIES.find((f) => f.id === d.family) || {}).count || 0}</span>
        </div>
        <div class="panel-body stack-3 library-body">
          <div class="library-fixed">
            <div class="segmented" role="group" aria-label="Tipo de prompt">
              <button data-action="diseno:prompt-mode" data-mode="todos" aria-pressed="${d.promptMode === 'todos'}">Todos</button>
              <button data-action="diseno:prompt-mode" data-mode="voice_design" aria-pressed="${d.promptMode === 'voice_design'}">VoiceDesign</button>
              <button data-action="diseno:prompt-mode" data-mode="instruct_tts" aria-pressed="${d.promptMode === 'instruct_tts'}">Instruct</button>
            </div>
            <div class="row between v2-switch">
              <span class="tiny dim">${usaV2 ? `Version mejorada · +${PROMPT_V2_STATS.mediaExtra} car. de media` : 'Version original auditada'}</span>
              <div class="segmented sm" role="group" aria-label="Version de los prompts">
                <button data-action="diseno:prompt-version" data-version="v1" aria-pressed="${!usaV2}">Original</button>
                <button data-action="diseno:prompt-version" data-version="v2" aria-pressed="${usaV2}">Mejorada</button>
              </div>
            </div>
            <label class="sr-only" for="prompt-search">Buscar en la biblioteca</label>
            <input id="prompt-search" class="input" placeholder="Buscar timbre, acento, estilo..." value="${esc(d.query)}" data-action="diseno:query" />
            <label class="sr-only" for="prompt-family">Familia</label>
            <select id="prompt-family" class="select" data-action="diseno:family">
              ${familias.map((f) => `<option value="${f.id}" ${f.id === d.family ? 'selected' : ''}>${esc(f.label)} · ${f.count}</option>`).join('')}
            </select>
          </div>
          <div id="prompt-results" class="library-list">${muestra
            .map(
              (item) => `<button class="library-item" data-action="diseno:use-prompt" data-prompt="${item.id}">
                <span class="mode-dot ${item.mode === 'instruct_tts' ? 'instruct' : ''}" aria-hidden="true"></span>
                <div style="min-width:0">
                  <div class="prompt-text">${esc(usaV2 && item.improved ? item.improved : item.text)}</div>
                  <div class="prompt-meta"><span>${esc(item.familyLabel)}</span><span>${item.mode === 'instruct_tts' ? 'instruct' : 'design'}</span></div>
                </div>
              </button>`,
            )
            .join('')}</div>
          <p class="tiny dim">${muestra.length} de ${PROMPT_TOTAL} coincidencias. Pulsa una para usarla.</p>
        </div>
      </section>
    </div>
  </div>`;
}


/* Auditoria de la biblioteca de 1.110: se calcula una vez al cargar. */
const PROMPT_AUDIT = (() => {
  let mejorables = 0;
  let completos = 0;
  let suma = 0;
  PROMPT_LIBRARY.forEach((item) => {
    const audit = auditPrompt(item.text, item.mode);
    suma += audit.puntos;
    if (audit.hallazgos.length) mejorables += 1;
    else completos += 1;
  });
  return { mejorables, completos, media: Math.round(suma / Math.max(1, PROMPT_LIBRARY.length)) };
})();


/* ------------------------- modulo qwen: repintados ------------------------ */
/*
  Estos dos no llaman a render(): reemplazar el panel destruiria el input que
  tiene el foco. Solo actualizan las piezas que cambian.
*/
function syncQwenCompiled() {
  const q = state.qwen;
  const pre = $('.qwen-instruction');
  if (pre) pre.textContent = compileProfile(q.profile, q.master);
  const cobertura = profileCoverage(q.profile);
  const barra = $('.qwen-bar i');
  if (barra) barra.style.width = `${cobertura.pct}%`;
  const etiqueta = $('.qwen-matrix .tiny.dim');
  if (etiqueta) etiqueta.textContent = `${cobertura.pct} % cubierto`;
  const badge = $('.qwen-head .badge:nth-of-type(2)');
  if (badge) badge.textContent = `${cobertura.done} / ${cobertura.total} campos`;
  const partes = profileParts(q.profile);
  $$('.qwen-parts > div').forEach((div) => {
    const key = div.querySelector('span').textContent.toLowerCase();
    const mapa = { identidad: 'identity', timbre: 'timbre', entrega: 'delivery', grabacion: 'recording' };
    const b = div.querySelector('b');
    if (b && mapa[key]) b.textContent = partes[mapa[key]];
  });
}

function syncQwenLibrary() {
  const lista = $('.qwen-library-list');
  if (!lista) return;
  const q = state.qwen;
  lista.innerHTML =
    filteredProfiles(q)
      .map(
        (item) => `<button class="qwen-profile ${item.title === q.activeTitle ? 'active' : ''}" data-action="qwen:use" data-title="${esc(item.title)}">
          <span class="qp-dot" style="--tone:${item.tone}" aria-hidden="true"></span>
          <span class="qp-text"><b>${esc(item.title)}</b><small>${esc(item.category)}${item.saved ? ' · guardado' : ''}</small></span>
          <span class="qp-count mono">${profileCoverage(item.profile).done}/14</span>
        </button>`,
      )
      .join('') || '<p class="tiny dim">Ningun perfil con ese filtro.</p>';
}

/* ========================== QWEN VOICE STUDIO ============================ */
/*
  Modulo de diseno de voz con Qwen3-TTS VoiceDesign. Reproduce el flujo del
  backend compartido: descripcion libre -> perfil acustico de catorce campos ->
  instruccion compilada -> payload real del motor. Todo determinista y local.
*/
function viewQwen() {
  const q = state.qwen;
  const perfil = q.profile;
  const cobertura = profileCoverage(perfil);
  const audit = auditPrompt(q.prompt || '', q.promptMode);
  const partes = profileParts(perfil);
  const instruccion = compileProfile(perfil, q.master);
  const payload = buildPayload({ text: q.speech, instruction: instruccion, profile: perfil });
  const textosLargos = q.speech.length > QWEN_MAX_TEXT;
  const recientes = q.renders.slice(0, 8);

  return `
  <div class="stack-3 screen-fill qwen-screen">
    <!-- Cabecera fija del modulo. -->
    <div class="row between wrap qwen-head">
      <div>
        <h1 style="font-size:var(--text-2xl)">Qwen Voice Studio</h1>
        <p class="tiny muted mt-2">Qwen3-TTS VoiceDesign · perfil acustico de 14 campos, instruccion compilada y payload real. Sin red: el parser es lexico y declara su confianza.</p>
      </div>
      <div class="row wrap">
        <span class="badge ${q.phi ? 'ok' : 'info'}">${icon('cpu', 'sm')} ${q.phi ? 'Phi-3.5 local' : 'heuristicas locales'}</span>
        <span class="badge">${cobertura.done} / ${cobertura.total} campos</span>
        <button class="btn sm" data-action="qwen:templates">${icon('sliders', 'sm')} Plantillas</button>
      </div>
    </div>

    <div class="qwen-board">
      <!-- Columna 1: biblioteca de perfiles. -->
      <aside class="panel qwen-col library">
        <div class="panel-head"><div><p class="eyebrow">Biblioteca</p><h2>${SEED_VOICES.length + q.saved.length} perfiles</h2></div></div>
        <div class="panel-body stack-2 qwen-library-fixed">
          <label class="sr-only" for="qwen-search">Buscar perfiles</label>
          <input id="qwen-search" class="input" placeholder="Buscar perfil o categoria..." value="${esc(q.query)}" data-action="qwen:query" />
          <div class="chips">
            <button class="chip ${q.category === 'todas' ? 'active' : ''}" data-action="qwen:category" data-category="todas">Todas</button>
            ${SEED_CATEGORIES.map((cat) => `<button class="chip ${q.category === cat ? 'active' : ''}" data-action="qwen:category" data-category="${cat}">${esc(cat)}</button>`).join('')}
          </div>
        </div>
        <div class="panel-body stack-2 qwen-library-list">
          ${
            filteredProfiles(q)
              .map(
                (item) => `<button class="qwen-profile ${item.title === q.activeTitle ? 'active' : ''}" data-action="qwen:use" data-title="${esc(item.title)}">
                  <span class="qp-dot" style="--tone:${item.tone}" aria-hidden="true"></span>
                  <span class="qp-text"><b>${esc(item.title)}</b><small>${esc(item.category)}${item.saved ? ' · guardado' : ''}</small></span>
                  <span class="qp-count mono">${profileCoverage(item.profile).done}/14</span>
                </button>`,
              )
              .join('') || '<p class="tiny dim">Ningun perfil con ese filtro.</p>'
          }
        </div>
      </aside>

      <!-- Columna 2: copiloto, matriz acustica e instruccion. -->
      <section class="panel qwen-col work">
        <div class="panel-head">
          <div><p class="eyebrow">Paso 1 · Descripcion</p><h2>Copiloto de diseno vocal</h2></div>
          <span class="spacer"></span>
          <span class="badge ${audit.puntos >= 80 ? 'ok' : audit.puntos >= 50 ? 'warn' : 'danger'}">${audit.puntos} / 100</span>
        </div>
        <div class="panel-body stack-2 qwen-work-body">
          <div class="qwen-copilot">
            <label class="sr-only" for="qwen-description">Descripcion de la voz</label>
            <textarea id="qwen-description" class="textarea qwen-description" placeholder="Ejemplo: Quiero un narrador peruano de 55 anos, voz profunda, calida, ritmo pausado y emocion solemne." data-action="qwen:description">${esc(q.description)}</textarea>
            <div class="row wrap">
              <button class="btn sm primary" data-action="qwen:analyze">${icon('wand', 'sm')} Analizar descripcion</button>
              <button class="btn sm" data-action="qwen:clear-profile">${icon('trash', 'sm')} Vaciar perfil</button>
              <span class="spacer"></span>
              <span class="tiny dim">${q.parsed ? `confianza ${Math.round(q.parsed.confidence * 100)} %` : 'sin analizar'}</span>
            </div>
            ${
              q.parsed && q.parsed.ambiguities.length
                ? `<div class="qwen-notes">${q.parsed.ambiguities.map((a) => `<div class="qwen-note info">${icon('info', 'sm')}<span>${esc(a)}</span></div>`).join('')}</div>`
                : ''
            }
            ${
              q.parsed && q.parsed.conflicts.length
                ? `<div class="qwen-notes">${q.parsed.conflicts.map((a) => `<div class="qwen-note danger">${icon('alert', 'sm')}<span>${esc(a)}</span></div>`).join('')}</div>`
                : ''
            }
          </div>

          <div class="qwen-matrix">
            <div class="row between">
              <p class="eyebrow">Matriz acustica</p>
              <span class="tiny dim">${cobertura.pct} % cubierto</span>
            </div>
            <div class="qwen-bar"><i style="width:${cobertura.pct}%"></i></div>
            <div class="qwen-fields">
              ${VOICE_FIELDS.map((campo) => {
                const valor = perfil[campo.id];
                if (campo.kind === 'enum') {
                  return `<label class="field"><span>${esc(campo.label)}</span>
                    <select class="select" data-action="qwen:field" data-field="${campo.id}">
                      <option value="">sin especificar</option>
                      ${campo.options.map((opt) => `<option value="${opt}" ${opt === valor ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
                    </select>
                  </label>`;
                }
                if (campo.kind === 'number') {
                  return `<label class="field"><span>${esc(campo.label)}</span>
                    <input class="input" type="number" min="${campo.min}" max="${campo.max}" placeholder="5 a 100" value="${valor ?? ''}" data-action="qwen:field" data-field="${campo.id}" />
                  </label>`;
                }
                return `<label class="field"><span>${esc(campo.label)}</span>
                  <input class="input" type="text" maxlength="${campo.max}" placeholder="libre" value="${esc(valor ?? '')}" data-action="qwen:field" data-field="${campo.id}" />
                </label>`;
              }).join('')}
            </div>
          </div>

          <div class="qwen-compiled">
            <div class="row between">
              <p class="eyebrow">Paso 2 · Instruccion compilada</p>
              <div class="row">
                <button class="btn sm" data-action="qwen:copy">${icon('copy', 'sm')} Copiar</button>
                <button class="btn sm" data-action="qwen:payload">${icon('terminal', 'sm')} Ver payload</button>
              </div>
            </div>
            <pre class="code qwen-instruction" data-scroll-area="instruccion">${esc(instruccion)}</pre>
            <div class="qwen-parts">
              ${[['identity', 'Identidad'], ['timbre', 'Timbre'], ['delivery', 'Entrega'], ['recording', 'Grabacion']]
                .map(([key, label]) => `<div><span>${esc(label)}</span><b>${esc(partes[key])}</b></div>`)
                .join('')}
            </div>
          </div>
        </div>
      </section>

      <!-- Columna 3: laboratorio y biblioteca de prompts mejorados. -->
      <section class="panel qwen-col lab">
        <div class="panel-head"><div><p class="eyebrow">Laboratorio</p><h2>Prueba la voz</h2></div></div>
        <div class="panel-body stack-2 qwen-lab-body">
          <label class="field"><span>Nombre del render</span><input class="input" value="${esc(q.title)}" data-action="qwen:title" /></label>
          <label class="field"><span>Texto que pronuncia la voz</span>
            <textarea class="textarea qwen-speech" data-action="qwen:speech">${esc(q.speech)}</textarea>
          </label>
          <div class="row between tiny ${textosLargos ? 'text-danger' : 'dim'}">
            <span id="qwen-speech-count">${q.speech.length} / ${QWEN_MAX_TEXT} caracteres</span>
            <span>${textosLargos ? 'recorta antes de generar' : 'dentro del limite del motor'}</span>
          </div>
          <div class="qwen-actions">
            <button class="btn primary" data-action="qwen:generate" ${textosLargos || !q.speech.trim() ? 'disabled' : ''}>${icon('zap', 'sm')} Generar audio local</button>
            <button class="btn" data-action="qwen:save-profile">${icon('plus', 'sm')} Guardar perfil</button>
          </div>
          <p class="tiny dim">La primera generacion carga el modelo: el prototipo simula el RTF del backend (CPU, 12 hilos).</p>
          ${
            q.lastRender
              ? `<div class="qwen-render">
                  <div class="spec-inline">
                    <div><span>Duracion</span><b>${q.lastRender.duration} s</b></div>
                    <div><span>Calculo</span><b>${q.lastRender.elapsed} s</b></div>
                    <div><span>RTF</span><b>${q.lastRender.rtf}</b></div>
                    <div><span>Modelo</span><b>1.7B VoiceDesign</b></div>
                  </div>
                  <div class="row wrap">
                    <button class="btn sm primary" data-action="qwen:play">${icon('play', 'sm')} Escuchar WAV</button>
                    <button class="btn sm" data-action="qwen:reuse">${icon('refresh', 'sm')} Reutilizar</button>
                  </div>
                </div>`
              : `<div class="empty">${icon('wave', 'hero')}<h3>Sin renders</h3><p class="tiny muted">El perfil ya esta listo: pulsa Generar audio local.</p></div>`
          }
        </div>
      </section>
    </div>

    <!-- Historial de renders, fijo al pie. -->
    <div class="panel qwen-history">
      <div class="row between">
        <div><p class="eyebrow">Historial</p><h2>${q.renders.length} audios</h2></div>
        <div class="row"><span class="tiny dim">Un WAV por render · se puede descargar y eliminar</span></div>
      </div>
      <div class="qwen-history-list" data-scroll-area="renders">
        ${
          recientes.length
            ? recientes
                .map(
                  (r) => `<article class="qwen-render-card">
                    <header><b>${esc(r.title)}</b><span class="badge">${esc(r.category)}</span></header>
                    <p>${esc(r.text.slice(0, 96))}${r.text.length > 96 ? '...' : ''}</p>
                    <div class="specs"><span>${r.duration} s</span><span>${r.elapsed} s de calculo</span><span>RTF ${r.rtf}</span></div>
                    <div class="row wrap">
                      <button class="btn sm" data-action="qwen:render-play" data-render="${r.id}">${icon('play', 'sm')} Escuchar</button>
                      <button class="btn sm" data-action="qwen:render-reuse" data-render="${r.id}">${icon('refresh', 'sm')} Reutilizar</button>
                      <button class="btn sm icon-only" data-action="qwen:render-delete" data-render="${r.id}" aria-label="Eliminar render">${icon('trash', 'sm')}</button>
                    </div>
                  </article>`,
                )
                .join('')
            : '<p class="tiny dim">Aun no hay renders en esta sesion.</p>'
        }
      </div>
    </div>

    <!-- Biblioteca de prompts con auditoria: los 1.110, mejorables uno a uno. -->
    <div class="panel qwen-prompts">
      <div class="panel-head">
        <div><p class="eyebrow">Biblioteca de prompts</p><h2>${PROMPT_TOTAL} prompts auditados</h2></div>
        <span class="spacer"></span>
        <span class="badge ok">${PROMPT_AUDIT.mejorables} mejorables</span>
        <span class="badge">${PROMPT_AUDIT.completos} completos</span>
      </div>
      <div class="panel-body stack-2">
        <div class="chips">
          ${[['todos', 'Todos'], ['voice_design', 'VoiceDesign'], ['instruct_tts', 'Instruct'], ['mejorables', 'Solo mejorables']]
            .map(([id, label]) => `<button class="chip ${q.promptFilter === id ? 'active' : ''}" data-action="qwen:prompt-filter" data-filter="${id}">${label}</button>`)
            .join('')}
        </div>
        <div class="qwen-prompt-list" data-scroll-area="prompts-qwen">
          ${qwenPromptRows(q)}
        </div>
      </div>
    </div>
  </div>`;
}

/** Perfiles filtrados por categoria y busqueda. */
function filteredProfiles(q) {
  const tonos = ['var(--accent)', 'var(--ok)', 'var(--info)', 'var(--amber)', 'var(--warn)'];
  const base = SEED_VOICES.map((v, i) => ({ ...v, saved: false, tone: tonos[i % tonos.length] })).concat(
    (q.saved || []).map((v, i) => ({ ...v, saved: true, tone: tonos[(i + 2) % tonos.length] })),
  );
  const texto = (q.query || '').toLowerCase().trim();
  return base.filter((v) => {
    if (q.category !== 'todas' && v.category !== q.category) return false;
    if (!texto) return true;
    return `${v.title} ${v.category}`.toLowerCase().includes(texto);
  });
}

/** Filas de la biblioteca de prompts, con el diagnostico ya calculado. */
function qwenPromptRows(q) {
  const lista = PROMPT_LIBRARY.filter((item) => {
    if (q.promptFilter === 'voice_design' || q.promptFilter === 'instruct_tts') return item.mode === q.promptFilter;
    if (q.promptFilter === 'mejorables') return auditPrompt(item.text, item.mode).hallazgos.length > 0;
    return true;
  }).slice(0, 60);
  if (!lista.length) return '<p class="tiny dim">Ningun prompt con ese filtro.</p>';
  return lista
    .map((item) => {
      const audit = auditPrompt(item.text, item.mode);
      const abierto = q.promptOpen === item.id;
      return `<article class="qwen-prompt ${abierto ? 'open' : ''}">
        <button class="qwen-prompt-head" data-action="qwen:prompt-toggle" data-prompt="${item.id}" aria-expanded="${abierto}">
          <span class="mode-dot ${item.mode === 'instruct_tts' ? 'instruct' : ''}" aria-hidden="true"></span>
          <span class="qwp-text">${esc(item.text)}</span>
          <span class="badge ${audit.completo ? 'ok' : audit.puntos >= 50 ? 'warn' : 'danger'}">${audit.puntos}</span>
          ${icon(abierto ? 'chevronDown' : 'chevron', 'sm')}
        </button>
        ${
          abierto
            ? `<div class="qwen-prompt-body">
                <div class="qwp-meta"><span>${esc(item.familyLabel)}</span><span>${item.mode === 'instruct_tts' ? 'Instruct-TTS' : 'VoiceDesign'}</span><span>${item.text.length} caracteres</span></div>
                ${
                  audit.hallazgos.length
                    ? `<ul class="qwp-checks">${audit.hallazgos
                        .map((h) => `<li class="g-${h.gravedad}"><b>${esc(h.label)}</b><span>${esc(h.fix)}</span></li>`)
                        .join('')}</ul>`
                    : `<p class="tiny ok-text">${icon('check', 'sm')} Cumple los diez controles: no hay nada que anadir.</p>`
                }
                ${
                  audit.hallazgos.length
                    ? `<div class="qwp-fix"><p class="eyebrow">Version mejorada</p><p class="qwp-improved">${esc(improvePrompt(item.text, { mode: item.mode }).text)}</p>
                        <div class="row wrap"><button class="btn sm primary" data-action="qwen:apply-prompt" data-prompt="${item.id}">${icon('check', 'sm')} Usar esta version</button>
                        <button class="btn sm" data-action="qwen:prompt-editor" data-prompt="${item.id}">${icon('edit', 'sm')} Abrir en el editor</button></div></div>`
                    : ''
                }
              </div>`
            : ''
        }
      </article>`;
    })
    .join('');
}


/* ============================ CLONACION DE VOZ ============================ */
/*
  Modulo de clonacion con los motores que aceptan referencia y no son Qwen ni
  CosyVoice: F5-TTS Spanish, XTTS-v2 y StyleTTS 2. La referencia se sube o se
  graba en vivo, se limpia con un preset y solo despues se condiciona.
*/
function viewClonacion() {
  const c = state.clonacion;
  const engine = cloneEngineById(c.engine);
  const preset = clonePresetById(c.preset);
  const clean = cleanPresetById(c.cleaning);
  const ref = c.reference;
  const evalRef = evaluateReference(ref ? { ...ref, transcript: c.transcript } : null, c.engine);
  const paso = Math.max(0, CLONE_STEPS.findIndex((item) => item.id === c.step));

  return `
  <div class="stack-4 screen-fill clone-screen">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Clonacion de voz</h1>
        <p class="tiny muted mt-2">Una referencia de 3 a 10 s basta para clonar el timbre. ${CLONE_ENGINES.length} motores disponibles: ${CLONE_ENGINES.map((item) => item.name).join(', ')}. Todo se procesa en local.</p>
      </div>
      <span class="badge info">${icon('shield', 'sm')} Consentimiento obligatorio</span>
    </div>

    <div class="clone-board">
      <aside class="panel clone-steps">
        <div class="panel-head"><div><p class="eyebrow">Asistente</p><h2>${CLONE_STEPS.length} pasos</h2></div></div>
        <div class="panel-body stack-2">
          ${CLONE_STEPS.map(
            (item, index) => `<button class="clone-step ${item.id === c.step ? 'active' : ''} ${index < paso ? 'done' : ''}" data-action="clone:step" data-step="${item.id}">
              <span class="step-num">${index < paso ? icon('check', 'sm') : index + 1}</span>
              <span class="step-text"><b>${esc(item.label)}</b><small>${esc(item.hint)}</small></span>
            </button>`,
          ).join('')}
        </div>
        <div class="panel-body stack-2 clone-presets">
          <p class="eyebrow">Presets de clonacion</p>
          ${CLONE_PRESETS.map(
            (item) => `<button class="clone-preset ${item.id === c.preset ? 'active' : ''}" data-action="clone:preset" data-preset="${item.id}" aria-pressed="${item.id === c.preset}">
              <span class="mode-dot" style="background:${item.tone}" aria-hidden="true"></span>
              <span><b>${esc(item.name)}</b><small>${esc(item.desc)}</small></span>
            </button>`,
          ).join('')}
        </div>
      </aside>

      <section class="panel clone-main">
        <div class="panel-head">
          <div><p class="eyebrow">Paso ${paso + 1} de ${CLONE_STEPS.length}</p><h2>${esc((CLONE_STEPS[paso] || CLONE_STEPS[0]).label)}</h2></div>
          <span class="spacer"></span>
          <span class="badge ${evalRef.nivel === 'ok' ? 'ok' : evalRef.nivel === 'error' ? 'danger' : 'warn'}">${esc(evalRef.nivel === 'ok' ? 'referencia valida' : evalRef.nivel === 'error' ? 'referencia incompleta' : 'revisar avisos')}</span>
        </div>
        <div class="panel-body stack-3 clone-body">

          <div class="clone-block">
            <div class="segmented" role="group" aria-label="Origen de la referencia">
              ${CLONE_SOURCES.map((item) => `<button data-action="clone:source" data-source="${item.id}" aria-pressed="${c.source === item.id}">${icon(item.icon, 'sm')} ${esc(item.label)}</button>`).join('')}
            </div>
            ${
              c.source === 'archivo'
                ? `<div class="drop ${ref ? 'hot' : ''}" data-drop="clonacion">
                    ${icon('upload', 'hero')}
                    <h4>${ref ? esc(ref.name) : 'Arrastra un WAV, MP3 o M4A'}</h4>
                    <p class="tiny muted">${ref ? `${ref.seconds.toFixed(1)} s · ${ref.sr} Hz · ${ref.channels} canales · ${ref.sizeMb} MB` : `Se convierte a 24 kHz mono. ${engine.name} usa entre ${engine.minRef} y ${engine.maxRef} s.`}</p>
                    <div class="row">
                      <button class="btn sm" data-action="clone:load-sample">${icon('file', 'sm')} Usar audio de ejemplo</button>
                      ${ref ? `<button class="btn sm" data-action="clone:clear">${icon('trash', 'sm')} Quitar</button>` : ''}
                    </div>
                  </div>`
                : `<div class="clone-recorder ${c.recording ? 'recording' : ''}">
                    <div class="rec-dot" aria-hidden="true"></div>
                    <div class="rec-time mono">${c.recordSeconds.toFixed(1)} s</div>
                    <p class="tiny muted">${c.recording ? `Grabando... se detiene sola a los ${engine.maxRef} s` : `Microfono del equipo. Minimo ${engine.minRef} s, maximo ${engine.maxRef} s.`}</p>
                    <div class="rec-bar"><i style="width:${pct(c.recordSeconds, engine.maxRef)}%"></i></div>
                    <button class="btn ${c.recording ? 'danger' : 'primary'}" data-action="clone:record">${icon(c.recording ? 'x' : 'mic', 'sm')} ${c.recording ? 'Detener' : 'Grabar referencia'}</button>
                  </div>`
            }
            ${ref ? `<div class="spec-inline">
              <div><span>Duracion</span><b>${ref.seconds.toFixed(1)} s</b></div>
              <div><span>Formato</span><b>${esc(ref.format)} ${ref.sr / 1000} kHz</b></div>
              <div><span>Canales</span><b>${ref.channels === 1 ? 'mono' : 'estereo'}</b></div>
              <div><span>Motor</span><b>${esc(engine.name)}</b></div>
            </div>` : ''}
          </div>

          <div class="clone-block">
            <div class="field-title-row"><span class="eyebrow">Transcripcion exacta de la referencia</span>
              ${ref ? `<button class="btn sm" data-action="clone:transcribe">${icon('sparkles', 'sm')} Transcribir con ASR local</button>` : ''}
            </div>
            <label class="sr-only" for="clone-transcript">Transcripcion</label>
            <textarea id="clone-transcript" class="textarea clone-transcript" placeholder="Lo que dice exactamente el audio, palabra por palabra." data-action="clone:transcript">${esc(c.transcript)}</textarea>
          </div>

          <div class="clone-block">
            <div class="field-title-row"><span class="eyebrow">Limpieza de audio</span>
              ${c.cleaningApplied ? `<span class="badge ok">${icon('check', 'sm')} aplicada</span>` : ''}
            </div>
            <div class="clean-grid">
              ${CLONE_CLEAN_PRESETS.map(
                (item) => `<button class="clean-card ${item.id === c.cleaning ? 'active' : ''}" data-action="clone:cleaning" data-cleaning="${item.id}" aria-pressed="${item.id === c.cleaning}" style="--tone:${item.tone}">
                  <b>${esc(item.name)}</b>
                  <small>${esc(item.desc)}</small>
                </button>`,
              ).join('')}
            </div>
            <div class="spec-inline clean-specs">
              <div><span>Reduccion de ruido</span><b>${clean.params.denoise} %</b></div>
              <div><span>Antirreverb</span><b>${clean.params.deverb} %</b></div>
              <div><span>Loudness</span><b>${esc(clean.params.loudness)}</b></div>
              <div><span>Paso alto</span><b>${clean.params.highpass ? `${clean.params.highpass} Hz` : 'sin filtro'}</b></div>
            </div>
            <button class="btn primary" data-action="clone:clean">${icon('sparkles', 'sm')} Limpiar referencia</button>
          </div>

          <div class="clone-block">
            <div class="field-title-row"><span class="eyebrow">Motor de clonacion</span></div>
            <div class="engine-pick">
              ${CLONE_ENGINES.map(
                (item) => `<button class="engine-card ${item.id === c.engine ? 'active' : ''}" data-action="clone:engine" data-engine="${item.id}" aria-pressed="${item.id === c.engine}">
                  <header><b>${esc(item.name)}</b><span class="badge ${item.commercial ? 'ok' : 'info'}">${esc(item.license)}</span></header>
                  <p>${esc(item.nota)}</p>
                  <div class="specs"><span>RTF ${item.rtf.toFixed(2)}</span><span>${item.minRef}-${item.maxRef} s</span><span>${esc(item.accentos)}</span></div>
                </button>`,
              ).join('')}
            </div>
          </div>

          ${evalRef.avisos.length ? `<div class="clone-notes">${evalRef.avisos.map((a) => `<div class="clone-note ${a.tono}">${icon(a.tono === 'danger' ? 'alert' : 'info', 'sm')}<span>${esc(a.texto)}</span></div>`).join('')}</div>` : ''}
        </div>
      </section>

      <section class="panel clone-result">
        <div class="panel-head"><div><p class="eyebrow">Resultado</p><h2>Prueba de la voz</h2></div></div>
        <div class="panel-body stack-3">
          <div class="spec-inline">
            <div><span>Motor</span><b>${esc(engine.name)}</b></div>
            <div><span>Preset</span><b>${esc(preset.name)}</b></div>
            <div><span>Limpieza</span><b>${esc(clean.name)}</b></div>
            <div><span>RTF</span><b>${engine.rtf.toFixed(2)}</b></div>
          </div>
          <label class="sr-only" for="clone-sample">Frase de prueba</label>
          <textarea id="clone-sample" class="textarea clone-sample" placeholder="La lluvia insistia sobre el tejado mientras la ciudad se apagaba despacio.">La lluvia insistia sobre el tejado mientras la ciudad se apagaba despacio.</textarea>
          <div class="design-wave" aria-hidden="true">${waveBars(`clone-${c.engine}-${c.preset}`).map((height) => `<i style="height:${height}%"></i>`).join('')}</div>
          ${
            c.result
              ? `<div class="clone-take">
                  <div class="spec-inline">
                    <div><span>Duracion</span><b>${c.result.duration} s</b></div>
                    <div><span>Similitud</span><b>${c.result.similarity} %</b></div>
                    <div><span>Tiempo</span><b>${c.result.elapsed} s</b></div>
                    <div><span>QA</span><b>${esc(c.result.qa)}</b></div>
                  </div>
                  <div class="row wrap">
                    <button class="btn sm primary" data-action="clone:preview">${icon('play', 'sm')} Escuchar</button>
                    <button class="btn sm" data-action="clone:again">${icon('refresh', 'sm')} Otra toma</button>
                  </div>
                </div>`
              : `<div class="empty">${icon('mic', 'hero')}<h3>Sin prueba todavia</h3><p class="tiny muted">Sube o graba una referencia, limpiala y pulsa Probar clonacion.</p></div>`
          }
          <div class="clone-actions">
            <button class="btn primary" data-action="clone:test" ${evalRef.ok && c.cleaningApplied ? '' : 'disabled'}>${icon('zap', 'sm')} Probar clonacion</button>
            <button class="btn" data-action="clone:save" ${c.result ? '' : 'disabled'}>${icon('plus', 'sm')} Guardar voz</button>
          </div>
          <p class="tiny dim">Sin consentimiento firmado no se guarda: el prototipo lo pide antes de escribir nada.</p>
          ${c.saved.length ? `<div class="stack-2"><p class="eyebrow">Clonadas en esta sesion</p>${c.saved.map((v) => `<div class="file-row"><span class="card-icon" style="--tone:var(--accent)">${icon('mic', 'sm')}</span><div style="min-width:0"><div class="file-name">${esc(v.name)}</div><div class="file-meta">${esc(v.engine)} · ${v.seconds} s</div></div><span class="badge ok">lista</span></div>`).join('')}</div>` : ''}
        </div>
      </section>
    </div>
  </div>`;
}


/* ================================= VOCES ================================= */
function viewVoces() {
  const filters = [
    ['todas', 'Todas'],
    ['nativa', 'Nativas'],
    ['mezcla', 'Mezclas'],
    ['clonada', 'Clonadas'],
    ['disenada', 'Disenadas'],
  ];
  const engineFilter = state.voiceFilter.startsWith('engine:') ? state.voiceFilter.slice(7) : null;
  const list = CATALOG.filter((voice) => {
    if (engineFilter && voice.engine !== engineFilter) return false;
    if (!engineFilter && state.voiceFilter !== 'todas' && voice.origin !== state.voiceFilter) return false;
    return (
      !state.search ||
      `${voice.name} ${voice.engine} ${voice.region} ${voice.tags.join(' ')} ${voice.desc}`
        .toLowerCase()
        .includes(state.search.toLowerCase())
    );
  });
  // Ocho tarjetas por vista; el resto se alcanza desplazando la bandeja.
  const porVista = 8;
  const byEngine = catalogByEngine();
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Voces</h1>
        <p class="tiny muted mt-2">Las ${CATALOG_TOTAL} voces de los ${ENGINES.length} motores: nativas, mezclas vectoriales, clonadas con consentimiento y disenadas por prompt. No se excluye ninguna porque la app es de uso personal.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="nav" data-route="diseno">${icon('wand', 'sm')} Disenar voz</button>
        <button class="btn primary" data-action="modal:grabar">${icon('mic', 'sm')} Grabar referencia</button>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head"><div><p class="eyebrow">Recuento real</p><h2>${CATALOG_TOTAL} voces en ${ENGINES.length} motores</h2></div></div>
      <div class="panel-body tight">
        ${carrusel({
          id: 'motores',
          porVista: ENGINES.length,
          cols: 4,
          etiqueta: 'motores',
          items: byEngine.map(
              (item) => `<button class="preset-card" style="--tone:${item.engine.commercial ? 'var(--accent)' : 'var(--info)'}" data-action="voices:filter" data-filter="engine:${item.engine.id}" aria-pressed="${engineFilter === item.engine.id}">
                <header>${icon('cpu', 'sm')}<h3>${esc(item.engine.name)}</h3></header>
                <div class="specs">
                  <span>${item.count} ${item.count === 1 ? 'voz' : 'voces'}</span>
                  <span>RTF ${item.engine.rtf.toFixed(2)}</span>
                  <span>${esc(item.engine.license)}</span>
                </div>
                <p>${esc(item.engine.note)}</p>
              </button>`,
          ),
        })}
      </div>
    </section>

    <div class="toolbar">
      <div class="chips">
        ${filters.map(([id, label]) => `<button class="chip" data-action="voices:filter" data-filter="${id}" aria-pressed="${!engineFilter && state.voiceFilter === id}">${label}</button>`).join('')}
      </div>
      <span class="spacer"></span>
      <label class="sr-only" for="voice-search">Buscar voz</label>
      <input id="voice-search" class="input" style="max-width:280px" placeholder="Buscar nombre, motor o region" value="${esc(state.search)}" data-action="voices:search" />
    </div>

    ${
      list.length === 0
        ? emptyState('Sin voces con ese filtro', 'Cambia el filtro de motor o el texto de busqueda.')
        : carrusel({ id: 'voces', porVista, cols: 4, etiqueta: 'voces', items: list.map((voice) => voiceCard(voice)) })
    }
  </div>`;
}

/* ================================ RECETAS ================================ */
function viewRecetas() {
  const filters = [
    ['todas', 'Todas'],
    ...Array.from(new Set(RECIPES.map((recipe) => recipe.id))).slice(0, 0).map((id) => [id, id]),
  ];
  const list = RECIPES.filter((recipe) => state.recipeFilter === 'todas' || recipe.id === state.recipeFilter);
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Recetas</h1>
        <p class="tiny muted mt-2">${RECIPES.length} especificaciones de fabricacion. Cada receta fija motor, segmentacion, pausas, loudness, entregables y QA.</p>
      </div>
      <button class="btn primary" data-action="recipe:new">${icon('plus', 'sm')} Nueva receta</button>
    </div>
    <div class="toolbar">
      <div class="chips">
        ${filters.map(([id, label]) => `<button class="chip" data-action="recipes:filter" data-filter="${id}" aria-pressed="${state.recipeFilter === id}">${label}</button>`).join('')}
      </div>
    </div>
    ${carrusel({
      id: 'recetas',
      porVista: 8,
      cols: 4,
      etiqueta: 'recetas',
      items: list.map((recipe) => {
          const engine = engineById(recipe.engine);
          return `<article class="card">
            <div class="card-top">
              <span class="card-icon" style="--tone:${recipe.tone}">${icon(recipe.icon)}</span>
              <div class="grow" style="min-width:0"><h3 class="truncate">${esc(recipe.name)}</h3><p class="tiny">${esc(recipe.structure)}</p></div>
            </div>
            <p class="tiny muted">${esc(recipe.desc)}</p>
            <div class="spec-inline" style="grid-template-columns:repeat(2,minmax(0,1fr))">
              <div><span>Motor final</span><b>${esc(engine.name)}</b></div>
              <div><span>Borrador</span><b>${esc(engineById(recipe.draft).name)}</b></div>
              <div><span>Velocidad</span><b>${recipe.speed.toFixed(2)}x</b></div>
              <div><span>Loudness</span><b>${esc(recipe.lufs)}</b></div>
            </div>
            <div class="chips">${recipe.delivery.split(' · ').map((item) => `<span class="badge">${esc(item)}</span>`).join('')}</div>
            <div class="card-foot">
              <button class="btn sm" data-action="recipe:open" data-recipe="${recipe.id}">${icon('info', 'sm')} Ficha</button>
              <button class="btn sm primary" data-action="recipe:use" data-recipe="${recipe.id}">${icon('plus', 'sm')} Usar</button>
            </div>
          </article>`;
      }),
    })}
  </div>`;
}

/* ================================= ELENCO ================================= */
function viewElenco() {
  const p = project();
  const cast = p.cast || [];
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Elenco</h1>
        <p class="tiny muted mt-2">Cada rol apunta a una voz del catalogo (${CATALOG_TOTAL} disponibles) con su condicionamiento bloqueado.</p>
      </div>
      <button class="btn" data-action="nav" data-route="voces">${icon('mic', 'sm')} Ver catalogo completo</button>
    </div>
    <section class="panel">
      <div class="panel-head"><div><p class="eyebrow">${esc(p.name)}</p><h2>Casting del proyecto</h2></div></div>
      <div class="panel-body tight">
        <div class="table-wrap scroll-area" data-scroll-area="elenco">
        <table class="table">
          <thead><tr><th>Rol</th><th>Voz</th><th>Motor</th><th>Origen</th><th class="num">Bloques</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${cast
              .map((slot) => {
                const voice = catalogVoice(slot.voiceId);
                const engine = voice ? engineById(voice.engine) : null;
                const role = roleMeta(slot.role);
                return `<tr>
                  <td><span class="badge" style="border-color:${role.color}55;color:${role.color}">${esc(role.label)}</span></td>
                  <td>${voice ? esc(voice.name) : '<span class="dim">sin asignar</span>'}</td>
                  <td>${engine ? esc(engine.name) : '-'}</td>
                  <td>${voice ? `<span class="badge">${esc(voice.origin)}</span>` : '-'}</td>
                  <td class="num mono">${slot.blocks}</td>
                  <td>${slot.locked ? `<span class="badge ok">${icon('lock', 'sm')} bloqueado</span>` : `<span class="badge warn">${icon('unlock', 'sm')} libre</span>`}</td>
                  <td class="num">
                    <div class="row">
                      ${voice ? `<button class="btn sm icon-only" data-action="voice:preview" data-voice="${voice.id}" aria-label="Escuchar ${esc(voice.name)}">${icon('play', 'sm')}</button>` : ''}
                      <button class="btn sm" data-action="elenco:change" data-role="${slot.role}">${icon('refresh', 'sm')} Cambiar</button>
                    </div>
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><div><p class="eyebrow">Asignacion rapida</p><h2>Voces del catalogo</h2></div></div>
      <div class="panel-body">
        <p class="tiny muted">Pulsa una voz para asignarla al rol que elijas despues. Se muestran las ${CATALOG_TOTAL}, incluidas las no comerciales (uso personal).</p>
        <div class="grid-cards" style="margin-top:var(--space-3)">
          ${CATALOG.slice(0, 12).map((voice) => voiceCard(voice, { compact: true })).join('')}
        </div>
        <div class="row" style="margin-top:var(--space-3)">
          <button class="btn" data-action="nav" data-route="voces">${icon('arrow', 'sm')} Ver las ${CATALOG_TOTAL} voces</button>
        </div>
      </div>
    </section>
  </div>`;
}

/* =============================== PRESETS CLIENTE ========================= */
function viewPresets() {
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div><h1 style="font-size:var(--text-2xl)">Presets de cliente</h1><p class="tiny muted mt-2">Receta y voz fijadas por cliente, para no repetir ajustes en cada entrega.</p></div>
      <button class="btn primary" data-action="preset:new">${icon('plus', 'sm')} Nuevo preset</button>
    </div>
    ${carrusel({
      id: 'presets-cliente',
      porVista: 12,
      cols: 4,
      etiqueta: 'presets',
      items: CLIENT_PRESETS.map((preset) => {
        const voice = catalogVoice(preset.voice);
        const recipe = recipeById(preset.recipe);
        return `<article class="card">
          <div class="card-top">
            <span class="card-icon">${icon('star')}</span>
            <div class="grow" style="min-width:0"><h3 class="truncate">${esc(preset.client)}</h3><p class="tiny">${esc(recipe ? recipe.name : preset.recipe)} · ${esc(preset.tone)}</p></div>
          </div>
          <div class="spec-inline" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <div><span>Voz</span><b>${esc(voice ? voice.name : preset.voice)}</b></div>
            <div><span>Motor</span><b>${esc(voice ? engineById(voice.engine).name : '-')}</b></div>
            <div><span>Responsable</span><b>${esc(preset.owner)}</b></div>
            <div><span>Actualizado</span><b>${esc(preset.updated)}</b></div>
          </div>
          <div class="card-foot">
            <button class="btn sm" data-action="preset:open" data-preset="${preset.id}">${icon('info', 'sm')} Ficha</button>
            <button class="btn sm primary" data-action="preset:use" data-preset="${preset.id}">${icon('play', 'sm')} Usar</button>
          </div>
        </article>`;
      }),
    })}
  </div>`;
}

/* ================================ GLOSARIO =============================== */
function viewGlosario() {
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div><h1 style="font-size:var(--text-2xl)">Glosario</h1><p class="tiny muted mt-2">Pronunciacion forzada de siglas, cifras y marcas. El normalizador lo aplica antes de sintetizar.</p></div>
      <button class="btn primary" data-action="glossary:new">${icon('plus', 'sm')} Anadir termino</button>
    </div>
    <section class="panel">
      <div class="panel-head"><div><p class="eyebrow">Activo</p><h2>${GLOSSARY.length} terminos</h2></div></div>
      <div class="panel-body tight">
        <div class="table-wrap scroll-area" data-scroll-area="glosario">
        <table class="table">
          <thead><tr><th>Termino</th><th>Se pronuncia</th><th>Alcance</th><th></th></tr></thead>
          <tbody>
            ${GLOSSARY.map(
              (entry) => `<tr>
                <td class="mono">${esc(entry.term)}</td>
                <td>${esc(entry.speak)}</td>
                <td><span class="badge">${esc(entry.scope)}</span></td>
                <td class="num"><button class="btn sm icon-only" data-action="glossary:remove" data-term="${esc(entry.term)}" aria-label="Eliminar ${esc(entry.term)}">${icon('trash', 'sm')}</button></td>
              </tr>`,
            ).join('')}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  </div>`;
}

/* ================================= LOTES ================================= */
function viewLotes() {
  const batch = state.batch;
  const done = batch.rows.filter((row) => row.state === 'ok').length;
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div><h1 style="font-size:var(--text-2xl)">Lotes</h1><p class="tiny muted mt-2">Trabajos masivos desde CSV, SRT o carpeta vigilada, con cola y reintentos por bloque.</p></div>
      <div class="row">
        <button class="btn" data-action="batch:import">${icon('upload', 'sm')} Importar CSV</button>
        <button class="btn primary" data-action="batch:run">${icon('play', 'sm')} ${state.batchRunning ? 'Pausar lote' : 'Ejecutar lote'}</button>
      </div>
    </div>
    <div class="stat-grid">
      ${statCard('Filas', String(batch.rows.length), esc(batch.name))}
      ${statCard('Completadas', `${done}/${batch.rows.length}`, 'con entregables generados', 'ok')}
      ${statCard('Motor', esc(engineById(batch.engine).name), esc(recipeById(batch.recipe).name))}
      ${statCard('Reintentos', String(batch.rows.filter((row) => row.state === 'error').length), 'por bloque, no por lote', 'warn')}
    </div>
    <section class="panel">
      <div class="panel-head"><div><p class="eyebrow">Detalle</p><h2>${esc(batch.name)}</h2></div></div>
      <div class="panel-body tight">
        <div class="table-wrap scroll-area" data-scroll-area="lotes">
        <table class="table">
          <thead><tr><th>ID</th><th>Titulo</th><th class="num">Duracion</th><th>Estado</th><th>Nota</th></tr></thead>
          <tbody>
            ${batch.rows
              .map(
                (row) => `<tr>
                  <td class="mono">${esc(row.id)}</td>
                  <td>${esc(row.title)}</td>
                  <td class="num mono">${esc(row.duration)}</td>
                  <td><span class="badge ${row.state === 'ok' ? 'ok' : row.state === 'error' ? 'danger' : row.state === 'ejecutando' ? 'warn' : ''}">${esc(row.state)}</span></td>
                  <td class="tiny muted">${esc(row.note)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  </div>`;
}

/* =============================== BIBLIOTECA ============================== */
function libraryRows() {
  const rows = [];
  PROJECTS.forEach((p) => {
    p.docs.forEach((doc) => {
      doc.blocks.forEach((block) => {
        block.takes.forEach((take) => {
          rows.push({
            block,
            take,
            doc,
            project: p,
            voice: catalogVoice(block.role === 'narrador' ? p.cast?.[0]?.voiceId : p.cast?.[1]?.voiceId),
            approved: block.state === 'aprobado' && block.takeId === take.id,
          });
        });
      });
    });
  });
  return rows.slice(0, 24);
}

function viewBiblioteca() {
  const rows = libraryRows();
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div><h1 style="font-size:var(--text-2xl)">Biblioteca</h1><p class="tiny muted mt-2">Tomas aprobadas con su JSON auditado: motor, voz, parametros, RTF y huella de hardware.</p></div>
      <button class="btn" data-action="modal:export">${icon('download', 'sm')} Exportar paquete</button>
    </div>
    <section class="panel">
      <div class="panel-head"><div><p class="eyebrow">Auditada</p><h2>${rows.length} tomas recientes</h2></div></div>
      <div class="panel-body tight">
        <div class="table-wrap scroll-area" data-scroll-area="biblioteca">
        <table class="table">
          <thead><tr><th>Bloque</th><th>Texto</th><th>Voz</th><th>Motor</th><th class="num">Dur.</th><th class="num">RTF</th><th>Estado</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `<tr>
                  <td class="mono">${esc(row.block.id)}</td>
                  <td class="truncate" style="max-width:320px">${esc(row.block.text.slice(0, 64))}</td>
                  <td>${esc(row.voice ? row.voice.name : 'sin voz')}</td>
                  <td>${esc(engineById(row.voice ? row.voice.engine : 'kokoro').name)}</td>
                  <td class="num mono">${row.take.duration.toFixed(2)}</td>
                  <td class="num mono">${row.take.rtf.toFixed(3)}</td>
                  <td>${row.approved ? `<span class="badge ok">${icon('check', 'sm')} aprobada</span>` : `<span class="badge">toma</span>`}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  </div>`;
}

/* ================================= AJUSTES =============================== */
function toggleRow(key, label, detail) {
  const value = state.ajustes[key];
  return `<button class="row between" style="width:100%;padding:10px 0;border-bottom:1px solid var(--line);text-align:left" data-action="toggle" data-key="${key}">
    <span><b style="font-size:var(--text-sm)">${label}</b><br><span class="tiny muted">${detail}</span></span>
    <span class="badge ${value ? 'ok' : ''}">${value ? 'activado' : 'desactivado'}</span>
  </button>`;
}

function viewAjustes() {
  return `
  <div class="stack-4">
    <div><h1 style="font-size:var(--text-2xl)">Ajustes</h1><p class="tiny muted mt-2">Hardware real, licencias, privacidad y apariencia. El prototipo no simula datos que el backend no da.</p></div>
    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Hardware</p><h2>Ejecucion local</h2></div></div>
        <div class="panel-body stack-3">
          ${field('Proveedor', `<select class="select" data-action="ajustes:provider"><option ${state.ajustes.provider === 'DirectML' ? 'selected' : ''}>DirectML</option><option ${state.ajustes.provider === 'CPU' ? 'selected' : ''}>CPU</option></select>`)}
          ${rangeControl({ label: 'Hilos de CPU', id: 'threads', min: 2, max: 32, step: 1, value: state.ajustes.threads, action: 'ajustes:threads' })}
          ${rangeControl({ label: 'Limite de VRAM', id: 'vram', min: 4, max: 25, step: 1, value: state.ajustes.vram, action: 'ajustes:vram', format: (v) => `${v} GB` })}
          <div class="spec-inline">
            <div><span>RAM total</span><b>${system.ramTotal} GB</b></div>
            <div><span>VRAM</span><b>${system.vramUsed} / ${system.vramLimit} GB</b></div>
            <div><span>Hilos</span><b>${state.ajustes.threads}</b></div>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Apariencia</p><h2>Tema y tipografia</h2></div></div>
        <div class="panel-body stack-3">
          ${field('Tema', `<select class="select" data-action="theme:set">${themeOptions()}</select>`, 'Negro AMOLED usa negro puro para paneles OLED.')}
          ${rangeControl({ label: 'Tamano de letra', id: 'font-scale', min: 0.9, max: 1.3, step: 0.05, value: state.fontScale, action: 'ajustes:font', format: (v) => `${Math.round(Number(v) * 100)} %` })}
          <p class="tiny muted">La escala amplia toda la interfaz sin romper margenes: las rejillas usan ancho minimo cero y los textos largos se parten dentro de su panel.</p>
        </div>
      </section>
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Licencias y privacidad</p><h2>Uso personal</h2></div></div>
        <div class="panel-body">
          <p class="tiny muted" style="margin-bottom:var(--space-2)">Este prototipo declara uso personal: MMS-TTS (CC-BY-NC-4.0) y XTTS v2 (CPML) se muestran junto al resto y nunca se ocultan.</p>
          ${toggleRow('excludeNC', 'Ocultar motores no comerciales', 'No recomendado: el catalogo debe estar completo')}
          ${toggleRow('consentGate', 'Exigir consentimiento en clonacion', 'Bloquea guardar una voz clonada sin declaracion')}
          ${toggleRow('watchfolder', 'Carpeta vigilada', 'Deja un MD en inbox y aparece el audio en outbox')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">IA local</p><h2>Phi-3.5</h2></div></div>
        <div class="panel-body">
          ${toggleRow('phiClean', 'Limpiar guion', 'Muletillas, repeticiones y puntuacion')}
          ${toggleRow('phiCast', 'Detectar hablantes', 'Marcas de dialogo y guiones largos')}
          ${toggleRow('phiNotes', 'Notas de episodio', 'Resumen y etiquetas para podcast')}
          <p class="tiny dim" style="margin-top:var(--space-2)">Motor actual: ${esc(system.phi.available ? 'Phi-3.5 en DirectML' : 'heuristicas')}. Cada uso muestra quien respondio.</p>
        </div>
      </section>
    </div>
  </div>`;
}

/* ------------------------- PRODUCIR (se conserva) ------------------------- */
/** Reparto del documento por rol: cuantos bloques aprobados de cada uno. */
function roleBreakdown(doc) {
  const tonos = ['var(--accent)', 'var(--ok)', 'var(--info)', 'var(--amber)'];
  const porRol = new Map();
  (doc.blocks || []).forEach((block) => {
    const actual = porRol.get(block.role) || { total: 0, approved: 0 };
    actual.total += 1;
    if (block.state === 'aprobado') actual.approved += 1;
    porRol.set(block.role, actual);
  });
  return [...porRol.entries()].map(([role, data], index) => ({
    id: role,
    label: roleMeta(role).label,
    total: data.total,
    approved: data.approved,
    tone: tonos[index % tonos.length],
  }));
}

/** Bloques del documento con el filtro de la cabecera aplicado. */
function filteredBlocks(doc) {
  const filtro = state.produceFilter || 'todos';
  if (filtro === 'todos') return doc.blocks;
  return doc.blocks.filter((block) => block.state === filtro);
}

function viewProduce() {
  const p = project();
  const doc = currentDoc();
  const stats = projectStats(p);
  if (!doc) {
    return emptyState('Sin documentos', 'Este proyecto no tiene capitulos importados.', `<button class="btn primary" data-action="modal:import">${icon('upload', 'sm')} Importar documento</button>`);
  }
  const docStatsValue = {
    total: doc.blocks.length,
    approved: doc.blocks.filter((block) => block.state === 'aprobado').length,
    review: doc.blocks.filter((block) => block.state === 'revisar').length,
  };
  const block = findBlock(state.blockId) || doc.blocks[0];
  return `
  <div class="stack-3 screen-fill produce-screen">
    <!-- Cabecera fija: proyecto, estado de la pasada y acciones. -->
    <div class="panel produce-head">
      <div class="produce-title">
        <div class="row wrap">
          <strong>${esc(p.name)}</strong>${icon('chevron', 'sm')}<b>${esc(doc.title.split(' - ')[0])}</b>
        </div>
        <div class="row wrap tiny muted">
          <span>${doc.blocks.length} bloques</span><span>·</span><span>${docStatsValue.approved} aprobados</span><span>·</span><span>${docStatsValue.review} por revisar</span>
        </div>
      </div>
      <div class="segmented" role="group" aria-label="Pasada">
        <button data-action="mode:set" data-mode="draft" aria-pressed="${state.mode === 'draft'}">Borrador</button>
        <button data-action="mode:set" data-mode="final" aria-pressed="${state.mode === 'final'}">Final</button>
      </div>
      <div class="row">
        <button class="btn" data-action="queue:render-doc">${icon('play', 'sm')} Renderizar</button>
        <button class="btn primary" data-action="modal:export">${icon('download', 'sm')} Exportar</button>
      </div>
    </div>

    <!-- Franja de estado: cuanto falta y de quien es cada tramo. -->
    <div class="panel produce-status">
      <div class="ps-bar"><i style="width:${pct(docStatsValue.approved, doc.blocks.length || 1)}%"></i></div>
      <div class="ps-items">
        ${roleBreakdown(doc)
          .map(
            (item) => `<div class="ps-item">
              <span class="ps-dot" style="--tone:${item.tone}"></span>
              <span class="grow truncate">${esc(item.label)}</span>
              <b class="mono">${item.approved}/${item.total}</b>
            </div>`,
          )
          .join('')}
        <div class="ps-item">
          <span class="ps-dot" style="--tone:var(--warn)"></span>
          <span class="grow truncate">Por revisar</span>
          <b class="mono">${docStatsValue.review}</b>
        </div>
        <div class="ps-item">
          <span class="ps-dot" style="--tone:var(--text-3)"></span>
          <span class="grow truncate">Pendientes</span>
          <b class="mono">${doc.blocks.filter((b) => b.state === 'pendiente').length}</b>
        </div>
      </div>
    </div>

    <div class="produce-grid">
      <aside class="panel produce-col docs">
        <div class="panel-head"><div><p class="eyebrow">Documentos</p><h2>${esc(p.name)}</h2></div></div>
        <div class="panel-body tight scroll-area" data-scroll-area="documentos">
          ${p.docs
            .map(
              (item) => `<button class="doc-row ${item.id === state.docId ? 'active' : ''}" data-action="doc:select" data-doc="${item.id}">
                <span>${icon('file', 'sm')}</span>
                <span class="grow truncate">${esc(item.title)}</span>
                <span class="badge ${item.blocks.some((b) => b.state === 'revisar') ? 'warn' : 'ok'}">${item.blocks.filter((b) => b.state === 'aprobado').length}/${item.blocks.length}</span>
              </button>`,
            )
            .join('')}
          <button class="btn sm" style="margin-top:8px" data-action="modal:import">${icon('upload', 'sm')} Importar</button>
        </div>
      </aside>

      <section class="panel produce-col editor">
        <div class="panel-head">
          <div><p class="eyebrow">Segmentos</p><h2>${doc.blocks.length} bloques</h2></div>
          <span class="spacer"></span>
          <div class="segmented sm" role="group" aria-label="Filtro de segmentos">
            <button data-action="produce:filter" data-filter="todos" aria-pressed="${state.produceFilter === 'todos'}">Todos</button>
            <button data-action="produce:filter" data-filter="revisar" aria-pressed="${state.produceFilter === 'revisar'}">Revisar</button>
            <button data-action="produce:filter" data-filter="pendiente" aria-pressed="${state.produceFilter === 'pendiente'}">Pendientes</button>
          </div>
        </div>
        <div class="panel-body tight scroll-area" id="block-list" data-scroll-area="segmentos">
          ${filteredBlocks(doc).map((item) => blockRowHtml(item)).join('') || emptyState('Nada en este filtro', 'Cambia el filtro o aprueba los bloques pendientes.')}
        </div>
      </section>

      <aside class="panel produce-col inspector">
        ${blockEditorHtml(block)}
      </aside>
    </div>
    <div class="produce-queue ${state.queueOpen ? 'open' : ''}">${queueStripHtml()}</div>
  </div>`;
}

function blockRowHtml(block) {
  const take = chosenTake(block);
  const selected = block.id === state.blockId;
  return `<article class="block ${selected ? 'selected' : ''}" data-block-row="${block.id}" data-state="${block.state}">
    <header>
      <span class="mono tiny dim">${esc(block.id)}</span>
      <span class="badge ${block.state === 'aprobado' ? 'ok' : block.state === 'revisar' ? 'warn' : ''}">${esc(block.state)}</span>
      <span class="spacer"></span>
      <span class="role">${esc(roleMeta(block.role).label)}</span>
    </header>
    <p class="block-text">${esc(block.text)}</p>
    <footer>
      <button class="btn sm icon-only" data-action="block:play" data-block="${block.id}" aria-label="Escuchar bloque">${icon('play', 'sm')}</button>
      <span class="mono tiny">${take ? take.duration.toFixed(2) : '0.00'} s</span>
      <span class="tiny dim">toma ${block.takes.length}</span>
      <span class="spacer"></span>
      <button class="btn sm" data-action="block:select" data-block="${block.id}">${icon('edit', 'sm')} Editar</button>
    </footer>
  </article>`;
}

function blockEditorHtml(block) {
  if (!block) return '<div class="panel-body">Sin bloque</div>';
  const take = chosenTake(block);
  const voice = catalogVoice(project().cast?.find((slot) => slot.role === block.role)?.voiceId);
  return `<div class="panel-head"><div><p class="eyebrow">Inspector</p><h2>${esc(block.id)}</h2></div></div>
    <div class="panel-body stack-3 inspector-body">
      <label class="sr-only" for="block-text">Texto del bloque</label>
      <textarea id="block-text" class="textarea" data-block="${block.id}">${esc(block.text)}</textarea>
      <div class="spec-inline" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div><span>Voz</span><b>${esc(voice ? voice.name : 'sin asignar')}</b></div>
        <div><span>Motor</span><b>${esc(take ? engineById(take.engine).name : 'kokoro')}</b></div>
        <div><span>Duracion</span><b>${take ? take.duration.toFixed(2) : '0.00'} s</b></div>
        <div><span>RTF</span><b>${take ? take.rtf.toFixed(3) : '-'}</b></div>
      </div>
      <div class="takes-head eyebrow">Tomas</div>
      <div class="takes-list" data-scroll-area="tomas">${block.takes
        .map(
          (item) => `<div class="take ${item.id === block.takeId ? 'chosen' : ''}">
            <button class="btn sm icon-only" data-action="block:play" data-block="${block.id}" aria-label="Escuchar toma">${icon('play', 'sm')}</button>
            <span class="mono tiny">#${esc(item.id)} · ${item.duration.toFixed(2)} s</span>
            <button class="btn sm" data-action="take:select" data-block="${block.id}" data-take="${item.id}">${item.id === block.takeId ? 'elegida' : 'elegir'}</button>
            <span class="meta">${esc(engineById(item.engine).name)} · RTF ${item.rtf.toFixed(3)} · ${esc(item.qa || 'OK')}</span>
          </div>`,
        )
        .join('')}</div>
      <div class="row wrap inspector-actions">
        <button class="btn primary" data-action="block:approve" data-block="${block.id}">${icon('check', 'sm')} Aprobar</button>
        <button class="btn" data-action="block:render" data-block="${block.id}">${icon('refresh', 'sm')} Regenerar</button>
      </div>
    </div>`;
}

/* -------------------------------- modales -------------------------------- */
function modalWrapper(title, body, foot, extraClass = '') {
  return `<div class="scrim" data-action="modal:close"></div>
    <div class="modal ${extraClass}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">${appMark(26)}<h2>${esc(title)}</h2>
        <button class="btn icon-only" data-action="modal:close" aria-label="Cerrar">${icon('x')}</button></header>
      <div class="modal-body">${body}</div>
      ${foot ? `<footer class="modal-foot">${foot}</footer>` : ''}
    </div>`;
}

function modalHtml() {
  const modal = state.modals[state.modals.length - 1];
  if (!modal) return '';
  if (modal.type === 'recipe') {
    const recipe = recipeById(modal.recipeId);
    const engine = engineById(recipe.engine);
    return modalWrapper(
      recipe.name,
      `<p class="tiny muted">${esc(recipe.desc)}</p>
      <div class="spec-row" style="font-size:var(--text-sm)">
        <div><span>Estructura</span><b>${esc(recipe.structure)}</b></div>
        <div><span>Elenco</span><b>${esc(recipe.cast)}</b></div>
        <div><span>Motor final</span><b>${esc(engine.name)} · ${esc(engine.license)}</b></div>
        <div><span>Motor borrador</span><b>${esc(engineById(recipe.draft).name)}</b></div>
        <div><span>Velocidad</span><b>${recipe.speed.toFixed(2)}x</b></div>
        <div><span>Pausas</span><b>${esc(recipe.pause)}</b></div>
        <div><span>Loudness</span><b>${esc(recipe.lufs)}</b></div>
        <div><span>QA</span><b>${esc(recipe.qa)}</b></div>
      </div>
      <div><p class="eyebrow tiny dim">Entregables</p><div class="chips mt-2">${recipe.delivery.split(' · ').map((item) => `<span class="badge">${esc(item)}</span>`).join('')}</div></div>
      <div class="norm-preview"><b>${icon('sliders', 'sm')} Equivalente en YAML</b>
<pre class="code" style="background:none;border:0;padding:0;margin:6px 0 0">formato: ${recipe.id}
motor_borrador: ${recipe.draft}
motor_final: ${recipe.engine}
speed: ${recipe.speed}
pausas: { entre_bloques_ms: ${parseInt(recipe.pause, 10) || 0} }
loudness: { objetivo: "${recipe.lufs}" }
entregables: [${recipe.delivery.split(' · ').map((x) => x.toLowerCase().replace(/\s+/g, '_')).join(', ')}]</pre>
      </div>`,
      `<button class="btn" data-action="modal:close">Cerrar</button>
       <button class="btn primary" data-action="recipe:use" data-recipe="${recipe.id}">${icon('plus', 'sm')} Crear proyecto con esta receta</button>`,
    );
  }
  if (modal.type === 'qwen-payload') {
    const q = state.qwen;
    const instruccion = compileProfile(q.profile, q.master);
    const payload = buildPayload({ text: q.speech, instruction: instruccion, profile: q.profile });
    const cobertura = profileCoverage(q.profile);
    return modalWrapper(
      'Payload para Qwen3-TTS',
      `<p class="tiny muted">Esto es exactamente lo que viaja al motor con <span class="mono">generate_voice_design</span>: ${cobertura.done} de 14 campos del perfil, la instruccion compilada y el texto. ${esc(payload.model)}.</p>
      <pre class="code qwen-payload" style="max-height:340px">${esc(JSON.stringify(payload, null, 2))}</pre>
      <div class="prompt-note">${icon('info', 'sm')}<div>El texto del <b>input</b> no se recorta: si pasa de ${QWEN_MAX_TEXT} caracteres, el laboratorio bloquea la generacion antes de llegar aqui.</div></div>`,
      `<button class="btn" data-action="modal:close">Cerrar</button>
       <button class="btn primary" data-action="qwen:copy-payload">${icon('copy', 'sm')} Copiar payload</button>`,
    );
  }
  if (modal.type === 'qwen-templates') {
    const q = state.qwen;
    return modalWrapper(
      'Plantillas internas',
      `<div class="stack-3">
        <p class="tiny muted">La plantilla maestra es la del backend compartido, literal. Al editarla, el compilador rellena las cuatro variables: <span class="mono">{{identity}}</span>, <span class="mono">{{timbre}}</span>, <span class="mono">{{delivery}}</span> y <span class="mono">{{recording}}</span>.</p>
        ${field('Plantilla maestra de Qwen3', `<textarea class="textarea mono" style="min-height:240px" data-action="qwen:master">${esc(q.master)}</textarea>`)}
        <div class="prompt-note">${icon('alert', 'sm')}<div>Si dejas una variable sin resolver, el compilador <b>falla en voz alta</b> en vez de mandar un prompt roto. Es la misma regla del backend.</div></div>
      </div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       <button class="btn" data-action="qwen:master-reset">Restaurar original</button>
       <button class="btn primary" data-action="qwen:master-save">Guardar plantilla</button>`,
    );
  }
  if (modal.type === 'export') {
    const stats = projectStats();
    return modalWrapper(
      `Exportar ${project().name}`,
      `<p class="tiny muted">${stats.total} bloques · ${fmtDuration(stats.duration)} · ${esc(recipeById(project().recipeId).name)}</p>
      <div class="chips">${['WAV 24 bit', 'MP3 192', 'M4B con capitulos', 'SRT', 'CSV de QA', 'Informe de licencias'].map((item) => `<span class="badge ok">${icon('check', 'sm')} ${esc(item)}</span>`).join('')}</div>
      <div class="prompt-note">${icon('info', 'sm')}<div>Modo <b>uso personal</b>: el informe incluye los motores no comerciales usados, sin bloquear la exportacion.</div></div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       <button class="btn primary" data-action="export:run">${icon('download', 'sm')} Exportar paquete</button>`,
    );
  }
  if (modal.type === 'project') {
    return modalWrapper(
      'Nuevo proyecto',
      `<div class="stack-3">
        ${field('Nombre', `<input class="input" placeholder="Audiolibro: Patagonia" data-action="project:name" value="${esc(state.nuevoProyecto.name)}" />`)}
        ${field('Receta', `<select class="select" data-action="project:recipe">${RECIPES.map((recipe) => `<option value="${recipe.id}" ${recipe.id === state.nuevoProyecto.recipeId ? 'selected' : ''}>${esc(recipe.name)}</option>`).join('')}</select>`)}
        ${field('Uso declarado', `<select class="select" data-action="project:license"><option value="personal" ${state.nuevoProyecto.license === 'personal' ? 'selected' : ''}>Personal (todos los motores)</option><option value="comercial" ${state.nuevoProyecto.license === 'comercial' ? 'selected' : ''}>Comercial (avisa de NC)</option></select>`)}
      </div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       <button class="btn primary" data-action="project:create">${icon('plus', 'sm')} Crear proyecto</button>`,
    );
  }
  if (modal.type === 'import') {
    const files = state.lectura.files;
    return modalWrapper(
      'Importar documento',
      `<p class="tiny muted">PDF, EPUB, TXT, DOCX, MD o SRT. El texto se extrae en local y se segmenta en bloques.</p>
      <div class="drop"><h4>Arrastra el archivo o elige uno de prueba</h4>
        <div class="chips">${DOC_FORMATS.map((format) => `<span class="badge">${esc(format.label)}</span>`).join('')}</div>
      </div>
      <div>${files
        .map(
          (file) => `<div class="file-row">
            <span class="card-icon" style="--tone:var(--accent)">${icon('file', 'sm')}</span>
            <div style="min-width:0"><div class="file-name">${esc(file.name)}</div><div class="file-meta">${file.chars.toLocaleString('es-ES')} caracteres</div></div>
            <span class="badge">${esc(file.format)}</span>
            <button class="btn sm" data-action="import:file" data-file="${file.id}">Importar</button>
          </div>`,
        )
        .join('')}</div>`,
      `<button class="btn" data-action="modal:close">Cerrar</button>`,
      'wide',
    );
  }
  if (modal.type === 'grabar') {
    const step = state.grabacion.step;
    const titles = ['Prueba de sala', 'Teleprompter', 'Revision de la toma', 'Consentimiento'];
    return modalWrapper(
      `Grabar referencia · ${titles[step - 1]}`,
      `<div class="stack-3">
        <div class="row between tiny muted"><span>Paso ${step} de 4</span><span>${['5 s de silencio', '6 guiones calibrados', 'duracion 7-12 s', 'declaracion obligatoria'][step - 1]}</span></div>
        ${bar((step / 4) * 100, '')}
        ${
          step === 1
            ? `<div class="drop"><h4>Mide el ruido de la sala</h4><p class="tiny muted">Cinco segundos de silencio para decidir si la sala vale.</p>${icon('mic', 'hero')}</div>`
            : step === 2
              ? `<p class="tiny">Lee el guion narrativo calido con voz natural, a 20 cm del microfono.</p><div class="norm-preview">El rio cruzaba el valle sin prisa, y la luz de la tarde se quedaba en las piedras como si quisiera aprender el camino.</div>`
              : step === 3
                ? `<div class="spec-inline"><div><span>Duracion</span><b>9.4 s</b></div><div><span>Picos</span><b>-1.2 dB</b></div><div><span>SNR</span><b>38 dB</b></div><div><span>Voz</span><b>detectada</b></div></div>`
                : `<label class="row between" style="padding:10px 0"><span><b style="font-size:var(--text-sm)">Declaro ser el titular de esta voz</b><br><span class="tiny muted">Uso personal permitido, sin cesion a terceros.</span></span>
                    <input type="checkbox" ${state.grabacion.consent ? 'checked' : ''} data-action="grabar:consent" /></label>`
        }
      </div>`,
      `<button class="btn" data-action="grabar:prev" ${step === 1 ? 'disabled' : ''}>Atras</button>
       <button class="btn primary" data-action="grabar:next">${step === 4 ? `${icon('check', 'sm')} Guardar voz` : 'Continuar'}</button>`,
    );
  }
  if (modal.type === 'voice') {
    const voice = catalogVoice(modal.voiceId);
    if (!voice) return '';
    const engine = engineById(voice.engine);
    return modalWrapper(
      voice.name,
      `<div class="spec-inline">
        <div><span>Motor</span><b>${esc(engine.name)}</b></div>
        <div><span>Licencia</span><b>${esc(engine.license)}</b></div>
        <div><span>Region</span><b>${esc(voice.region)}</b></div>
        <div><span>Genero</span><b>${esc(voice.gender)}</b></div>
        <div><span>Muestra</span><b>${voice.sr / 1000} kHz</b></div>
        <div><span>Calidad</span><b>${esc(voice.quality)}</b></div>
      </div>
      <p class="tiny muted">${esc(voice.desc)}</p>
      <div class="chips">${voice.tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div>
      <div class="prompt-note">${icon('info', 'sm')}<div>${engine.commercial ? 'Uso comercial permitido por licencia.' : 'Licencia no comercial. En este prototipo de uso personal esta disponible igual que el resto, sin exclusiones.'}</div></div>`,
      `<button class="btn" data-action="modal:close">Cerrar</button>
       <button class="btn primary" data-action="voice:preview" data-voice="${voice.id}">${icon('play', 'sm')} Escuchar</button>`,
    );
  }
  if (modal.type === 'help') {
    return modalWrapper(
      'Ayuda del prototipo',
      `<div class="stack-3 tiny">
        <p>Atajos: <kbd>Ctrl K</kbd> paleta, <kbd>J</kbd>/<kbd>K</kbd> bloque anterior y siguiente, <kbd>espacio</kbd> escuchar, <kbd>Enter</kbd> aprobar, <kbd>R</kbd> regenerar.</p>
        <p>Temas: Omni, AMOLED, Grafito, Ambar y Pearl. El tamano de letra se ajusta en Ajustes.</p>
        <p>El pie fijo <b>HUMAN AI SYNERGY BY BENNER CASTILLO</b> y la marca del sidebar, el icono y el splash son el mismo emblema.</p>
        <p>Este prototipo no usa red, ni CDN, ni fuentes externas.</p>
      </div>`,
      `<button class="btn primary" data-action="modal:close">Entendido</button>`,
    );
  }
  if (modal.type === 'palette') {
    const items = paletteItems(state.palette.query);
    return `<div class="scrim" data-action="palette:close"></div>
      <div class="palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div class="palette-input">
          ${icon('search', 'sm')}
          <input id="palette-input" placeholder="Buscar pantallas, voces, bloques o comandos" value="${esc(state.palette.query)}" data-action="palette:query" autocomplete="off" />
          <kbd>Esc</kbd>
        </div>
        <div class="palette-list">
          ${items
            .map(
              (item, index) => `<button class="palette-item ${index === state.palette.active ? 'active' : ''}" data-action="palette:run" data-id="${item.id}">
                ${icon(item.icon, 'sm')}<span class="grow truncate">${esc(item.label)}</span><em class="tiny dim">${esc(item.hint)}</em>
              </button>`,
            )
            .join('')}
        </div>
      </div>`;
  }
  return '';
}

/* ------------------------------ paleta ---------------------------------- */
function paletteItems(query) {
  const q = (query || '').toLowerCase();
  const routes = Object.entries(TITLES)
    .filter(([id]) => id !== state.route)
    .map(([id, label]) => ({ id: `nav:${id}`, label: `Ir a ${label}`, icon: 'arrow', hint: 'navegar' }));
  const actions = [
    { id: 'act:lectura', label: 'Lectura y narracion: pegar 12.000 caracteres', icon: 'book', hint: 'modulo TTS' },
    { id: 'act:diseno', label: 'Disenar una voz con prompt', icon: 'wand', hint: 'VoiceDesign' },
    { id: 'act:render', label: 'Renderizar documento actual', icon: 'play', hint: 'cola' },
    { id: 'act:export', label: 'Exportar proyecto', icon: 'download', hint: 'entregables' },
    { id: 'act:import', label: 'Importar documento', icon: 'upload', hint: 'PDF · EPUB · TXT' },
    { id: 'act:grabar', label: 'Grabar referencia de voz', icon: 'mic', hint: 'clonacion' },
    { id: 'act:theme-amoled', label: 'Cambiar a Negro AMOLED', icon: 'settings', hint: 'tema' },
    { id: 'act:splash', label: 'Volver a ver el splash', icon: 'sparkles', hint: 'inicio' },
  ];
  const blocks = (currentDoc()?.blocks || [])
    .filter((block) => !q || block.text.toLowerCase().includes(q) || block.id.includes(q))
    .slice(0, 5)
    .map((block) => ({ id: `block:${block.id}`, label: `${block.id} · ${block.text.slice(0, 46)}...`, icon: 'edit', hint: 'bloque' }));
  const voices = CATALOG.filter((voice) => q && `${voice.name} ${voice.engine}`.toLowerCase().includes(q))
    .slice(0, 6)
    .map((voice) => ({ id: `voice:${voice.id}`, label: voice.name, icon: 'mic', hint: engineById(voice.engine).name }));
  const all = [...actions, ...routes, ...blocks, ...voices];
  return q ? all.filter((item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)) : all.slice(0, 12);
}

/* ---------------------------------- vistas -------------------------------- */
function view() {
  switch (state.route) {
    case 'inicio':
      return viewInicio();
    case 'lectura':
      return viewLectura();
    case 'diseno':
      return viewDiseno();
    case 'clonacion':
      return viewClonacion();
    case 'qwen':
      return viewQwen();
    case 'produce':
      return viewProduce();
    case 'voces':
      return viewVoces();
    case 'recetas':
      return viewRecetas();
    case 'elenco':
      return viewElenco();
    case 'presets':
      return viewPresets();
    case 'glosario':
      return viewGlosario();
    case 'lotes':
      return viewLotes();
    case 'biblioteca':
      return viewBiblioteca();
    case 'ajustes':
      return viewAjustes();
    default:
      return viewInicio();
  }
}

function render() {
  const app = $('#app');
  app.dataset.theme = state.theme;
  app.dataset.fontScale = String(state.fontScale);
  app.innerHTML = `${sidebarHtml()}
    <div class="main">
      ${topbarHtml()}
      <main class="content" id="content">${view()}</main>
    </div>
    ${footerHtml()}
    <div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>
    ${modalHtml()}
    ${splashHtml()}`;
  toasts.render();
  syncTrays(app);
  // La cabecera de la vista se pega arriba; el contenido respira abajo.
  const scroller = $('#content');
  if (scroller) scroller.style.setProperty('padding-bottom', 'var(--space-6, 28px)');
  if (state.route === 'produce') paintPlayer();
  if (state.splash === 'closing') {
    const node = $('#splash');
    if (node) node.classList.add('closing');
  }
}

/* ------------------------------ interacciones ----------------------------- */
function openModal(modal) {
  state.modals.push(modal);
  render();
  const input = $('#palette-input');
  if (input) input.focus();
}

function closeModal() {
  state.modals.pop();
  render();
}

function navigate(route) {
  // Una ruta desconocida (estado viejo, enlace roto) nunca deja la pantalla vacia.
  state.route = TITLES[route] ? route : 'inicio';
  state.search = '';
  state.modals = [];
  state.palette.open = false;
  render();
  // El scroll vive en #content: cada pantalla empieza por su cabecera.
  const content = $('#content');
  if (content) content.scrollTop = 0;
}

function selectBlock(id) {
  state.blockId = id;
  render();
}

function approveBlock(id) {
  const block = findBlock(id);
  if (!block) return;
  block.state = 'aprobado';
  notify('Bloque aprobado', `${block.id} · la exportacion usara esta toma`, 'ok');
  render();
}

function renderBlock(id) {
  const block = findBlock(id);
  if (!block) return;
  const take = {
    id: `${block.takes.length + 1}`,
    engine: state.mode === 'draft' ? 'piper' : 'kokoro',
    duration: Math.max(1, block.text.length / 14.5),
    rtf: state.mode === 'draft' ? 0.05 : 0.285,
    qa: 'OK',
  };
  block.takes.push(take);
  block.takeId = take.id;
  block.state = 'revisar';
  notify('Toma nueva', `${block.id} · ${take.duration.toFixed(2)} s con ${engineById(take.engine).name}`, 'ok');
  render();
}

function selectTake(blockId, takeId) {
  const block = findBlock(blockId);
  if (!block) return;
  block.takeId = takeId;
  render();
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function runExport() {
  const stats = projectStats();
  state.modals = [];
  notify('Exportacion en cola', `${project().name} · ${stats.total} bloques · ${fmtDuration(stats.duration)}`, 'ok');
  render();
}

function assignCast(voiceId, role) {
  const p = project();
  p.cast = p.cast || [];
  const slot = p.cast.find((item) => item.role === role);
  if (slot) {
    slot.voiceId = voiceId;
    slot.locked = true;
  } else {
    p.cast.push({ role, voiceId, locked: true, blocks: 0 });
  }
  notify('Elenco actualizado', `${roleMeta(role).label} · ${voiceLabel(voiceId)}`, 'ok');
  render();
}

function runBatchStep() {
  if (state.batchRunning) {
    state.batchRunning = false;
    if (state.batchTimer) clearInterval(state.batchTimer);
    render();
    return;
  }
  state.batchRunning = true;
  state.batchTimer = setInterval(() => {
    const next = state.batch.rows.find((row) => row.state === 'pendiente' || row.state === 'ejecutando');
    if (!next) {
      state.batchRunning = false;
      clearInterval(state.batchTimer);
      render();
      return;
    }
    if (next.state === 'pendiente') {
      next.state = 'ejecutando';
      next.note = 'procesando bloques';
    } else {
      next.state = 'ok';
      next.duration = `${1 + (next.title.length % 4)}:${String((next.title.length * 7) % 60).padStart(2, '0')}`;
      next.note = 'SRT generado';
    }
    render();
  }, 900);
}

/* -------------------------- modulo lectura acciones ----------------------- */
/** Refresca los numeros del editor de lectura sin reemplazar el textarea (conserva el foco). */
function syncLecturaMeta() {
  const s = lecturaStats();
  const counter = $('.read-editor .read-meta');
  const badge = $('#lectura-badge');
  const barNode = $('#lectura-counter');
  if (counter) {
    counter.innerHTML = `<span><b>${s.chars.toLocaleString('es-ES')}</b> caracteres</span>
      <span><b>${s.words.toLocaleString('es-ES')}</b> palabras</span>
      <span><b>${s.chunks}</b> bloques de ${s.preset.chunk}</span>
      <span><b>${fmtDuration(s.est.seconds)}</b> de audio estimado</span>
      <span class="mono dim">RTF ${s.engine.rtf.toFixed(3)} · ${esc(s.engine.name)}</span>`;
  }
  if (badge) {
    badge.textContent = `${s.chars.toLocaleString('es-ES')} / ${TEXT_LIMIT.toLocaleString('es-ES')}`;
    badge.className = `badge ${s.chars > TEXT_LIMIT ? 'danger' : s.chars > TEXT_LIMIT * 0.85 ? 'warn' : 'ok'}`;
  }
  if (barNode) {
    barNode.className = `counter-bar ${s.chars > TEXT_LIMIT ? 'danger' : s.chars > TEXT_LIMIT * 0.85 ? 'warn' : ''}`;
    if (barNode.firstElementChild) barNode.firstElementChild.style.width = `${Math.min(100, pct(s.chars, TEXT_LIMIT))}%`;
  }
}

function lecturaGenerate() {
  const s = lecturaStats();
  if (s.chars < 10) {
    notify('Falta texto', 'Pega un texto o carga un documento antes de generar', 'warn');
    return;
  }
  const preset = s.preset;
  state.lectura.generated = { total: s.chunks, done: 0 };
  state.lectura.progress = 0;
  notify('Render iniciado', `${s.chunks} bloques · ${preset.name} · ${fmtDuration(s.est.seconds)} estimados`, 'ok');
  enqueueRender(null, state.mode, null);
  render();
  const timer = setInterval(() => {
    const gen = state.lectura.generated;
    if (!gen) {
      clearInterval(timer);
      return;
    }
    gen.done = Math.min(gen.total, gen.done + Math.max(1, Math.round(gen.total / 14)));
    state.lectura.progress = pct(gen.done, gen.total);
    const barNode = $('#lectura-progress');
    if (barNode) barNode.style.width = `${state.lectura.progress}%`;
    const label = $('#lectura-progress-label');
    if (label) label.textContent = `Bloque ${gen.done} de ${gen.total}`;
    if (gen.done >= gen.total) {
      clearInterval(timer);
      state.lectura.step = 'listo';
      notify('Audio listo', `${preset.name} · ${s.chars.toLocaleString('es-ES')} caracteres · SRT por bloque`, 'ok');
      render();
    }
  }, 320);
}

/* ------------------------- modulo diseno acciones ------------------------- */
const HEURISTIC_TIMBRES = {
  grave: 'profundo, con resonancia pectoral y graves solidos',
  agudo: 'claro, brillante y de tesitura alta',
  calido: 'calido, envolvente y aterciopelado',
  neutro: 'equilibrado, sin coloraciones marcadas',
};

function heuristicPrompt(raw, mode) {
  const low = (raw || '').toLowerCase();
  if (mode === 'instruct_tts') {
    if (/susurr|secreto|misterio/.test(low)) return 'Habla susurrando con misterio e intimidad, bajando la intensidad y alargando las sibilancias.';
    if (/alegre|feliz|contento|sonriente/.test(low)) return 'Habla con tono sonriente y alegre, proyectando optimismo y energia calida en cada frase.';
    if (/serio|corporativo|formal|documental/.test(low)) return 'Habla con tono firme, pausado y profesional, manteniendo una diccion neutral y ceremoniosa.';
    if (/triste|nostalgic|melancolic/.test(low)) return 'Habla con modulacion melancolica y reflexiva, con pausas expresivas y respiracion tenue.';
    return `Habla con intencion clara de ${raw || 'una lectura natural'}, modulando la cadencia y la expresividad de forma humana.`;
  }
  const genero = /mujer|femenin|nina|senora/.test(low) ? 'femenina' : /neutro|androgin/.test(low) ? 'androgina o neutra' : 'masculina';
  const edad = /viejo|anciano|maduro|abuelo/.test(low) ? 'madura de unos 45 a 55 anos' : 'joven de unos 25 a 35 anos';
  const timbre = /grave|profund|bajo/.test(low)
    ? HEURISTIC_TIMBRES.grave
    : /agudo|brillante|claro/.test(low)
      ? HEURISTIC_TIMBRES.agudo
      : HEURISTIC_TIMBRES.calido;
  const cadencia = /rapido|dinamic|agil|noticias|comercial/.test(low)
    ? 'cadencia dinamica, ritmo agil y proyeccion comercial energica'
    : 'cadencia pausada, articulacion impecable y tono reflexivo';
  return `Voz ${genero} ${edad}, timbre ${timbre}, ${cadencia}, con acento castellano neutro, excelente inteligibilidad y presencia acustica de estudio profesional.`;
}

function enhancePrompt() {
  const d = state.diseno;
  const raw = d.prompt.trim() || `${d.gender === 'F' ? 'mujer' : d.gender === 'M' ? 'hombre' : 'voz neutra'} de ${d.age}, timbre ${d.timbre}, acento ${d.accent.replaceAll('_', ' ')}`;
  const phi = state.ajustes.phiClean && system.phi.available;
  const improved = heuristicPrompt(raw, d.mode);
  d.improved = improved;
  d.improvedBy = phi ? 'Phi-3.5 local (DirectML)' : 'heuristicas del normalizador';
  if (!d.prompt.trim()) d.prompt = raw;
  notify('Prompt mejorado', d.improvedBy, 'ok');
  render();
}

function disenoGenerate() {
  const d = state.diseno;
  const engine = designEngine();
  if (!d.prompt.trim()) {
    notify('Falta el prompt', 'Escribe una descripcion o elige un prompt de la biblioteca', 'warn');
    return;
  }
  const random = seeded(`${d.prompt}-${d.seed}-${engine}`);
  const duration = 2.4 + random() * 2.6;
  const pool = CATALOG.filter((voice) => voice.engine === engine);
  const base = pool[Math.floor(random() * Math.max(1, pool.length))] || CATALOG[0];
  d.generated = {
    name:
      engine === 'cosyvoice'
        ? `CosyVoice · ${d.mode === 'instruct_tts' ? 'Instruct' : 'Referencia'} ${String(d.seed).slice(-3)}`
        : `VoiceDesign ${String(d.seed).slice(-4)}`,
    duration: duration.toFixed(2),
    rtf: engineById(engine).rtf,
    seed: d.seed,
    voiceId: base.id,
    engine,
  };
  notify('Voz generada', `${d.generated.name} · ${d.generated.duration} s · procedencia auditada`, 'ok');
  render();
}

/* --------------------------------- acciones ------------------------------- */
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;

  switch (action) {
    case 'nav':
      navigate(target.dataset.route);
      break;
    case 'modal:close':
      closeModal();
      break;
    case 'help':
      openModal({ type: 'help' });
      break;
    case 'palette:open':
      state.palette = { open: true, query: '', active: 0 };
      openModal({ type: 'palette' });
      break;
    case 'palette:close':
      state.palette.open = false;
      closeModal();
      break;
    case 'palette:run':
      runPaletteItem(target.dataset.id);
      break;
    // theme:set y project:switch viven en el manejador de `change`:
    // un <select> no emite click al elegir una opcion.
    case 'project:open':
      state.projectId = target.dataset.project;
      state.docId = project().docs[0]?.id || '';
      state.blockId = allBlocks()[0]?.id || '';
      navigate('produce');
      break;
    case 'project:new':
      openModal({ type: 'project' });
      break;
    case 'project:create': {
      const name = state.nuevoProyecto.name.trim() || 'Proyecto sin nombre';
      PROJECTS.push({
        id: `proj-${Date.now()}`,
        name,
        recipeId: state.nuevoProyecto.recipeId,
        license: state.nuevoProyecto.license,
        updated: 'hoy',
        docs: [],
        cast: [],
      });
      state.modals = [];
      notify('Proyecto creado', `${name} · ${recipeById(state.nuevoProyecto.recipeId).name}`, 'ok');
      render();
      break;
    }
    case 'recipe:open':
      openModal({ type: 'recipe', recipeId: target.dataset.recipe });
      break;
    case 'recipe:use':
      state.nuevoProyecto.recipeId = target.dataset.recipe;
      state.modals = [];
      openModal({ type: 'project' });
      break;
    case 'recipe:new':
      notify('Receta nueva', 'En el producto real es un YAML de unas 20 lineas', 'ok');
      break;
    case 'recipes:filter':
      state.recipeFilter = target.dataset.filter;
      render();
      break;
    case 'modal:export':
      openModal({ type: 'export' });
      break;
    case 'export:run':
      runExport();
      break;
    case 'modal:import':
      openModal({ type: 'import' });
      break;
    case 'import:file': {
      const file = state.lectura.files.find((item) => item.id === target.dataset.file);
      state.modals = [];
      if (file) {
        state.lectura.text = sampleText(Math.min(TEXT_LIMIT, file.chars));
        state.route = 'lectura';
        notify('Documento importado', `${file.name} · ${state.lectura.text.length.toLocaleString('es-ES')} caracteres segmentados`, 'ok');
      }
      render();
      break;
    }
    case 'modal:grabar':
      state.grabacion = { step: 1, seconds: 0, level: 0, consent: false, name: state.grabacion.name };
      openModal({ type: 'grabar' });
      break;
    case 'grabar:next':
      if (state.grabacion.step < 4) {
        state.grabacion.step += 1;
        render();
      } else if (!state.grabacion.consent) {
        notify('Falta consentimiento', 'No se puede guardar una voz clonada sin declaracion', 'danger');
      } else {
        state.modals = [];
        notify('Voz creada', `${state.grabacion.name} · condicionamiento bloqueado`, 'ok');
        render();
      }
      break;
    case 'grabar:prev':
      state.grabacion.step = Math.max(1, state.grabacion.step - 1);
      render();
      break;
    case 'voice:detail':
      openModal({ type: 'voice', voiceId: target.dataset.voice });
      break;
    case 'voice:preview': {
      const voice = catalogVoice(target.dataset.voice);
      notify('Reproduciendo muestra', `${voice ? voice.name : 'voz'} · ${voice ? engineById(voice.engine).name : ''}`, 'ok');
      break;
    }
    case 'voice:assign': {
      const role = state.castRole || 'personaje_1';
      assignCast(target.dataset.voice, role);
      break;
    }
    case 'voices:filter':
      state.voiceFilter = target.dataset.filter;
      state.voicePage = 0;
      render();
      break;
    case 'voices:page':
      state.voicePage = Number(target.dataset.page) || 0;
      render();
      break;
    case 'tray:prev':
      moveTray(target.dataset.tray, -1);
      break;
    case 'tray:next':
      moveTray(target.dataset.tray, 1);
      break;
    case 'elenco:change': {
      state.castRole = target.dataset.role;
      notify('Rol seleccionado', `${roleMeta(state.castRole).label} · elige una voz abajo`, 'ok');
      break;
    }
    case 'mode:set':
      setMode(target.dataset.mode);
      break;
    case 'doc:select':
      state.docId = target.dataset.doc;
      state.blockId = allBlocks()[0]?.id || '';
      render();
      break;
    case 'block:select':
      selectBlock(target.dataset.block);
      break;
    case 'block:approve':
      approveBlock(target.dataset.block);
      break;
    case 'block:render':
      renderBlock(target.dataset.block);
      break;
    case 'block:play':
      startPlayer(target.dataset.block);
      break;
    case 'take:select':
      selectTake(target.dataset.block, target.dataset.take);
      break;
    case 'queue:render-doc':
      enqueueRender(currentDoc(), state.mode, null);
      render();
      break;
    case 'queue:pause':
      if (state.queueTimer) clearInterval(state.queueTimer);
      state.queueRunning = false;
      state.queueTimer = null;
      notify('Cola pausada', 'Se reanuda entre bloques, nunca a mitad de una inferencia', 'warn');
      render();
      break;
    case 'resume':
      state.route = 'produce';
      render();
      break;
    case 'toggle': {
      const key = target.dataset.key;
      state.ajustes[key] = !state.ajustes[key];
      render();
      break;
    }
    case 'batch:run':
      runBatchStep();
      break;
    case 'batch:import':
      notify('CSV importado', '8 filas nuevas encoladas con reintento por bloque', 'ok');
      break;
    case 'preset:open':
      notify('Ficha de preset', 'Receta, voz y guardarrailes del cliente', 'ok');
      break;
    case 'preset:use':
      notify('Preset aplicado', 'Listo para pegar el texto y generar', 'ok');
      break;
    case 'preset:new':
      notify('Preset nuevo', 'Se guarda con la voz bloqueada del cliente', 'ok');
      break;
    case 'glossary:new':
      notify('Termino nuevo', 'Se aplica antes de sintetizar', 'ok');
      break;
    case 'glossary:remove':
      notify('Termino eliminado', target.dataset.term, 'warn');
      break;

    /* -------------------------------- splash ------------------------------- */
    case 'splash:start':
    case 'splash:skip':
      closeSplash();
      break;

    /* ------------------------------- lectura ------------------------------- */
    case 'lectura:sample':
      state.lectura.text = sampleText(TEXT_LIMIT);
      notify('Texto de ejemplo cargado', `${state.lectura.text.length.toLocaleString('es-ES')} caracteres · ${lecturaStats().chunks} bloques`, 'ok');
      render();
      break;
    case 'lectura:clear':
      state.lectura.text = '';
      state.lectura.generated = null;
      state.lectura.progress = 0;
      render();
      break;
    case 'lectura:preset': {
      const preset = readPresetById(target.dataset.preset);
      const voices = CATALOG.filter((voice) => voice.engine === preset.engine);
      state.lectura.preset = preset.id;
      state.lectura.speed = null;
      state.lectura.pause = null;
      state.lectura.chunk = null;
      state.lectura.emotion = null;
      state.lectura.engine = preset.engine;
      state.lectura.voice = voices.some((voice) => voice.id === preset.voice) ? preset.voice : (voices[0]?.id || preset.voice);
      notify('Preset aplicado', `${preset.name} · ${engineById(preset.engine).name}`, 'ok');
      render();
      break;
    }
    case 'lectura:generate':
      lecturaGenerate();
      break;
    case 'lectura:normalize':
      if (!state.lectura.text.trim()) {
        notify('Nada que limpiar', 'Pega un texto primero', 'warn');
        break;
      }
      notify('Guion limpio', 'Phi-3.5 local: muletillas y repeticiones eliminadas', 'ok');
      break;
    case 'lectura:upload': {
      const id = `doc-${Date.now()}`;
      state.lectura.files.push({
        id,
        name: `documento_${state.lectura.files.length + 1}.pdf`,
        format: 'pdf',
        pages: 12,
        chars: 14200,
        status: 'listo',
      });
      notify('Documento anadido', 'Texto extraido en local', 'ok');
      render();
      break;
    }
    case 'lectura:load': {
      const file = state.lectura.files.find((item) => item.id === target.dataset.file);
      if (file) {
        state.lectura.text = sampleText(Math.min(TEXT_LIMIT, file.chars));
        notify('Documento cargado', `${file.name} · ${state.lectura.text.length.toLocaleString('es-ES')} caracteres`, 'ok');
        render();
      }
      break;
    }

    /* -------------------------------- diseno ------------------------------- */
    case 'queue:toggle':
      state.queueOpen = !state.queueOpen;
      render();
      break;
    case 'produce:filter':
      state.produceFilter = target.dataset.filter;
      render();
      break;
    case 'qwen:query':
      state.qwen.query = target.value;
      syncQwenLibrary();
      break;
    case 'qwen:category':
      state.qwen.category = target.dataset.category;
      render();
      break;
    case 'qwen:use': {
      const titulo = target.dataset.title;
      const base = SEED_VOICES.find((v) => v.title === titulo) || state.qwen.saved.find((v) => v.title === titulo);
      if (!base) break;
      state.qwen.profile = { ...emptyProfile(), ...base.profile };
      state.qwen.activeTitle = base.title;
      state.qwen.title = base.title;
      state.qwen.parsed = null;
      state.qwen.phi = false;
      notify('Perfil cargado', `${base.title} · ${profileCoverage(base.profile).done} de 14 campos`, 'ok');
      render();
      break;
    }
    case 'qwen:analyze': {
      const texto = (state.qwen.description || '').trim();
      if (!texto) {
        notify('Falta la descripcion', 'Escribe como suena la voz antes de analizar', 'warn');
        break;
      }
      const r = parseDescription(texto);
      state.qwen.profile = r.profile;
      state.qwen.parsed = { ...r.analysis, matched: r.matched };
      state.qwen.activeTitle = '';
      if (r.analysis.conflicts.length) {
        notify('Hay conflictos', `${r.analysis.conflicts.length} atributos se contradicen`, 'warn');
      } else {
        notify('Perfil extraido', `${r.matched} atributos · confianza ${Math.round(r.analysis.confidence * 100)} %`, 'ok');
      }
      render();
      break;
    }
    case 'qwen:clear-profile':
      state.qwen.profile = emptyProfile();
      state.qwen.parsed = null;
      state.qwen.activeTitle = '';
      notify('Perfil vaciado', 'Los catorce campos vuelven a null', 'info');
      render();
      break;
    case 'qwen:copy':
      notify('Instruccion copiada', `${compileProfile(state.qwen.profile, state.qwen.master).length} caracteres`, 'ok');
      break;
    case 'qwen:payload':
      openModal({ type: 'qwen-payload' });
      break;
    case 'qwen:templates':
      openModal({ type: 'qwen-templates' });
      break;
    case 'qwen:generate': {
      const q = state.qwen;
      if (!q.speech.trim()) {
        notify('Falta el texto', 'El laboratorio necesita una frase para sintetizar', 'warn');
        break;
      }
      if (q.speech.length > QWEN_MAX_TEXT) {
        notify('Texto demasiado largo', `El contrato admite ${QWEN_MAX_TEXT} caracteres y hay ${q.speech.length}`, 'warn');
        break;
      }
      const instruccion = compileProfile(q.profile, q.master);
      const random = seeded(`qwen-${q.profile.gender}-${q.profile.age}-${q.speech.length}-${q.title}`);
      const duration = 2 + random() * 3.4;
      const rtf = 1.4 + random() * 1.6; // CPU: mas lento que tiempo real
      // Ojo: no se puede llamar `render` a esta variable, taparia la funcion global.
      const toma = {
        id: `r-${Date.now()}`,
        title: q.title || 'Nueva voz',
        category: q.activeTitle ? 'Biblioteca' : 'Personalizada',
        text: q.speech,
        instruction: instruccion,
        profile: { ...q.profile },
        duration: Number(duration.toFixed(2)),
        elapsed: Number((duration * rtf).toFixed(2)),
        rtf: Number(rtf.toFixed(2)),
      };
      q.lastRender = toma;
      q.renders = [toma, ...q.renders].slice(0, 24);
      notify('Audio generado', `${toma.duration} s en ${toma.elapsed} s · RTF ${toma.rtf}`, 'ok');
      render();
      break;
    }
    case 'qwen:play':
      if (state.qwen.lastRender) notify('Reproduciendo WAV', state.qwen.lastRender.title, 'info');
      break;
    case 'qwen:reuse': {
      const r = state.qwen.lastRender;
      if (!r) break;
      state.qwen.title = r.title;
      state.qwen.speech = r.text;
      if (r.profile) state.qwen.profile = { ...emptyProfile(), ...r.profile };
      notify('Render cargado', 'El estudio vuelve al estado de esa toma', 'ok');
      render();
      break;
    }
    case 'qwen:save-profile': {
      const q = state.qwen;
      const cobertura = profileCoverage(q.profile);
      if (!cobertura.done) {
        notify('Perfil vacio', 'Rellena al menos un atributo antes de guardar', 'warn');
        break;
      }
      const titulo = q.title.trim() || `Perfil ${q.saved.length + 1}`;
      q.saved = [{ title: titulo, category: 'Personalizada', profile: { ...q.profile } }, ...q.saved].slice(0, 30);
      q.activeTitle = titulo;
      notify('Perfil guardado', `${titulo} · ${cobertura.done} de 14 campos`, 'ok');
      render();
      break;
    }
    case 'qwen:render-play':
      notify('Reproduciendo WAV', (state.qwen.renders.find((r) => r.id === target.dataset.render) || {}).title || '', 'info');
      break;
    case 'qwen:render-reuse': {
      const r = state.qwen.renders.find((item) => item.id === target.dataset.render);
      if (!r) break;
      state.qwen.title = r.title;
      state.qwen.speech = r.text;
      if (r.profile) state.qwen.profile = { ...emptyProfile(), ...r.profile };
      notify('Render cargado', 'El estudio vuelve al estado de esa toma', 'ok');
      render();
      break;
    }
    case 'qwen:render-delete':
      state.qwen.renders = state.qwen.renders.filter((item) => item.id !== target.dataset.render);
      if (state.qwen.lastRender && state.qwen.lastRender.id === target.dataset.render) state.qwen.lastRender = null;
      notify('Render eliminado', 'El WAV simulado sale del historial', 'info');
      render();
      break;
    case 'qwen:prompt-filter':
      state.qwen.promptFilter = target.dataset.filter;
      state.qwen.promptOpen = null;
      render();
      break;
    case 'qwen:prompt-toggle':
      state.qwen.promptOpen = state.qwen.promptOpen === target.dataset.prompt ? null : target.dataset.prompt;
      render();
      break;
    case 'qwen:apply-prompt': {
      const item = PROMPT_LIBRARY.find((p2) => p2.id === target.dataset.prompt);
      if (!item) break;
      const mejorado = improvePrompt(item.text, { mode: item.mode });
      state.qwen.prompt = mejorado.text;
      state.qwen.promptMode = item.mode;
      notify('Prompt aplicado', `${mejorado.added.length} atributos anadidos · ${mejorado.text.length} caracteres`, 'ok');
      render();
      break;
    }
    case 'qwen:prompt-editor': {
      const item = PROMPT_LIBRARY.find((p2) => p2.id === target.dataset.prompt);
      if (!item) break;
      state.qwen.prompt = improvePrompt(item.text, { mode: item.mode }).text;
      state.qwen.promptMode = item.mode;
      state.qwen.promptOpen = null;
      notify('Prompt en el editor', 'Puedes retocarlo antes de usarlo', 'info');
      render();
      break;
    }
    case 'qwen:use-prompt': {
      const item = PROMPT_LIBRARY.find((p2) => p2.id === target.dataset.prompt);
      if (!item) break;
      state.qwen.description = item.text;
      const r = parseDescription(item.text);
      state.qwen.profile = r.profile;
      state.qwen.parsed = { ...r.analysis, matched: r.matched };
      notify('Descripcion cargada', `${r.matched} atributos reconocidos`, 'ok');
      render();
      break;
    }
    case 'qwen:copy-payload': {
      const instruccion = compileProfile(state.qwen.profile, state.qwen.master);
      const payload = buildPayload({ text: state.qwen.speech, instruction: instruccion, profile: state.qwen.profile });
      notify('Payload copiado', `${JSON.stringify(payload).length} caracteres de JSON`, 'ok');
      closeModal();
      break;
    }
    case 'qwen:master-save': {
      const area = $('[data-action="qwen:master"]');
      const valor = area ? area.value : '';
      if (!/\{\{identity\}\}/.test(valor) || !/\{\{timbre\}\}/.test(valor) || !/\{\{delivery\}\}/.test(valor) || !/\{\{recording\}\}/.test(valor)) {
        notify('Plantilla invalida', 'Faltan las cuatro variables del contrato', 'warn');
        break;
      }
      state.qwen.master = valor.trim();
      notify('Plantilla guardada', 'El compilador la usara en la proxima instruccion', 'ok');
      closeModal();
      break;
    }
    case 'qwen:master-reset':
      state.qwen.master = MASTER_TEMPLATE;
      notify('Plantilla restaurada', 'Vuelve el texto original del backend', 'ok');
      closeModal();
      break;
    case 'clone:step':
      state.clonacion.step = target.dataset.step;
      render();
      break;
    case 'clone:source':
      state.clonacion.source = target.dataset.source;
      render();
      break;
    case 'clone:load-sample':
      state.clonacion.reference = { ...SAMPLE_REFERENCE };
      state.clonacion.transcript = SAMPLE_REFERENCE.transcript;
      state.clonacion.cleaningApplied = false;
      state.clonacion.result = null;
      notify('Referencia cargada', `${SAMPLE_REFERENCE.seconds} s · se limpia antes de clonar`, 'ok');
      render();
      break;
    case 'clone:clear':
      state.clonacion.reference = null;
      state.clonacion.transcript = '';
      state.clonacion.cleaningApplied = false;
      state.clonacion.result = null;
      render();
      break;
    case 'clone:record': {
      const c = state.clonacion;
      const engine = cloneEngineById(c.engine);
      if (c.recording) {
        c.recording = false;
        const segundos = Math.max(engine.minRef, Math.min(engine.maxRef, c.recordSeconds || engine.minRef));
        c.reference = {
          name: `grabacion-${new Date().toISOString().slice(11, 19).replaceAll(':', '')}.wav`,
          seconds: Number(segundos.toFixed(1)),
          format: 'WAV',
          sr: 48000,
          channels: 1,
          sizeMb: Number(((segundos * 48000 * 2) / 1024 / 1024).toFixed(1)),
          grabada: true,
        };
        c.recordSeconds = 0;
        c.cleaningApplied = false;
        c.result = null;
        notify('Grabacion lista', `${segundos.toFixed(1)} s de referencia`, 'ok');
      } else {
        c.recording = true;
        c.recordSeconds = 0;
        notify('Grabando', `Habla con naturalidad. Se detiene a los ${engine.maxRef} s.`, 'info');
      }
      render();
      break;
    }
    case 'clone:transcribe':
      if (state.clonacion.reference) {
        state.clonacion.transcript = SAMPLE_REFERENCE.transcript;
        notify('Transcripcion lista', 'Revisala: el motor exige que sea exacta', 'ok');
        render();
      }
      break;
    case 'clone:cleaning':
      state.clonacion.cleaning = target.dataset.cleaning;
      state.clonacion.cleaningApplied = false;
      render();
      break;
    case 'clone:clean':
      if (!state.clonacion.reference) {
        notify('Falta la referencia', 'Sube o graba un audio antes de limpiar', 'warn');
        break;
      }
      state.clonacion.cleaningApplied = true;
      notify('Limpieza aplicada', cleanPresetById(state.clonacion.cleaning).name, 'ok');
      render();
      break;
    case 'clone:engine':
      state.clonacion.engine = target.dataset.engine;
      state.clonacion.result = null;
      render();
      break;
    case 'clone:preset': {
      const preset = clonePresetById(target.dataset.preset);
      state.clonacion.preset = preset.id;
      state.clonacion.engine = preset.engine;
      state.clonacion.cleaning = preset.cleaning;
      state.clonacion.cleaningApplied = false;
      state.clonacion.result = null;
      notify('Preset aplicado', `${preset.name} · ${cloneEngineById(preset.engine).name}`, 'ok');
      render();
      break;
    }
    case 'clone:test': {
      const c = state.clonacion;
      const evalRef = evaluateReference(c.reference ? { ...c.reference, transcript: c.transcript } : null, c.engine);
      if (!evalRef.ok) {
        notify('No se puede clonar', evalRef.avisos[0]?.texto || 'Revisa la referencia', 'warn');
        break;
      }
      if (!c.cleaningApplied) {
        notify('Falta la limpieza', 'Limpia la referencia antes de clonar', 'warn');
        break;
      }
      const engine = cloneEngineById(c.engine);
      const random = seeded(`clone-${c.engine}-${c.preset}-${c.transcript.length}`);
      const dur = 2.2 + random() * 2.4;
      c.result = {
        duration: dur.toFixed(2),
        similarity: Math.round(78 + random() * 17),
        elapsed: (dur * engine.rtf).toFixed(2),
        qa: random() > 0.25 ? 'OK' : 'revisar',
      };
      c.step = 'prueba';
      notify('Prueba generada', `${engine.name} · ${c.result.duration} s`, 'ok');
      render();
      break;
    }
    case 'clone:again': {
      const c = state.clonacion;
      const engine = cloneEngineById(c.engine);
      const random = seeded(`clone-again-${Date.now()}-${c.preset}`);
      const dur = 2.2 + random() * 2.4;
      c.result = { duration: dur.toFixed(2), similarity: Math.round(78 + random() * 17), elapsed: (dur * engine.rtf).toFixed(2), qa: random() > 0.25 ? 'OK' : 'revisar' };
      render();
      break;
    }
    case 'clone:preview':
      notify('Reproduciendo', 'La toma se reproduce en el reproductor del prototipo', 'info');
      break;
    case 'clone:save': {
      const c = state.clonacion;
      if (!c.result) break;
      const engine = cloneEngineById(c.engine);
      c.saved.push({
        name: `Clon ${c.saved.length + 1} (${c.transcript.split(/\s+/).slice(0, 2).join(' ') || 'sin nombre'})`,
        engine: engine.name,
        seconds: c.result.duration,
      });
      notify('Voz guardada', 'Aparece en Voces con su consentimiento y procedencia', 'ok');
      render();
      break;
    }
    case 'diseno:engine':
      state.diseno.engine = target.dataset.engine;
      state.diseno.generated = null;
      render();
      break;
    case 'diseno:mode':
      state.diseno.mode = target.dataset.mode;
      state.diseno.generated = null;
      render();
      break;
    case 'diseno:prompt-mode':
      state.diseno.promptMode = target.dataset.mode;
      state.diseno.libraryPage = 0;
      render();
      break;
    case 'diseno:prompt-version':
      state.promptVersion = target.dataset.version;
      notify(
        state.promptVersion === 'v2' ? 'Version mejorada' : 'Version original',
        state.promptVersion === 'v2'
          ? `${PROMPT_V2_STATS.mejorados} prompts completados con emocion, grabacion y proposito`
          : 'El texto auditado, sin cambios',
        'ok',
      );
      render();
      break;
    case 'diseno:use-prompt': {
      const prompt = PROMPT_LIBRARY.find((item) => item.id === target.dataset.prompt);
      if (prompt) {
        // Con la version mejorada se aplica el texto completado; el original queda intacto.
        const usaV2 = state.promptVersion !== 'v1';
        const v2 = PROMPT_LIBRARY_V2.find((item) => item.id === prompt.id);
        state.diseno.prompt = usaV2 && v2 && v2.improved ? v2.improved : prompt.text;
        state.diseno.mode = prompt.mode;
        if (prompt.mode === 'instruct_tts') state.diseno.engine = 'cosyvoice';
        notify(
          'Prompt cargado',
          usaV2 && v2 && v2.improved !== prompt.text ? `${prompt.id} · version mejorada (+${v2.improved.length - prompt.text.length} car.)` : `${prompt.id} · ${prompt.familyLabel}`,
          'ok',
        );
        render();
      }
      break;
    }
    case 'diseno:prompt-page':
      state.diseno.libraryPage = Number(target.dataset.page) || 0;
      render();
      break;
    case 'diseno:reset-search':
      state.diseno.query = '';
      state.diseno.family = 'todas';
      state.diseno.promptMode = 'todos';
      state.diseno.libraryPage = 0;
      render();
      break;
    case 'diseno:enhance':
      enhancePrompt();
      break;
    case 'diseno:apply-improved':
      if (state.diseno.improved) {
        state.diseno.prompt = state.diseno.improved;
        render();
      }
      break;
    case 'diseno:random': {
      const random = seeded(`random-${state.diseno.seed}-${state.diseno.prompt.length}`);
      const prompt = PROMPT_LIBRARY[Math.floor(random() * PROMPT_LIBRARY.length)];
      state.diseno.prompt = prompt.text;
      state.diseno.mode = prompt.mode;
      if (prompt.mode === 'instruct_tts') state.diseno.engine = 'cosyvoice';
      render();
      break;
    }
    case 'diseno:clear-prompt':
      state.diseno.prompt = '';
      state.diseno.improved = '';
      render();
      break;
    case 'diseno:generate':
      disenoGenerate();
      break;
    case 'diseno:regenerate':
      state.diseno.seed = Math.floor(seeded(`seed-${state.diseno.seed}`)() * 99999999);
      disenoGenerate();
      break;
    case 'diseno:save':
      notify('Voz guardada', 'Disponible en Voces con su procedencia y consentimiento', 'ok');
      break;
    case 'diseno:to-elenco':
      if (state.diseno.generated) {
        assignCast(state.diseno.generated.voiceId, state.castRole || 'personaje_1');
      }
      break;
    case 'diseno:reference':
      state.diseno.reference = { name: 'referencia_elena_9s.wav', seconds: 9.2 };
      notify('Referencia cargada', '9,2 s · transcripcion verificada', 'ok');
      render();
      break;

    /* ------------------------------ otros ------------------------------- */
    case 'resume-queue':
      runQueue();
      break;
    default:
      break;
  }
});

/* ------------------------------- formularios ------------------------------ */
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.dataset && target.dataset.action === 'qwen:field') {
    // El select de la matriz se maneja con change, no con click.
    const campo = target.dataset.field;
    const valor = String(target.value).trim();
    state.qwen.profile = {
      ...state.qwen.profile,
      [campo]: valor === '' ? null : campo === 'age' ? Number(valor) : valor,
    };
    syncQwenCompiled();
    return;
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (action === 'lectura:text') {
    state.lectura.text = target.value;
    syncLecturaMeta();
    return;
  }
  if (action === 'diseno:prompt') {
    state.diseno.prompt = target.value;
    const badge = $('#design-prompt') ? $('#design-prompt').closest('.panel').querySelector('.panel-head .badge') : null;
    if (badge) badge.textContent = `${state.diseno.prompt.length} / 1500`;
    return;
  }
  if (action === 'diseno:sample') {
    state.diseno.sample = target.value;
    return;
  }
  if (action === 'qwen:description') {
    state.qwen.description = target.value;
    return;
  }
  if (action === 'qwen:speech') {
    state.qwen.speech = target.value;
    // Solo se repinta el contador y el boton: reemplazar el panel perderia el foco.
    const contador = $('#qwen-speech-count');
    if (contador) contador.textContent = `${target.value.length} / ${QWEN_MAX_TEXT} caracteres`;
    const boton = $('[data-action="qwen:generate"]');
    if (boton) boton.disabled = target.value.length > QWEN_MAX_TEXT || !target.value.trim();
    return;
  }
  if (action === 'qwen:title') {
    state.qwen.title = target.value;
    return;
  }
  if (action === 'qwen:field') {
    const campo = target.dataset.field;
    const valor = target.value.trim();
    state.qwen.profile = {
      ...state.qwen.profile,
      [campo]: valor === '' ? null : campo === 'age' ? Number(valor) : valor,
    };
    syncQwenCompiled();
    return;
  }
  if (action === 'clone:transcript') {
    state.clonacion.transcript = target.value;
    // El badge de validez vive en la cabecera; el textarea no se repinta.
    const panel = $('#clone-transcript') ? $('#clone-transcript').closest('.panel') : null;
    const badge = panel ? panel.querySelector('.panel-head .badge') : null;
    if (badge) {
      const evalRef = evaluateReference({ ...(state.clonacion.reference || {}), transcript: target.value }, state.clonacion.engine);
      badge.className = `badge ${evalRef.nivel === 'ok' ? 'ok' : evalRef.nivel === 'error' ? 'danger' : 'warn'}`;
      badge.textContent = evalRef.nivel === 'ok' ? 'referencia valida' : evalRef.nivel === 'error' ? 'referencia incompleta' : 'revisar avisos';
    }
    return;
  }
  if (action === 'diseno:query') {
    state.diseno.query = target.value;
    state.diseno.libraryPage = 0;
    // Solo se repinta el resultado: reemplazar el panel destruiria este mismo input.
    const results = $('#prompt-results');
    if (results) results.innerHTML = disenoResultsHtml();
    return;
  }
  if (action === 'diseno:clone-text') {
    state.diseno.clonePromptText = target.value;
    return;
  }
  if (action === 'voices:search') {
    state.search = target.value;
    state.voicePage = 0;
    const grid = $('.grid-cards');
    const list = CATALOG.filter((voice) => !state.search || `${voice.name} ${voice.engine} ${voice.region} ${voice.tags.join(' ')}`.toLowerCase().includes(state.search.toLowerCase()));
    const info = paginate(list, 0, 12);
    if (grid) grid.innerHTML = info.slice.map((voice) => voiceCard(voice)).join('');
    return;
  }
  if (action === 'palette:query') {
    state.palette.query = target.value;
    const list = $('.palette-list');
    if (list) {
      list.innerHTML = paletteItems(state.palette.query)
        .map(
          (item, index) => `<button class="palette-item ${index === 0 ? 'active' : ''}" data-action="palette:run" data-id="${item.id}">
            ${icon(item.icon, 'sm')}<span class="grow truncate">${esc(item.label)}</span><em class="tiny dim">${esc(item.hint)}</em>
          </button>`,
        )
        .join('');
    }
    return;
  }
  if (action === 'project:name') {
    state.nuevoProyecto.name = target.value;
    return;
  }
  if (action === 'diseno:seed') {
    state.diseno.seed = Number(target.value) || 0;
    return;
  }
  if (action === 'diseno:topp') {
    state.diseno.topP = Math.min(1, Math.max(0.5, Number(target.value) || 0.9));
    return;
  }
  if (action === 'diseno:style') {
    state.diseno.style = target.value;
    return;
  }
  if (action === 'diseno:tokens') {
    state.diseno.maxTokens = Number(target.value) || 2048;
    return;
  }
  if (target.id === 'block-text') {
    const block = findBlock(target.dataset.block);
    if (block) {
      block.text = target.value;
      const changedState = block.state !== 'pendiente';
      block.state = 'pendiente';
      paintProduceCounters();
      const row = $(`[data-block-row="${block.id}"] .block-text`);
      if (row) row.textContent = block.text;
      if (changedState) {
        const badge = $(`[data-block-row="${block.id}"] .badge`);
        if (badge) {
          badge.textContent = 'pendiente';
          badge.className = 'badge';
        }
        $(`[data-block-row="${block.id}"]`)?.setAttribute('data-state', 'pendiente');
      }
    }
  }
});

// Los <select> y las casillas emiten `change`, no `click`: si se enchufan al click
// nunca se enteran. Todo formulario se resuelve aqui, con el valor ya actualizado.
document.addEventListener('change', (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (!action) return;
  const value = target.value;

  switch (action) {
    case 'theme:set':
      state.theme = value;
      savePrefs();
      render();
      break;
    case 'project:switch':
      state.projectId = value;
      state.docId = project().docs[0]?.id || '';
      state.blockId = allBlocks()[0]?.id || '';
      render();
      break;
    case 'ajustes:provider':
      state.ajustes.provider = value;
      notify('Proveedor cambiado', value, 'ok');
      render();
      break;
    case 'lectura:engine': {
      state.lectura.engine = value;
      const voices = CATALOG.filter((voice) => voice.engine === value);
      state.lectura.voice = voices[0]?.id || '';
      render();
      break;
    }
    case 'lectura:voice':
      state.lectura.voice = value;
      render();
      break;
    case 'lectura:emotion':
      state.lectura.emotion = value;
      render();
      break;
    case 'diseno:family':
      state.diseno.family = value;
      state.diseno.libraryPage = 0;
      render();
      break;
    case 'diseno:gender':
      state.diseno.gender = value;
      break;
    case 'diseno:age':
      state.diseno.age = value;
      break;
    case 'diseno:accent':
      state.diseno.accent = value;
      break;
    case 'diseno:timbre':
      state.diseno.timbre = value;
      break;
    case 'diseno:style':
      state.diseno.style = value;
      break;
    case 'diseno:emotion':
      state.diseno.emotion = value;
      break;
    case 'project:recipe':
      state.nuevoProyecto.recipeId = value;
      break;
    case 'project:license':
      state.nuevoProyecto.license = value;
      break;
    case 'grabar:consent':
      state.grabacion.consent = target.checked;
      break;
    default:
      break;
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.type !== 'range') return;
  const key = target.dataset.key;
  if (!key) return;
  const value = Number(target.value);
  const out = document.querySelector(`[data-range-out="${key}"]`);
  const formats = {
    'read-speed': (v) => `${v.toFixed(2)}x`,
    'read-pause': (v) => `${Math.round(v)} ms`,
    'read-chunk': (v) => `${Math.round(v)} caracteres`,
    'qwen-temp': (v) => v.toFixed(2),
    'qwen-topp': (v) => v.toFixed(2),
    'cosy-k': (v) => String(Math.round(v)),
    'cosy-gain': (v) => `${v.toFixed(2)}x`,
    'cosy-speed': (v) => `${v.toFixed(2)}x`,
    'font-scale': (v) => `${Math.round(v * 100)} %`,
    threads: (v) => String(Math.round(v)),
    vram: (v) => `${Math.round(v)} GB`,
  };
  if (out && formats[key]) out.textContent = formats[key](value);
  if (key === 'font-scale') {
    state.fontScale = value;
    const shell = $('#app');
    if (shell) shell.dataset.fontScale = String(value);
    savePrefs();
  }
  if (key === 'threads') state.ajustes.threads = value;
  if (key === 'vram') state.ajustes.vram = value;
  if (key === 'cosy-k') state.diseno.samplingK = value;
  if (key === 'cosy-gain') state.diseno.gain = value;
  if (key === 'cosy-speed') state.diseno.speed = value;
  if (key === 'qwen-temp') state.diseno.temperature = value;
  if (key === 'qwen-topp') state.diseno.topP = value;
  if (key === 'read-speed') {
    state.lectura.speed = value;
    syncLecturaMeta();
  }
  if (key === 'read-pause') state.lectura.pause = value;
  if (key === 'read-chunk') {
    state.lectura.chunk = value;
    syncLecturaMeta();
  }
});

document.addEventListener('keydown', (event) => {
  const tag = (event.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    state.palette = { open: true, query: '', active: 0 };
    openModal({ type: 'palette' });
    return;
  }
  if (event.key === 'Escape') {
    if (state.modals.length) {
      closeModal();
      return;
    }
    if (state.splash === 'visible') {
      closeSplash();
      return;
    }
  }
  if (typing) return;
  if (event.key === 'j' || event.key === 'k') {
    const doc = currentDoc();
    if (!doc) return;
    const index = doc.blocks.findIndex((block) => block.id === state.blockId);
    const next = event.key === 'j' ? Math.min(doc.blocks.length - 1, index + 1) : Math.max(0, index - 1);
    if (doc.blocks[next]) selectBlock(doc.blocks[next].id);
  }
  if (event.key === ' ') {
    event.preventDefault();
    if (state.player.playing) {
      stopPlayer();
      paintPlayer();
    } else {
      startPlayer(state.blockId);
    }
  }
  if (event.key === 'Enter') approveBlock(state.blockId);
  if (event.key === 'r' || event.key === 'R') renderBlock(state.blockId);
});

/* --------------------------- helpers sin repintar ------------------------- */
function disenoResultsHtml() {
  const d = state.diseno;
  const filtered = searchPrompts(d.query, d.family, d.promptMode);
  const info = paginate(filtered, d.libraryPage, 8);
  const filtrado = Boolean(d.query) || d.family !== 'todas' || d.promptMode !== 'todos';
  return `
    <div class="row between wrap">
      <p class="tiny dim">Mostrando ${esc(disenoPromptFamilyLabel())} · pagina ${info.page + 1} de ${info.total} · ${info.count} resultados</p>
      ${filtrado ? `<button class="btn sm" data-action="diseno:reset-search">${icon('x', 'sm')} Limpiar filtros</button>` : ''}
    </div>
    ${
      info.count === 0
        ? emptyState('Sin resultados', 'Prueba con otro termino o cambia de familia.', `<button class="btn sm" data-action="diseno:reset-search">${icon('refresh', 'sm')} Ver todo</button>`)
        : `<div class="library-list">${info.slice
            .map(
              (item) => `<button class="library-item" data-action="diseno:use-prompt" data-prompt="${item.id}">
                <span class="mode-dot ${item.mode === 'instruct_tts' ? 'instruct' : ''}" aria-hidden="true"></span>
                <div style="min-width:0">
                  <div class="prompt-text">${esc(item.text)}</div>
                  <div class="prompt-meta"><span>${esc(item.id)}</span><span>${esc(item.familyLabel)}</span><span>${item.mode === 'instruct_tts' ? 'instruct' : 'design'}</span></div>
                </div>
                <span class="btn sm icon-only" aria-hidden="true">${icon('arrow', 'sm')}</span>
              </button>`,
            )
            .join('')}</div>`
    }
    ${pager('prompt-library', info, 'diseno:prompt-page')}`;
}

function paintProduceCounters() {
  const stats = projectStats();
  const doc = currentDoc();
  $$('[data-produce-count]').forEach((node) => {
    node.textContent = String(stats.review);
  });
  const head = $('.produce-head .tiny.muted');
  if (head && doc) {
    head.innerHTML = `<span>${doc.blocks.length} bloques</span><span>·</span><span>${doc.blocks.filter((b) => b.state === 'aprobado').length} aprobados</span><span>·</span><span>${doc.blocks.filter((b) => b.state === 'revisar').length} por revisar</span>`;
  }
}

function paintBlocks(job) {
  $$('[data-block-row]').forEach((node) => {
    const block = findBlock(node.dataset.blockRow);
    if (block) node.outerHTML = blockRowHtml(block);
  });
}

/* -------------------------------- paleta run ------------------------------ */
function runPaletteItem(id) {
  const [kind, value] = id.split(':');
  if (kind === 'nav') {
    navigate(value);
  } else if (kind === 'act') {
    if (value === 'render') {
      enqueueRender(currentDoc(), state.mode, null);
      navigate('produce');
    } else if (value === 'export') {
      openModal({ type: 'export' });
    } else if (value === 'import') {
      openModal({ type: 'import' });
    } else if (value === 'grabar') {
      state.modals = [];
      openModal({ type: 'grabar' });
    } else if (value === 'lectura') {
      navigate('lectura');
    } else if (value === 'diseno') {
      navigate('diseno');
    } else if (value === 'theme-amoled') {
      state.theme = 'amoled';
      applyTheme();
      savePrefs();
      navigate('ajustes');
    } else if (value === 'splash') {
      state.modals = [];
      state.splash = 'visible';
      render();
    } else if (value === 'new') {
      openModal({ type: 'project' });
    }
  } else if (kind === 'block') {
    state.blockId = value;
    navigate('produce');
    selectBlock(value);
  } else if (kind === 'voice') {
    notify('Voz seleccionada', `${voiceLabel(value)} · lista para asignar en el elenco`, 'ok');
    navigate('voces');
  }
}

/* ---------------------------------- boot ---------------------------------- */
function tickSystem() {
  system.gpu = clamp(system.gpu + (Math.random() * 6 - 3), 12, 96);
  system.ramUsed = clamp(system.ramUsed + (Math.random() * 0.4 - 0.2), 9, 28);
  system.vramUsed = clamp(system.vramUsed + (Math.random() * 0.3 - 0.15), 1, 24);
  const health = $('.health');
  if (health) health.outerHTML = healthCard();
  const pill = $('.sys-pill');
  if (pill) pill.innerHTML = `<i class="dot"></i>${esc(system.provider)} <span class="dim">·</span> ${esc(engineById(system.engine).name)}`;
}

function tickClock() {
  if (state.route !== 'inicio') return;
  const greet = $('.greeting .greet-line');
  if (!greet) return;
  const g = greetingParts();
  greet.innerHTML = `<span>${icon('clock', 'sm')}<b>${esc(g.time)}</b> · hora local (UTC${g.utcOffset})</span>
    <span>${icon('info', 'sm')}<b>${esc(g.date)}</b></span>
    <span>${icon('target', 'sm')}<b>${esc(g.place)}</b></span>`;
}

state.blockId = currentDoc()?.blocks.find((block) => block.state === 'revisar')?.id || currentDoc()?.blocks[0]?.id || state.blockId;
state.castRole = 'narrador';

// Bandejas: arrastre con raton y dedo, rueda y teclado, una sola vez para toda la app.
attachTrayDrag(document);

applyTheme();
// Primer arranque de esta version: se abre el modulo nuevo para que se vea.
try {
  if (!localStorage.getItem(`${STORE_KEY}-visto-qwen`)) {
    localStorage.setItem(`${STORE_KEY}-visto-qwen`, '1');
    state.route = 'qwen';
  }
} catch {
  /* sin localStorage (iframe sandboxeado): se abre en Inicio */
}
render();
setInterval(tickSystem, 4200);
setInterval(tickClock, 30000);

// Hooks de verificacion (sin efecto en el navegador).
export { state as __state, render as __render, navigate as __navigate, CATALOG as __catalog };
