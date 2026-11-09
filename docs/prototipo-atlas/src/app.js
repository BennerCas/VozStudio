// VozStudio Atlas - prototipo navegable (sin build, sin dependencias, sin red).
// Modelo: proyecto > documento > bloque > toma. Estado en memoria + localStorage (tema).

import {
  ICONS,
  ENGINES,
  engineById,
  RECIPES,
  recipeById,
  ROLES,
  PROJECTS,
  projectById,
  VOICES,
  voiceById,
  CLIENT_PRESETS,
  GLOSSARY,
  BATCH_JOB,
  INITIAL_JOBS,
} from './data.js';

/* --------------------------------- helpers -------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.wave}</svg>`;

const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

function fmtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}

function fmtDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const TITLES = {
  inicio: 'Inicio',
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

/* --------------------------------- ledger --------------------------------- */
const STORE_KEY = 'atlas-prototipo';
const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
})();

const system = {
  provider: 'DirectML',
  gpu: 41,
  ramUsed: 12.4,
  ramTotal: 32,
  vramUsed: 6.2,
  vramLimit: 25,
  engine: 'kokoro',
  jobs: 0,
  phi: { available: true, device: 'DirectML' },
};

const state = {
  route: 'produce',
  theme: stored.theme || 'omni',
  projectId: 'patagonia',
  docId: '07',
  blockId: '07-004',
  mode: 'final',
  search: '',
  voiceFilter: 'todas',
  recipeFilter: 'todas',
  inspectorTab: 'bloque',
  jobs: INITIAL_JOBS.map((job) => ({ ...job })),
  queueRunning: false,
  queueTimer: null,
  modals: [],
  palette: { open: false, query: '', active: 0 },
  toasts: [],
  player: { blockId: null, playing: false, pos: 0, dur: 0, vol: 0.8, muted: false, timer: null },
  batch: JSON.parse(JSON.stringify(BATCH_JOB)),
  batchRunning: false,
  batchTimer: null,
  nuevoProyecto: { recipeId: 'audiolibro', name: '', license: 'comercial' },
  ajustes: {
    provider: 'DirectML',
    threads: 12,
    vram: 25,
    excludeNC: true,
    consentGate: true,
    phiClean: true,
    phiCast: true,
    phiNotes: false,
    watchfolder: false,
  },
  grabacion: { step: 1, seconds: 0, level: 0, consent: false, name: 'Elena (voz del autor)' },
};

const project = () => projectById(state.projectId);
const currentDoc = () => project().docs.find((doc) => doc.id === state.docId) || project().docs[0] || null;

function allBlocks() {
  return project().docs.flatMap((doc) => doc.blocks);
}
function findBlock(id) {
  return allBlocks().find((block) => block.id === id) || null;
}
function blockOf(id) {
  return findBlock(id) || allBlocks()[0] || null;
}
function chosenTake(block) {
  return block?.takes.find((take) => take.id === block.chosenTakeId) || block?.takes[0] || null;
}
function projectStats(p = project()) {
  const blocks = p.docs.flatMap((doc) => doc.blocks);
  const total = blocks.length;
  const approved = blocks.filter((b) => b.state === 'aprobado').length;
  const review = blocks.filter((b) => b.state === 'revisar').length;
  const pending = blocks.filter((b) => b.state === 'pendiente').length;
  const duration = blocks.reduce((acc, b) => acc + (chosenTake(b)?.duration || 0), 0);
  const chars = blocks.reduce((acc, b) => acc + b.text.length, 0);
  return { total, approved, review, pending, duration, chars, docs: p.docs.length };
}
function docStats(doc) {
  const total = doc.blocks.length;
  const approved = doc.blocks.filter((b) => b.state === 'aprobado').length;
  const review = doc.blocks.filter((b) => b.state === 'revisar').length;
  const duration = doc.blocks.reduce((acc, b) => acc + (chosenTake(b)?.duration || 0), 0);
  const chars = doc.blocks.reduce((acc, b) => acc + b.text.length, 0);
  return { total, approved, review, duration, chars };
}
function estimateRender(chars, engineId = 'piper') {
  const engine = engineById(engineId) || ENGINES[0];
  const audioSeconds = chars / 15.2;
  return { audio: audioSeconds, seconds: audioSeconds * engine.rtf, engine };
}
function licenseForRole(project0, recipe) {
  const cast = project0.cast || [];
  const problems = cast
    .map((slot) => ({ slot, voice: voiceById(slot.voiceId) }))
    .filter(({ voice }) => voice && !engineById(voice.engine).commercial);
  return { ok: problems.length === 0, problems, commercial: recipe.commercial && project0.license === 'comercial' };
}
function roleMeta(roleId) {
  return ROLES.find((r) => r.id === roleId) || ROLES[0];
}
function voiceLabel(id) {
  const voice = voiceById(id);
  if (!voice) return 'Sin asignar';
  return voice.name;
}

/* --------------------------------- toasts --------------------------------- */
let toastSeq = 0;
function notify(title, detail = '', kind = 'ok') {
  const id = `t${++toastSeq}`;
  state.toasts.push({ id, title, detail, kind });
  renderToasts();
  setTimeout(() => {
    state.toasts = state.toasts.filter((toast) => toast.id !== id);
    renderToasts();
  }, 4200);
}
function renderToasts() {
  const host = $('#toasts');
  if (!host) return;
  host.innerHTML = state.toasts
    .map(
      (toast) => `<div class="toast ${toast.kind}" role="status">
        ${icon(toast.kind === 'ok' ? 'check' : toast.kind === 'warn' ? 'alert' : 'info')}
        <div><b>${esc(toast.title)}</b>${toast.detail ? `<span class="tiny dim">${esc(toast.detail)}</span>` : ''}</div>
        <button data-action="toast:close" data-id="${toast.id}" aria-label="Cerrar aviso">${icon('x', 'sm')}</button>
      </div>`,
    )
    .join('');
}

/* --------------------------------- player --------------------------------- */
const WAVE_BARS = 46;
function waveBars(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  const bars = [];
  for (let i = 0; i < WAVE_BARS; i += 1) {
    s = (s * 9301 + 49297) % 233280;
    const base = 0.25 + (s / 233280) * 0.75;
    const envelope = Math.sin((i / WAVE_BARS) * Math.PI) * 0.5 + 0.6;
    bars.push(clamp(base * envelope, 0.12, 1));
  }
  return bars;
}
function playerBlock() {
  return state.player.blockId ? findBlock(state.player.blockId) : null;
}
function startPlayer(blockId) {
  const block = findBlock(blockId);
  if (!block) return;
  const take = chosenTake(block);
  if (!take) return;
  const same = state.player.blockId === blockId;
  if (same && state.player.playing) {
    stopPlayer();
    return;
  }
  clearInterval(state.player.timer);
  state.player.blockId = blockId;
  state.player.pos = 0;
  state.player.dur = take.duration;
  state.player.playing = true;
  state.player.timer = setInterval(() => {
    state.player.pos += 0.1;
    if (state.player.pos >= state.player.dur) {
      stopPlayer();
      return;
    }
    paintPlayer();
  }, 100);
  paintPlayer();
  render();
}
function stopPlayer() {
  clearInterval(state.player.timer);
  state.player.playing = false;
  paintPlayer();
}
function paintPlayer() {
  const wave = $('#wave');
  if (wave) {
    const ratio = state.player.dur > 0 ? state.player.pos / state.player.dur : 0;
    const limit = Math.round(WAVE_BARS * ratio);
    $$('span', wave).forEach((bar, index) => bar.classList.toggle('on', index < limit));
  }
  const time = $('#play-time');
  if (time) time.textContent = `${fmtTime(state.player.pos)} / ${fmtTime(state.player.dur)}`;
  const btn = $('#play-btn');
  if (btn) btn.innerHTML = state.player.playing ? icon('pause') : icon('play');

}

/* ---------------------------------- queue --------------------------------- */
function queueTotal() {
  return state.jobs.reduce((acc, job) => acc + job.total, 0);
}
function queueDone() {
  return state.jobs.reduce((acc, job) => acc + job.progress, 0);
}
function queueActive() {
  return state.jobs.find((job) => job.state === 'ejecutando' || job.state === 'pendiente') || null;
}
function enqueueRender(doc, mode, blocks) {
  const engineId = mode === 'borrador' ? recipeById(project().recipeId).draft : recipeById(project().recipeId).engine;
  const chars = blocks.reduce((acc, b) => acc + b.text.length, 0);
  const estimate = estimateRender(chars, engineId);
  const job = {
    id: `job-${Date.now()}`,
    kind: 'render',
    title: `${doc.title.split(' - ')[0]} · ${blocks.length} bloques`,
    detail: `${engineById(engineId).name} · ${mode} · ~${fmtDuration(estimate.seconds)}`,
    state: 'pendiente',
    progress: 0,
    total: blocks.length,
    eta: fmtDuration(estimate.seconds),
    docId: doc.id,
    mode,
    blockIds: blocks.map((b) => b.id),
  };
  state.jobs.push(job);
  system.jobs = state.jobs.length;
  notify('Trabajo en cola', `${job.title} · ${job.detail}`, 'ok');
  runQueue();
}
function runQueue() {
  if (state.queueRunning) return;
  state.queueRunning = true;
  clearInterval(state.queueTimer);
  state.queueTimer = setInterval(() => {
    const job = state.jobs.find((item) => item.state === 'ejecutando') || state.jobs.find((item) => item.state === 'pendiente');
    if (!job) {
      state.queueRunning = false;
      clearInterval(state.queueTimer);
      renderQueue();
      return;
    }
    job.state = 'ejecutando';
    job.progress = Math.min(job.total, job.progress + Math.ceil(job.total / 22));
    if (job.progress >= job.total) {
      job.state = 'listo';
      job.progress = job.total;
      applyJobResult(job);
      notify('Render completado', `${job.title} · listo para revisar`, 'ok');
      paintProduceCounters();
      paintBlocks(job);
    }
    renderQueue();
  }, 260);
  renderQueue();
}
function applyJobResult(job) {
  // El prototipo marca los bloques renderizados como revisables/aprobados.
  if (!job.blockIds) return;
  job.blockIds.forEach((id, index) => {
    const block = findBlock(id);
    if (!block) return;
    const take = {
      id: `${id}-t${block.takes.length + 1}`,
      engine: job.mode === 'borrador' ? recipeById(project().recipeId).draft : engineById(recipeById(project().recipeId).engine).id,
      voice: 'em_alex',
      speed: 0.96,
      duration: Math.max(0.9, Math.round((block.text.length / 15.2) * 100) / 100),
      sr: 24000,
      rtf: 0.06,
      createdAt: 'ahora',
      qa: index % 11 === 3 ? 2 : 1,
    };
    block.takes.push(take);
    block.chosenTakeId = take.id;
    block.state = take.qa === 2 ? 'revisar' : 'aprobado';
  });
}
function renderQueue() {
  const strip = $('#queue-slot');
  if (strip) strip.innerHTML = queueStripHtml();
  const badge = $('#nav-queue');
  if (badge) badge.textContent = state.jobs.filter((j) => j.state !== 'listo').length || '';
  const sysQueue = $('#sys-queue');
  if (sysQueue) sysQueue.textContent = String(state.jobs.filter((j) => j.state !== 'listo').length);
}
function queueStripHtml() {
  const active = queueActive();
  const total = queueTotal();
  const done = queueDone();
  return `<div class="queue-strip">
    <div class="queue-now">
      <span class="dot ${state.queueRunning ? 'warn' : 'idle'}"></span>
      <div class="grow">
        <strong>${active ? esc(active.title) : state.jobs.length ? 'Cola al día' : 'Sin trabajos en cola'}</strong>
        <small>${active ? `${esc(active.detail)} · ${active.progress}/${active.total} bloques · ETA ${esc(active.eta)}` : 'Los renders agrupados por motor evitan recargar pesos'}</small>
      </div>
    </div>
    <div class="queue-bar">
      <div class="bar"><i style="width:${pct(done, total || 1)}%"></i></div>
      <span class="mono">${done}/${total || 0}</span>
    </div>
    <div class="row">
      <button class="btn sm ghost" data-action="queue:detail">${icon('list', 'sm')} Ver cola</button>
      <button class="btn sm" data-action="queue:toggle">${state.queueRunning ? icon('pause', 'sm') : icon('play', 'sm')}${state.queueRunning ? 'Pausar' : 'Reanudar'}</button>
    </div>
  </div>`;
}

/* ---------------------------------- paint --------------------------------- */
function paintProduceCounters() {
  const stats = projectStats();
  const head = $('#doc-counters');
  if (head) {
    head.innerHTML = `<b>${stats.total}</b> bloques · <b class="ok">${stats.approved}</b> aprobados ·
      <b class="warn">${stats.review}</b> revisar · ${fmtDuration(stats.duration)}`;
  }
  const docProg = $('#doc-progress');
  if (docProg) docProg.style.width = `${pct(stats.approved, stats.total || 1)}%`;
}
function paintBlocks(job) {
  // Refresca solo los bloques afectados por un trabajo para no perder scroll.
  if (!job?.blockIds) return;
  job.blockIds.forEach((id) => {
    const block = findBlock(id);
    const node = $(`[data-block-row="${id}"]`);
    if (!block || !node) return;
    node.outerHTML = blockRowHtml(block);
  });
}

/* -------------------------------- fragments ------------------------------- */
function themeOptions() {
  return [
    ['omni', 'Omni Cyan'],
    ['grafito', 'Grafito'],
    ['ambar', 'Ambar Studio'],
    ['claro', 'Pearl Light'],
  ]
    .map(([id, label]) => `<option value="${id}"${state.theme === id ? ' selected' : ''}>${label}</option>`)
    .join('');
}

function healthCard() {
  const jobs = state.jobs.filter((job) => job.state !== 'listo').length;
  const gpu = system.gpu;
  return `<div class="health">
    <header><span><i class="dot"></i> Sistema local</span><strong>Estable</strong></header>
    <div class="health-row"><span>Proveedor</span><b>${esc(system.provider)}</b></div>
    <div class="health-row"><span>Motor activo</span><b>${esc(engineById(system.engine).name)}</b></div>
    <div class="health-row"><span>GPU</span><b>${gpu} %</b></div>
    <div class="meter ${gpu > 85 ? 'warn' : ''}"><i style="width:${gpu}%"></i></div>
    <div class="health-row"><span>RAM</span><b>${system.ramUsed.toFixed(1)} / ${system.ramTotal} GB</b></div>
    <div class="meter"><i style="width:${Math.round((system.ramUsed / system.ramTotal) * 100)}%"></i></div>
    <div class="health-row"><span>VRAM</span><b>${system.vramUsed.toFixed(1)} / ${system.vramLimit} GB</b></div>
    <div class="meter"><i style="width:${Math.round((system.vramUsed / system.vramLimit) * 100)}%"></i></div>
    <div class="health-row"><span>Cola</span><b id="sys-queue">${jobs}</b></div>
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
      <span class="brand-mark">${icon('wave', 'lg')}</span>
      <div class="brand-text"><strong>VozStudio</strong><span>Atlas · local</span></div>
    </div>
    <nav class="nav" aria-label="Navegacion principal">
      <span class="nav-label">Trabajo</span>
      ${navItem('inicio', 'home', 'Inicio')}
      ${navItem('produce', 'grid', 'Producir', stats.total ? String(stats.review || '') : '')}
      ${navItem('biblioteca', 'folder', 'Biblioteca')}
      <span class="nav-label">Recursos</span>
      ${navItem('voces', 'mic', 'Voces', String(VOICES.length))}
      ${navItem('recetas', 'sliders', 'Recetas', String(RECIPES.length))}
      ${navItem('elenco', 'users', 'Elenco')}
      ${navItem('presets', 'star', 'Presets de cliente')}
      ${navItem('glosario', 'file', 'Glosario')}
      <span class="nav-label">Automatizar</span>
      ${navItem('lotes', 'layers', 'Lotes')}
      ${navItem('cola', 'terminal', 'CLI y carpetas', pending ? String(pending) : '')}
      <span class="nav-label">Sistema</span>
      ${navItem('ajustes', 'settings', 'Ajustes')}
    </nav>
    <div class="sidebar-foot">
      ${healthCard()}
      <div class="side-profile">
        <span class="avatar">BC</span>
        <div><strong>Benner Castillo</strong><small>Proyecto local</small></div>
        <span style="margin-left:auto;color:var(--text-4)">${icon('lock', 'sm')}</span>
      </div>
    </div>
  </aside>`;
}

function topbarHtml() {
  const crumbs =
    state.route === 'produce'
      ? `<span>${esc(project().name)}</span>${icon('chevron', 'sm')}<b>${esc(currentDoc() ? currentDoc().title.split(' - ')[0] : 'Sin documento')}</b>`
      : state.route === 'elenco' || state.route === 'presets'
        ? `<span>${esc(project().name)}</span>${icon('chevron', 'sm')}<b>${TITLES[state.route]}</b>`
        : `<b>${TITLES[state.route] || 'Inicio'}</b>`;
  return `<header class="topbar">
    <div class="crumbs">${crumbs}</div>
    <div class="topbar-right">
      <label class="sr-only" for="project-select">Proyecto</label>
      <select id="project-select" class="select" data-action="project:switch" style="width:auto;height:34px" title="Cambiar de proyecto">
        ${PROJECTS.map((item) => `<option value="${item.id}" ${item.id === state.projectId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
      </select>
      <button class="search" data-action="palette:open" aria-label="Buscar o ejecutar un comando">
        ${icon('search', 'sm')}<span>Buscar voces, bloques, comandos</span><kbd>Ctrl K</kbd>
      </button>
      <span class="sys-pill" title="Datos reales del backend">
        <i class="dot"></i>${esc(system.provider)} <span class="dim">·</span> ${esc(engineById(system.engine).name)}
      </span>
      <label class="sr-only" for="theme-select">Tema</label>
      <select id="theme-select" class="select" data-action="theme:set" style="width:auto;height:34px">${themeOptions()}</select>
      <button class="btn icon-only" data-action="help" aria-label="Ayuda del prototipo">${icon('info')}</button>
    </div>
  </header>`;
}

/* ---------------------------------- views --------------------------------- */
function statCard(label, value, detail, tone = '') {
  return `<div class="stat ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
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
      <div>
        <h1 style="font-size:var(--text-3xl);letter-spacing:-.02em">Buenos días, Benner</h1>
        <p class="muted tiny mt-2">${PROJECTS.length} proyectos · ${stats.review} bloques necesitan tu escucha · datos reales del backend, no de la plantilla</p>
      </div>
      <div class="row">
        <button class="btn" data-action="nav" data-route="biblioteca">${icon('folder', 'sm')} Biblioteca</button>
        <button class="btn primary" data-action="project:new">${icon('plus', 'sm')} Nuevo proyecto</button>
      </div>
    </div>

    <div class="stat-grid">
      ${statCard('Proyectos activos', PROJECTS.filter((x) => x.docs.length || x.updated !== 'ayer').length, 'de ' + PROJECTS.length + ' en el espacio', 'accent')}
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
          <div class="bar ok"><i style="width:${pct(stats.approved, stats.total || 1)}%"></i></div>
          <div class="row wrap">
            <button class="btn primary" data-action="resume">${icon('play', 'sm')} Retomar producción</button>
            <button class="btn" data-action="queue:render-doc">${icon('refresh', 'sm')} Renderizar pendientes</button>
            <button class="btn" data-action="modal:export">${icon('download', 'sm')} Exportar capitulo</button>
            <span class="grow"></span>
            ${
              license.ok
                ? `<span class="badge ok">${icon('shield', 'sm')} Licencias verificadas</span>`
                : `<span class="badge danger">${icon('alert', 'sm')} ${license.problems.length} voz no comercial</span>`
            }
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Esta semana</p><h2>Rendimiento real</h2></div></div>
        <div class="panel-body tight">
          <table class="table">
            <thead><tr><th>Motor</th><th class="num">RTF</th><th class="num">Audio</th><th class="num">Tiempo</th></tr></thead>
            <tbody>
              ${ENGINES.filter((e) => ['piper', 'kokoro', 'mms'].includes(e.id))
                .map((engine) => {
                  const hours = engine.id === 'piper' ? 2.4 : engine.id === 'kokoro' ? 1.1 : 0.3;
                  return `<tr>
                    <td><span class="license-cell ${engine.commercial ? 'ok' : 'no'}">${engine.commercial ? icon('check', 'sm') : icon('alert', 'sm')}</span> ${esc(engine.name)}</td>
                    <td class="num">${engine.rtf.toFixed(3)}</td>
                    <td class="num">${hours.toFixed(1)} h</td>
                    <td class="num">${fmtDuration((hours * 3600 * engine.rtf))}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
          <p class="tiny dim" style="padding:9px 10px 2px">Un borrador de 8 h de audiolibro tarda ~24 min con Piper; la pasada final con Kokoro, ~2 h 17 min.</p>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div><p class="eyebrow">Espacio de trabajo</p><h2>Proyectos</h2></div>
        <span class="spacer"></span>
        <button class="btn sm ghost" data-action="project:new">${icon('plus', 'sm')} Crear desde receta</button>
      </div>
      <div class="panel-body">
        <div class="grid-cards">
          ${PROJECTS.map((item) => {
            const s = projectStats(item);
            const recipe = recipeById(item.recipeId);
            return `<button class="card interactive" data-action="project:open" data-project="${item.id}">
              <div class="card-top">
                <span class="card-icon" style="--tone:${item.tone}">${icon(recipe.icon)}</span>
                <div class="grow">
                  <h3>${esc(item.name)}</h3>
                  <p class="tiny">${esc(item.subtitle)}</p>
                </div>
                <span class="badge ${item.license === 'comercial' ? 'ok' : 'warn'}">${item.license}</span>
              </div>
              <div class="bar ${s.approved === s.total && s.total ? 'ok' : ''}"><i style="width:${pct(s.approved, s.total || 1)}%"></i></div>
              <div class="row between tiny muted">
                <span>${s.total ? `${s.approved}/${s.total} bloques` : 'sin importar'}</span>
                <span>${s.duration ? fmtDuration(s.duration) : '0 min'}</span>
                <span>${esc(item.updated)}</span>
              </div>
            </button>`;
          }).join('')}
        </div>
      </div>
    </section>
  </div>`;
}

function blockRowHtml(block) {
  const take = chosenTake(block);
  const role = roleMeta(block.role);
  const selected = Boolean(state.blockId && state.blockId === block.id);
  const stateBadge =
    block.state === 'aprobado'
      ? '<span class="badge ok">aprobado</span>'
      : block.state === 'revisar'
        ? '<span class="badge warn">revisar</span>'
        : '<span class="badge">pendiente</span>';
  const playing = state.player.blockId === block.id && state.player.playing;
  return `<article class="block" data-block-row="${block.id}" data-state="${block.state}" ${selected ? 'aria-current="true"' : ''}>
    <div class="block-top">
      <span class="mono">${block.id}</span>
      <span class="role" style="--role:${role.color}"><i></i>${role.label.toUpperCase()}</span>
      ${stateBadge}
      <div class="block-actions">
        <button class="btn sm ghost icon-only" data-action="block:play" data-block="${block.id}" aria-label="Escuchar bloque ${block.id}">${icon(playing ? 'pause' : 'play', 'sm')}</button>
        <button class="btn sm ghost icon-only" data-action="block:select" data-block="${block.id}" aria-label="Abrir bloque ${block.id}">${icon('edit', 'sm')}</button>
      </div>
    </div>
    <button class="block-text" data-action="block:select" data-block="${block.id}" style="text-align:left;background:none;padding:0;color:inherit;font:inherit">${esc(block.text)}</button>
    <div class="block-meta">
      <span>${take ? `${take.duration.toFixed(2)} s` : '--'}</span>
      <span>${take ? engineById(take.engine).name : '--'}</span>
      <span>${block.takes.length} toma${block.takes.length === 1 ? '' : 's'}</span>
      ${block.qaIssue ? `<span style="color:var(--warn)">QA: ${block.qaIssue === 'duracion' ? 'duración atipica' : 'cobertura 92 %'}</span>` : ''}
      <span style="margin-left:auto">${selected ? icon('chevron', 'sm') : ''}</span>
    </div>
  </article>`;
}

function blockEditorHtml(block) {
  const take = chosenTake(block);
  const role = roleMeta(block.role);
  if (!block) return `<div class="empty">${icon('list')}<strong>Sin bloque seleccionado</strong>Elige un bloque de la lista.</div>`;
  const normalized = block.text
    .replace(/\b(\d{1,2})\b/g, (m) => ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][Number(m)] || m);
  return `
    <div class="stack-3">
      <div class="row between">
        <span class="mono muted">${block.id}</span>
        <div class="row">
          <span class="badge" style="border-color:${role.color}55;color:${role.color}">${role.label}</span>
          <span class="badge ${block.state === 'aprobado' ? 'ok' : block.state === 'revisar' ? 'warn' : ''}">${block.state}</span>
        </div>
      </div>
      <textarea class="editor-text" id="block-text" data-block="${block.id}" aria-label="Texto del bloque">${esc(block.text)}</textarea>
      <div class="norm-preview">
        <b>${icon('wand', 'sm')} Se pronunciara así</b>
        ${esc(normalized)}
        <div class="tiny dim mt-2">El normalizador ya existe en el backend (cifras, divisas, horas, siglas). Aquí se muestra antes de generar.</div>
      </div>
      <div class="controls-row">
        <label class="range">
          <span class="range-top">Velocidad <b>${((take?.speed ?? 0.96)).toFixed(2)}x</b></span>
          <input type="range" min="0.5" max="2" step="0.01" value="${take?.speed ?? 0.96}" data-action="block:speed" />
        </label>
        <label class="field">Rol
          <select class="select" data-action="block:role">
            ${ROLES.map((r) => `<option value="${r.id}"${r.id === block.role ? ' selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </label>
        <label class="field">Motor
          <select class="select" data-action="block:engine">
            ${ENGINES.map((e) => `<option value="${e.id}"${e.id === (take?.engine || 'kokoro') ? ' selected' : ''}>${e.name}${e.commercial ? '' : ' (no comercial)'}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="player">
        <div class="player-top">
          <button class="play-btn" id="play-btn" data-action="block:play" data-block="${block.id}" aria-label="Reproducir toma aprobada">
            ${icon(state.player.playing && state.player.blockId === block.id ? 'pause' : 'play')}
          </button>
          <div class="wave" id="wave" data-action="player:seek" role="slider" aria-label="posición de reproducción" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
            ${waveBars(block.takes.length * 37 + block.id.charCodeAt(3))
              .map((value, index) => {
                const ratio = state.player.blockId === block.id && state.player.dur ? state.player.pos / state.player.dur : 0;
                const on = index < Math.round(WAVE_BARS * ratio);
                return `<span class="${on ? 'on' : ''}" style="height:${Math.round(value * 100)}%"></span>`;
              })
              .join('')}
            <i id="wave-cursor" style="display:none"></i>
          </div>
        </div>
        <div class="player-foot">
          <span class="mono" id="play-time">00:00.0 / ${fmtTime(take?.duration || 0)}</span>
          <span class="grow"></span>
          <button class="btn sm ghost icon-only" data-action="player:vol">${icon('mic', 'sm')}</button>
          <input class="vol" type="range" min="0" max="100" value="${Math.round(state.player.vol * 100)}" aria-label="Volumen" data-action="player:vol-set" />
        </div>
      </div>
      <div class="takes">
        <div class="takes-head"><span>Tomas de este bloque</span><span>${block.takes.length}</span></div>
        ${block.takes
          .map(
            (item, index) => `<div class="take" data-chosen="${item.id === block.chosenTakeId}">
              <span class="tag">#${index + 1}</span>
              <span class="truncate">${esc(engineById(item.engine).name)} · ${esc(voiceLabel(item.voice === 'em_alex' ? 'kokoro-em_alex' : item.voice))}</span>
              <span class="meta">${item.duration.toFixed(2)} s · RTF ${item.rtf}</span>
              <span class="badge ${item.qa === 1 ? 'ok' : item.qa === 2 ? 'warn' : 'info'}">${item.qa === 1 ? 'QA ok' : item.qa === 2 ? 'QA revisar' : 'DNA'}</span>
              <button class="btn sm ${item.id === block.chosenTakeId ? 'active' : ''}" data-action="take:choose" data-block="${block.id}" data-take="${item.id}">${item.id === block.chosenTakeId ? 'Elegida' : 'Elegir'}</button>
            </div>`,
          )
          .join('')}
      </div>
      <div class="row wrap">
        <button class="btn primary" data-action="block:approve" data-block="${block.id}">${icon('check', 'sm')} Aprobar</button>
        <button class="btn" data-action="block:render" data-block="${block.id}">${icon('refresh', 'sm')} Regenerar</button>
        <button class="btn" data-action="block:review" data-block="${block.id}">${icon('alert', 'sm')} Marcar revisar</button>
      </div>
    </div>`;
}

function inspectorHtml(block) {
  if (!block) return `<div class="empty">${icon('list')}<strong>Sin bloque seleccionado</strong>Elige un bloque en la lista central.</div>`;
  const take = chosenTake(block);
  const recipe = recipeById(project().recipeId);
  const engine = take ? engineById(take.engine) : engineById(recipe.engine);
  const qaOk = block?.state === 'aprobado';
  const rows = [
    ['Duración vs longitud', `${take ? take.duration.toFixed(2) : '--'} s`, qaOk ? 'ok' : 'warn'],
    ['Cobertura de palabras', qaOk ? '100 %' : '92 %', qaOk ? 'ok' : 'warn'],
    ['Clipping / DC', 'limpio', 'ok'],
    ['Loudness estimado', recipe.lufs, 'ok'],
    ['Bucles o alucinación', 'sin indicios', 'ok'],
    ['Consistencia de voz', qaOk ? 'match 0.94' : 'match 0.81', qaOk ? 'ok' : 'warn'],
    ['RTF del render', take ? String(take.rtf) : '--', 'ok'],
  ];
  return `<div class="editor" style="gap:var(--space-4)">
    <div class="row between">
      <div class="seg" role="tablist" aria-label="Inspector">
        ${[
          ['bloque', 'Bloque'],
          ['qa', 'QA'],
          ['licencia', 'Licencia'],
        ]
          .map(
            ([id, label]) => `<button role="tab" aria-selected="${state.inspectorTab === id}" class="${state.inspectorTab === id ? 'active' : ''}" data-action="inspector:tab" data-tab="${id}">${label}</button>`,
          )
          .join('')}
      </div>
    </div>
    ${
      state.inspectorTab === 'bloque'
        ? blockEditorHtml(block)
        : state.inspectorTab === 'voz'
        ? `<div class="stack-3">
            <dl class="kv">
              <dt>Motor</dt><dd>${esc(engine.name)}</dd>
              <dt>Voz del rol</dt><dd>${esc(voiceLabel(project().cast.find((c) => c.role === block.role)?.voiceId))}</dd>
              <dt>Sample rate</dt><dd>${engine.sr} Hz</dd>
              <dt>Licencia</dt><dd>${esc(engine.license)}</dd>
              <dt>Tomas</dt><dd>${block.takes.length}</dd>
            </dl>
            <hr class="hr" />
            <p class="tiny muted">El condicionamiento de la voz esta bloqueado para el proyecto: el capitulo 12 sonara igual que el 1.</p>
            <button class="btn sm" data-action="nav" data-route="elenco">${icon('users', 'sm')} Abrir elenco</button>
          </div>`
        : state.inspectorTab === 'qa'
          ? `<div class="qa-list">
              ${rows
                .map(
                  ([label, value, kind]) => `<div class="qa-row ${kind}">
                    ${icon(kind === 'ok' ? 'check' : 'alert')}
                    <span>${esc(label)}</span><b>${esc(value)}</b>
                  </div>`,
                )
                .join('')}
            </div>
            <p class="tiny dim">Aprueba por excepción: el semaforo marca solo los bloques que conviene escuchar.</p>`
          : `<div class="stack-3">
              <dl class="kv">
                <dt>Proyecto</dt><dd>${project().license}</dd>
                <dt>Receta</dt><dd>${esc(recipe.name)}</dd>
                <dt>Motor</dt><dd>${esc(engine.name)}</dd>
                <dt>Uso comercial</dt><dd style="color:${engine.commercial ? 'var(--ok)' : 'var(--danger)'}">${engine.commercial ? 'Permitido' : 'No permitido'}</dd>
                <dt>Licencia</dt><dd>${esc(engine.license)}</dd>
              </dl>
              ${
                engine.commercial
                  ? `<span class="badge ok">${icon('shield', 'sm')} Apto para exportación comercial</span>`
                  : `<span class="badge danger">${icon('alert', 'sm')} Bloqueado en exportación comercial</span>`
              }
              <p class="tiny dim">El informe de licencias del proyecto se genera junto a cada exportación.</p>
            </div>`
    }
  </div>`;
}

function viewProduce() {
  const p = project();
  const doc = currentDoc();
  if (!doc) {
    return `<section class="panel"><div class="empty" style="padding:60px 20px">
      ${icon('book')}<strong>Este proyecto todavía no tiene documentos</strong>
      Importa un DOCX, Markdown o SRT para crear bloques automáticamente.
      <button class="btn primary mt-3" data-action="modal:import">${icon('upload', 'sm')} Importar documento</button>
    </div></section>`;
  }
  const stats = projectStats(p);
  const dStats = docStats(doc);
  const recipe = recipeById(p.recipeId);
  const block = blockOf(state.blockId);
  const estimate = estimateRender(dStats.chars, state.mode === 'borrador' ? recipe.draft : recipe.engine);
  const pendingBlocks = doc.blocks.filter((b) => b.state !== 'aprobado');
  const reviewBlocks = doc.blocks.filter((b) => b.state === 'revisar');

  return `
  <section class="panel" style="flex:none">
    <div class="panel-body tight">
      <div class="row wrap" style="gap:var(--space-3)">
        <div class="grow" style="min-width:200px">
          <div class="row" style="gap:8px">
            <h1 style="font-size:var(--text-xl)">${esc(doc.title)}</h1>
            <span class="badge accent">${esc(recipe.name)}</span>
            <span class="badge ${p.license === 'comercial' ? 'ok' : 'warn'}">${p.license}</span>
          </div>
          <p class="tiny muted mt-2" id="doc-counters"><b>${stats.total}</b> bloques · <b class="ok">${stats.approved}</b> aprobados ·
            <b class="warn">${stats.review}</b> revisar · ${fmtDuration(stats.duration)}</p>
        </div>
        <div class="seg" role="group" aria-label="Pasada">
          <button data-action="mode:set" data-mode="borrador" aria-pressed="${state.mode === 'borrador'}">${icon('zap', 'sm')} Borrador · Piper</button>
          <button data-action="mode:set" data-mode="final" aria-pressed="${state.mode === 'final'}">${icon('sparkles', 'sm')} Final · Kokoro</button>
        </div>
        <button class="btn" data-action="modal:import">${icon('upload', 'sm')} Importar</button>
        <button class="btn" data-action="queue:render-review" ${reviewBlocks.length ? '' : 'disabled'}>${icon('alert', 'sm')} Regenerar ${reviewBlocks.length} marcados</button>
        <button class="btn primary" data-action="queue:render-doc">${icon('play', 'sm')} Renderizar ${pendingBlocks.length || stats.total}
          <span class="tiny" style="opacity:.7">~${fmtDuration(estimate.seconds)}</span></button>
        <button class="btn" data-action="modal:export">${icon('download', 'sm')} Exportar</button>
      </div>
      <div class="bar ok mt-3" id="doc-progress" style="width:${pct(stats.approved, stats.total || 1)}%"></div>
    </div>
  </section>

  <div class="produce">
    <aside class="produce-col docs">
      <header>Documentos <span class="spacer"></span><span class="mono">${p.docs.length}</span></header>
      <div class="scroll">
        <div class="doc-list">
          ${p.docs
            .map((item) => {
              const s = docStats(item);
              return `<button class="doc-item" data-action="doc:select" data-doc="${item.id}" aria-current="${item.id === doc.id}">
                <strong>${icon('file', 'sm')} ${esc(item.title.split(' - ')[0])}</strong>
                <span class="badge ${s.review ? 'warn' : s.approved === s.total ? 'ok' : ''}">${s.review ? s.review + ' rev' : s.approved + '/' + s.total}</span>
                <small>${esc(item.title.split(' - ')[1] || '')}</small>
                <div class="doc-progress"><i style="width:${pct(s.approved, s.total || 1)}%"></i></div>
              </button>`;
            })
            .join('')}
        </div>
        <div style="padding:0 8px 10px">
          <button class="dropzone" data-action="modal:import" style="width:100%;padding:14px">
            ${icon('plus')}<strong>Importar</strong><small>DOCX · MD · SRT · CSV</small>
          </button>
        </div>
      </div>
      <footer class="row tiny muted" style="justify-content:space-between">
        <span>${dStats.total} bloques</span><span>${fmtDuration(dStats.duration)}</span>
      </footer>
    </aside>

    <section class="produce-col">
      <header>
        Bloques <span class="spacer"></span>
        <span class="badge ${reviewBlocks.length ? 'warn' : 'ok'}">${reviewBlocks.length ? reviewBlocks.length + ' por revisar' : 'todo aprobado'}</span>
        <button class="btn sm ghost icon-only" data-action="blocks:approve-all" aria-label="Aprobar todos los bloques con QA correcto">${icon('check', 'sm')}</button>
      </header>
      <div class="scroll">
        <div class="blocks">
          ${doc.blocks.map((item) => blockRowHtml(item)).join('')}
        </div>
      </div>
      <footer class="row tiny muted" style="justify-content:space-between">
        <span>Atajos: <kbd>J</kbd> <kbd>K</kbd> navegar · <kbd>espacio</kbd> escuchar · <kbd>enter</kbd> aprobar · <kbd>R</kbd> regenerar</span>
        <span class="mono">${doc.blocks.length}</span>
      </footer>
    </section>

    <aside class="produce-col inspector">
      <header>Inspector <span class="spacer"></span><span class="mono">${block ? block.id : '--'}</span></header>
      <div class="scroll">${inspectorHtml(block)}</div>
      <footer class="tiny dim">${block ? `${block.takes.length} tomas · ultima ${esc(block.takes[block.takes.length - 1].createdAt)}` : 'sin bloque'}</footer>
    </aside>
  </div>

  <div id="queue-slot">${queueStripHtml()}</div>
`;
}

function viewVoces() {
  const filters = [
    ['todas', 'Todas'],
    ['nativa', 'Nativas'],
    ['mezcla', 'Mezclas'],
    ['clonada', 'Clonadas'],
    ['disenada', 'Disenadas'],
  ];
  const list = VOICES.filter((voice) => state.voiceFilter === 'todas' || voice.origin === state.voiceFilter).filter(
    (voice) =>
      !state.search ||
      `${voice.name} ${voice.engine} ${voice.region} ${voice.tags.join(' ')}`.toLowerCase().includes(state.search.toLowerCase()),
  );
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Voces</h1>
        <p class="tiny muted mt-2">Nativas, mezclas vectoriales, clonadas con consentimiento y disenadas por descripción. Todo local.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="nav" data-route="recetas">${icon('sliders', 'sm')} Asignar por receta</button>
        <button class="btn primary" data-action="modal:grabar">${icon('mic', 'sm')} Grabar referencia</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="chips">
        ${filters.map(([id, label]) => `<button class="chip" data-action="voices:filter" data-filter="${id}" aria-pressed="${state.voiceFilter === id}">${label}</button>`).join('')}
      </div>
      <span class="spacer"></span>
      <label class="sr-only" for="voice-search">Buscar voz</label>
      <input id="voice-search" class="input" style="max-width:260px" placeholder="Buscar nombre, motor o region" value="${esc(state.search)}" data-action="voices:search" />
    </div>

    <div class="grid-cards">
      ${list
        .map((voice) => {
          const engine = engineById(voice.engine);
          return `<article class="card">
            <div class="card-top">
              <span class="card-icon" style="--tone:${engine.commercial ? 'var(--accent)' : 'var(--warn)'}">${icon(voice.origin === 'clonada' ? 'mic' : voice.origin === 'disenada' ? 'sparkles' : 'wave')}</span>
              <div class="grow" style="min-width:0">
                <h3 class="truncate">${esc(voice.name)}</h3>
                <p class="tiny">${esc(engine.name)} · ${voice.region} · ${voice.gender} · ${voice.sr / 1000} kHz</p>
              </div>
              <span class="badge ${voice.origin === 'clonada' ? 'info' : voice.origin === 'disenada' ? 'accent' : ''}">${voice.origin}</span>
            </div>
            <div class="chips">${voice.tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div>
            <div class="row between tiny muted">
              <span class="license-cell ${engine.commercial ? 'ok' : 'no'}">${icon(engine.commercial ? 'check' : 'alert', 'sm')} ${esc(engine.license)}</span>
              <span>${voice.uses} bloques</span>
            </div>
            ${
              voice.consent
                ? `<div class="badge ok" style="justify-self:start">${icon('shield', 'sm')} ${esc(voice.consent.kind)} · ${esc(voice.consent.scope)}</div>`
                : voice.origin === 'clonada'
                  ? `<div class="badge danger" style="justify-self:start">${icon('alert', 'sm')} Sin consentimiento</div>`
                  : ''
            }
            <div class="card-foot">
              <button class="btn sm" data-action="voice:preview" data-voice="${voice.id}">${icon('play', 'sm')} Escuchar</button>
              <button class="btn sm" data-action="cast:assign" data-voice="${voice.id}">${icon('users', 'sm')} Asignar</button>
              <span class="grow"></span>
              ${voice.origin === 'clonada' || voice.origin === 'disenada' ? `<button class="btn sm ghost icon-only" data-action="voice:delete" data-voice="${voice.id}" aria-label="Eliminar ${esc(voice.name)}">${icon('trash', 'sm')}</button>` : ''}
            </div>
          </article>`;
        })
        .join('')}
    </div>
    ${list.length === 0 ? `<div class="panel"><div class="empty">${icon('search')}<strong>Sin resultados</strong>Prueba otro filtro o termino.</div></div>` : ''}
  </div>`;
}

function viewRecetas() {
  const filters = [['todas', 'Todas'], ...RECIPES.map((r) => [r.id, r.name])];
  const list = RECIPES.filter((r) => state.recipeFilter === 'todas' || r.id === state.recipeFilter);
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Recetas de producción</h1>
        <p class="tiny muted mt-2">Una receta es una especificación de fabricación: motor, pausas, loudness, QA y entregables. Anadir una receta es escribir YAML, no tocar la interfaz.</p>
      </div>
      <button class="btn" data-action="recipe:new">${icon('plus', 'sm')} Nueva receta</button>
    </div>
    <div class="toolbar">
      <span class="tiny dim">${RECIPES.length} recetas</span>
      <span class="spacer"></span>
      <label class="sr-only" for="recipe-filter">Filtrar recetas</label>
      <select id="recipe-filter" class="select" style="width:auto" data-action="recipes:filter">
        ${filters.map(([id, label]) => `<option value="${id}"${state.recipeFilter === id ? ' selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div class="grid-cards">
      ${list
        .map(
          (recipe) => `<button class="card recipe interactive" data-action="recipe:open" data-recipe="${recipe.id}" style="--tone:${recipe.tone}">
            <div class="card-top">
              <span class="card-icon">${icon(recipe.icon)}</span>
              <div class="grow" style="min-width:0">
                <h3>${esc(recipe.name)}</h3>
                <p class="tiny">${esc(recipe.structure)} · ${esc(recipe.cast)}</p>
              </div>
            </div>
            <p>${esc(recipe.desc)}</p>
            <div class="spec-row">
              <div><span>Final</span><b>${esc(engineById(recipe.engine).name)}</b></div>
              <div><span>Borrador</span><b>${esc(engineById(recipe.draft).name)}</b></div>
              <div><span>Velocidad</span><b>${recipe.speed.toFixed(2)}x</b></div>
              <div><span>Pausas</span><b>${esc(recipe.pause)}</b></div>
              <div><span>Loudness</span><b>${esc(recipe.lufs)}</b></div>
              <div><span>QA</span><b>${esc(recipe.qa)}</b></div>
            </div>
            <div class="card-foot">
              <span class="badge">${esc(recipe.delivery)}</span>
              <span class="grow"></span>
              ${icon('chevron', 'sm')}
            </div>
          </button>`,
        )
        .join('')}
    </div>
  </div>`;
}

function viewElenco() {
  const p = project();
  const recipe = recipeById(p.recipeId);
  const license = licenseForRole(p, recipe);
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Elenco de ${esc(p.name)}</h1>
        <p class="tiny muted mt-2">Cada rol apunta a una voz con su condicionamiento bloqueado. Cambiar de voz es una decisión de casting, no un ajuste suelto.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="nav" data-route="voces">${icon('mic', 'sm')} Ver voces</button>
        <button class="btn primary" data-action="cast:assign">${icon('plus', 'sm')} Asignar voz</button>
      </div>
    </div>

    ${!license.ok
      ? `<div class="panel" style="border-color:color-mix(in srgb,var(--danger) 34%,transparent)">
          <div class="panel-body row" style="gap:10px">
            ${icon('alert')}
            <div class="grow"><strong style="color:var(--danger)">Licencia no compatible con el proyecto</strong>
              <p class="tiny muted mt-2">${license.problems.map(({ slot, voice }) => `${roleMeta(slot.role).label} usa ${esc(voiceLabel(voice.id))} (${esc(engineById(voice.engine).license)})`).join(' · ')}</p>
            </div>
            <button class="btn sm" data-action="nav" data-route="ajustes">Revisar politica</button>
          </div>
        </div>`
      : ''}

    <section class="panel">
      <div class="panel-head">
        <div><p class="eyebrow">Reparto</p><h2>Roles del proyecto</h2></div>
        <span class="spacer"></span>
        <span class="badge accent">${esc(recipe.name)}</span>
      </div>
      <div class="panel-body flush">
        <table class="table">
          <thead><tr><th>Rol</th><th>Voz</th><th>Origen</th><th>Motor</th><th class="num">Bloques</th><th>Bloqueo</th><th></th></tr></thead>
          <tbody>
            ${p.cast
              .map((slot) => {
                const voice = voiceById(slot.voiceId);
                const engine = voice ? engineById(voice.engine) : null;
                return `<tr>
                  <td><span class="row" style="gap:7px"><i class="voice-dot" style="--role:${roleMeta(slot.role).color}"></i><strong>${roleMeta(slot.role).label}</strong></span></td>
                  <td>${voice ? `<span class="row" style="gap:6px">${esc(voice.name)}<button class="btn sm ghost icon-only" data-action="voice:preview" data-voice="${voice.id}" aria-label="Escuchar">${icon('play', 'sm')}</button></span>` : '<span class="dim">Sin asignar</span>'}</td>
                  <td>${voice ? `<span class="badge ${voice.origin === 'clonada' ? 'info' : voice.origin === 'disenada' ? 'accent' : ''}">${voice.origin}</span>` : '—'}</td>
                  <td>${engine ? esc(engine.name) : '—'}</td>
                  <td class="num">${slot.blocks}</td>
                  <td>${slot.locked ? `<span class="badge ok">${icon('lock', 'sm')} bloqueado</span>` : `<span class="badge warn">${icon('unlock', 'sm')} libre</span>`}</td>
                  <td style="text-align:right">
                    <button class="btn sm" data-action="cast:assign" data-role="${slot.role}">Cambiar</button>
                    <button class="btn sm ghost" data-action="cast:lock" data-role="${slot.role}">${slot.locked ? 'Liberar' : 'Bloquear'}</button>
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>

    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Consistencia</p><h2>Voice lock</h2></div></div>
        <div class="panel-body stack-3 tiny muted">
          <p>En motores zero-shot el condicionamiento se recalcula en cada render y el capitulo 12 no suena exactamente como el 1. Atlas persiste el condicionamiento (latentes de XTTS, prompt y texto de F5/CosyVoice, seed de Qwen) con un hash de la referencia.</p>
          <dl class="kv">
            <dt>Voz clonada</dt><dd>Elena (voz del autor)</dd>
            <dt>Referencia</dt><dd>9.2 s · SNR 27 dB</dd>
            <dt>Hash</dt><dd class="mono">a91f·c2</dd>
            <dt>Condicionamiento</dt><dd>guardado</dd>
            <dt>Bloques afectados</dt><dd>3</dd>
          </dl>
          <button class="btn sm" data-action="voice:lock-refresh">${icon('refresh', 'sm')} Recalcular condicionamiento</button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Procedencia</p><h2>Consentimiento</h2></div></div>
        <div class="panel-body stack-3 tiny muted">
          <p>Sin consentimiento no se exporta un proyecto comercial. La cadena de procedencia viaja en el informe y en los metadatos del WAV.</p>
          <dl class="kv">
            <dt>Titular</dt><dd>Elena R.</dd>
            <dt>Documento</dt><dd>consentimiento firmado</dd>
            <dt>Fecha</dt><dd>2026-10-14</dd>
            <dt>Alcance</dt><dd>comercial</dd>
            <dt>Estado</dt><dd style="color:var(--ok)">verificado</dd>
          </dl>
          <button class="btn sm" data-action="nav" data-route="ajustes">${icon('shield', 'sm')} Politica de consentimiento</button>
        </div>
      </section>
    </div>
  </div>`;
}

function viewPresets() {
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Presets de cliente</h1>
        <p class="tiny muted mt-2">Receta + voz + tono congelados para un cliente. Un clic y el proyecto arranca con su identidad sonora.</p>
      </div>
      <button class="btn primary" data-action="preset:new">${icon('plus', 'sm')} Nuevo preset</button>
    </div>
    <section class="panel">
      <div class="panel-body flush">
        <table class="table">
          <thead><tr><th>Cliente</th><th>Receta</th><th>Voz</th><th>Tono</th><th>Responsable</th><th>Actualizado</th><th></th></tr></thead>
          <tbody>
            ${CLIENT_PRESETS.map((preset) => {
              const recipe = recipeById(preset.recipe);
              const voice = voiceById(preset.voice);
              const engine = voice ? engineById(voice.engine) : null;
              return `<tr>
                <td><strong>${esc(preset.client)}</strong></td>
                <td><span class="badge" style="border-color:${recipe.tone}55;color:${recipe.tone}">${esc(recipe.name)}</span></td>
                <td>${esc(voice ? voice.name : '—')}${engine && !engine.commercial ? ' <span class="badge danger">no comercial</span>' : ''}</td>
                <td>${esc(preset.tone)}</td>
                <td>${esc(preset.owner)}</td>
                <td class="mono">${esc(preset.updated)}</td>
                <td style="text-align:right"><button class="btn sm" data-action="preset:use" data-preset="${preset.id}">Usar</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
    <div class="three-col">
      <section class="panel"><div class="panel-head"><h2>Por que presets y no ajustes</h2></div>
        <div class="panel-body tiny muted">Un preset fija la receta completa: motor, velocidad, pausas, loudness y entregables. El cliente no puede "salirse" del tono por accidente.</div></section>
      <section class="panel"><div class="panel-head"><h2>Versionado</h2></div>
        <div class="panel-body tiny muted">Cada cambio del preset crea una versión; los proyectos existentes conservan la versión con la que se crearon y avisan si hay una mas nueva.</div></section>
      <section class="panel"><div class="panel-head"><h2>Licencias</h2></div>
        <div class="panel-body tiny muted">Si el preset usa un motor no comercial, el cliente y el proyecto se marcan antes de generar, no al exportar.</div></section>
    </div>
  </div>`;
}

function viewGlosario() {
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Glosario de pronunciación</h1>
        <p class="tiny muted mt-2">Siglas, marcas y cifras que el normalizador debe decir de una forma concreta. Se aplica en todos los bloques del alcance.</p>
      </div>
      <span class="badge accent">${GLOSSARY.length} entradas</span>
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Reglas</p><h2>Terminos</h2></div></div>
        <div class="panel-body flush">
          <table class="table">
            <thead><tr><th>Termino</th><th>Se pronuncia</th><th>Alcance</th><th></th></tr></thead>
            <tbody>
              ${GLOSSARY.map(
                (row) => `<tr>
                  <td><strong class="mono">${esc(row.term)}</strong></td>
                  <td>${esc(row.speak)}</td>
                  <td><span class="badge">${esc(row.scope)}</span></td>
                  <td style="text-align:right"><button class="btn sm ghost icon-only" data-action="glossary:remove" data-term="${esc(row.term)}" aria-label="Eliminar ${esc(row.term)}">${icon('trash', 'sm')}</button></td>
                </tr>`,
              ).join('')}
            </tbody>
          </table>
        </div>
        <div class="panel-body">
          <form class="row" data-action="glossary:add">
            <input class="input" name="term" placeholder="Termino (IA, B2B, 2026)" required style="max-width:160px" />
            <input class="input" name="speak" placeholder="Como se pronuncia" required />
            <button class="btn primary" type="submit">${icon('plus', 'sm')} Anadir</button>
          </form>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Efecto</p><h2>Antes y después</h2></div></div>
        <div class="panel-body stack-3">
          <div class="norm-preview" style="background:color-mix(in srgb,var(--danger-soft) 50%,transparent);border-color:color-mix(in srgb,var(--danger) 30%,transparent)">
            <b style="color:var(--danger)">${icon('x', 'sm')} Sin glosario</b>
            "El mercado B2B crecio un 12 por ciento en 2026 segun la API de LATAM."
          </div>
          <div class="norm-preview">
            <b>${icon('check', 'sm')} Con glosario</b>
            "El mercado be a be crecio un doce por ciento en dos mil veintiseis segun la a pe i de latinoamerica."
          </div>
          <p class="tiny dim">El glosario es la causa mas frecuente de audios "raros": siglas leidas como palabra y cifras leidas como número.</p>
        </div>
      </section>
    </div>
  </div>`;
}

function viewLotes() {
  const batch = state.batch;
  const done = batch.rows.filter((row) => row.state === 'ok').length;
  const failed = batch.rows.filter((row) => row.state === 'error').length;
  const reviewing = batch.rows.filter((row) => row.state === 'revisar').length;
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Lotes automatizados</h1>
        <p class="tiny muted mt-2">Un CSV, un SRT o una carpeta. La cola es persistente, reintenta por elemento y agrupa por motor para no recargar pesos.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="batch:cli">${icon('terminal', 'sm')} Ver CLI</button>
        <button class="btn primary" data-action="batch:run" ${state.batchRunning ? 'disabled' : ''}>${state.batchRunning ? 'Procesando…' : 'Ejecutar lote'}</button>
      </div>
    </div>

    <div class="stat-grid">
      ${statCard('Elementos', String(batch.rows.length), 'en este lote', 'accent')}
      ${statCard('Completados', String(done), 'entregables generados', 'ok')}
      ${statCard('Por revisar', String(reviewing), 'QA detecto algo', reviewing ? 'warn' : '')}
      ${statCard('Errores', String(failed), failed ? 'falta runtime F5' : 'sin errores', failed ? 'warn' : '')}
    </div>

    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Cola</p><h2>${esc(batch.name)}</h2></div><span class="spacer"></span><span class="badge ${state.batchRunning ? 'warn' : ''}">${state.batchRunning ? 'ejecutando' : 'detenida'}</span></div>
        <div class="panel-body flush">
          <table class="table">
            <thead><tr><th>#</th><th>Elemento</th><th>Estado</th><th class="num">Duración</th><th>Nota</th><th></th></tr></thead>
            <tbody>
              ${batch.rows
                .map(
                  (row) => `<tr>
                    <td class="mono">${esc(row.id)}</td>
                    <td><strong>${esc(row.title)}</strong></td>
                    <td>${
                      row.state === 'ok'
                        ? '<span class="badge ok">ok</span>'
                        : row.state === 'revisar'
                          ? '<span class="badge warn">revisar</span>'
                          : row.state === 'error'
                            ? '<span class="badge danger">error</span>'
                            : row.state === 'ejecutando'
                              ? '<span class="badge accent"><span class="spin" style="width:9px;height:9px"></span> en curso</span>'
                              : '<span class="badge">en cola</span>'
                    }</td>
                    <td class="num">${esc(row.duration)}</td>
                    <td class="tiny muted">${esc(row.note)}</td>
                    <td style="text-align:right">${row.state === 'error' ? `<button class="btn sm" data-action="batch:retry" data-row="${row.id}">Reintentar</button>` : ''}</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <div class="panel-body row tiny muted" style="border-top:1px solid var(--line)">
          <span class="dot ${state.batchRunning ? 'warn' : 'idle'}"></span>
          ${state.batchRunning ? 'Procesando con Piper · 1 worker GPU' : 'Pausado entre elementos · reanudable tras cerrar la app'}
        </div>
      </section>

      <div class="stack-3">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Origen</p><h2>Entrada del lote</h2></div></div>
          <div class="panel-body stack-3">
            <button class="dropzone" data-action="batch:import" style="width:100%">
              ${icon('upload')}<strong>Arrastra CSV, SRT o una carpeta</strong><small>En este prototipo el drop simula la carga</small>
            </button>
            <dl class="kv tiny">
              <dt>Receta</dt><dd>${esc(recipeById(batch.recipe).name)}</dd>
              <dt>Motor</dt><dd>${esc(engineById(batch.engine).name)}</dd>
              <dt>Fit-to-duration</dt><dd>desactivado</dd>
              <dt>Carpeta vigilada</dt><dd>${state.ajustes.watchfolder ? 'activa' : 'inactiva'}</dd>
            </dl>
            <button class="btn sm" data-action="nav" data-route="ajustes">${icon('settings', 'sm')} Opciones de automatización</button>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">CLI</p><h2>Sin abrir la app</h2></div></div>
          <div class="panel-body stack-2">
            <pre class="code">atlas batch --csv curso.csv \\
  --recipe elearning --engine piper \\
  --out entregables/curso</pre>
            <p class="tiny dim">Misma cola, mismo informe de licencias y mismo QA que la interfaz.</p>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

function viewCola() {
  const active = queueActive();
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Automatización</h1>
        <p class="tiny muted mt-2">Cola persistente, CLI, carpeta vigilada y webhooks locales. Un solo worker GPU con agrupación por motor.</p>
      </div>
      <button class="btn primary" data-action="queue:render-doc">${icon('play', 'sm')} Encolar documento actual</button>
    </div>
    <div class="stat-grid">
      ${statCard('Trabajos', String(state.jobs.length), 'en esta sesión', 'accent')}
      ${statCard('En curso', active ? '1' : '0', active ? esc(active.title) : 'worker libre', active ? 'warn' : '')}
      ${statCard('Progreso', `${queueDone()}/${queueTotal() || 0}`, 'bloques procesados')}
      ${statCard('Reanudable', 'Si', 'commit por bloque en SQLite', 'ok')}
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Worker GPU</p><h2>Cola de trabajos</h2></div><span class="spacer"></span>
          <button class="btn sm" data-action="queue:toggle">${state.queueRunning ? icon('pause', 'sm') : icon('play', 'sm')} ${state.queueRunning ? 'Pausar' : 'Reanudar'}</button>
          <button class="btn sm ghost" data-action="queue:clear">Limpiar</button>
        </div>
        <div class="panel-body flush">
          <table class="table">
            <thead><tr><th>Trabajo</th><th>Motor</th><th>Estado</th><th class="num">Bloques</th><th class="num">ETA</th></tr></thead>
            <tbody>
              ${
                state.jobs.length
                  ? state.jobs
                      .map(
                        (job) => `<tr>
                          <td><strong>${esc(job.title)}</strong><br /><span class="tiny dim mono">${esc(job.id)}</span></td>
                          <td class="tiny">${esc(job.detail)}</td>
                          <td>${
                            job.state === 'listo'
                              ? '<span class="badge ok">listo</span>'
                              : job.state === 'ejecutando'
                                ? '<span class="badge accent">ejecutando</span>'
                                : '<span class="badge">en cola</span>'
                          }</td>
                          <td class="num">${job.progress}/${job.total}</td>
                          <td class="num">${esc(job.eta)}</td>
                        </tr>`,
                      )
                      .join('')
                  : `<tr><td colspan="5"><div class="empty">${icon('list')}<strong>Cola vacia</strong>Encola un documento para verlo aqui.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
      <div class="stack-3">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Terminal</p><h2>CLI</h2></div></div>
          <div class="panel-body stack-2">
            <pre class="code">atlas render --project patagonia \\
  --doc 07 --preset audiolibro --engine piper

atlas watch --in inbox --out outbox \\
  --recipe elearning

atlas doctor     # modelos, runtimes y licencias</pre>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Disparadores</p><h2>Automatización</h2></div></div>
          <div class="panel-body" style="padding-top:0">
            ${toggleRow('watchfolder', 'Carpeta vigilada', 'Todo lo que dejes en inbox/ se produce solo')}
            ${toggleRow('notify', 'Webhook local', 'Avisa al terminar cada trabajo (localhost)')}
            ${toggleRow('night', 'Ventana nocturna', 'Renderiza solo entre 01:00 y 07:00')}
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

function toggleRow(key, label, detail) {
  const on = Boolean(state.ajustes[key]);
  return `<button class="toggle" data-action="settings:toggle" data-key="${key}" role="switch" aria-checked="${on}">
    <span class="toggle-text"><strong>${esc(label)}</strong><small>${esc(detail)}</small></span>
    <span class="toggle-switch" aria-checked="${on}"><b></b></span>
  </button>`;
}

function libraryRows() {
  return project()
    .docs.flatMap((doc) =>
      doc.blocks.map((block) => {
        const take = chosenTake(block);
        return {
          id: block.id,
          doc: doc.title.split(' - ')[0],
          text: block.text,
          take,
          state: block.state,
          role: block.role,
          file: `${block.id}_${take?.engine}_${take?.duration?.toFixed(2)}s.wav`,
        };
      }),
    )
    .filter((row) => row.take)
    .filter(
      (row) =>
        !state.search ||
        `${row.text} ${row.id} ${row.take.engine}`.toLowerCase().includes(state.search.toLowerCase()),
    );
}

function viewBiblioteca() {
  const rows = libraryRows();
  const totalDuration = rows.reduce((acc, row) => acc + row.take.duration, 0);
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Biblioteca</h1>
        <p class="tiny muted mt-2">Tomas aprobadas y exportables, con su motor, licencia y QA. Reutilizar una receta es un clic.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="modal:export">${icon('download', 'sm')} Exportar</button>
        <button class="btn primary" data-action="nav" data-route="produce">${icon('grid', 'sm')} Ir a producir</button>
      </div>
    </div>
    <div class="stat-grid">
      ${statCard('Tomas', String(rows.length), 'en el proyecto actual', 'accent')}
      ${statCard('Audio', fmtDuration(totalDuration), 'suma de duraciones')}
      ${statCard('Aprobadas', String(rows.filter((r) => r.state === 'aprobado').length), 'listas para entregar', 'ok')}
      ${statCard('Con aviso', String(rows.filter((r) => r.state === 'revisar').length), 'escuchar antes de exportar', rows.some((r) => r.state === 'revisar') ? 'warn' : '')}
    </div>
    <div class="toolbar">
      <label class="sr-only" for="lib-search">Buscar en la biblioteca</label>
      <input id="lib-search" class="input" style="max-width:320px" placeholder="Buscar por texto, id o motor" value="${esc(state.search)}" data-action="lib:search" />
      <span class="spacer"></span>
      <span class="tiny dim">${rows.length} resultados</span>
    </div>
    <section class="panel">
      <div class="panel-body flush">
        <table class="table">
          <thead><tr><th>Archivo</th><th>Texto</th><th>Motor</th><th class="num">Dur.</th><th class="num">RTF</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${rows
              .slice(0, 30)
              .map(
                (row) => `<tr>
                  <td class="mono tiny">${esc(row.file)}</td>
                  <td style="max-width:340px"><span class="truncate" style="display:block">${esc(row.text)}</span></td>
                  <td class="tiny">${esc(engineById(row.take.engine).name)}${engineById(row.take.engine).commercial ? '' : ' <span class="badge danger">NC</span>'}</td>
                  <td class="num">${row.take.duration.toFixed(2)} s</td>
                  <td class="num">${row.take.rtf}</td>
                  <td><span class="badge ${row.state === 'aprobado' ? 'ok' : row.state === 'revisar' ? 'warn' : ''}">${row.state}</span></td>
                  <td style="text-align:right;white-space:nowrap">
                    <button class="btn sm ghost icon-only" data-action="block:play" data-block="${row.id}" aria-label="Escuchar">${icon('play', 'sm')}</button>
                    <button class="btn sm ghost" data-action="lib:reuse" data-block="${row.id}">Reusar</button>
                  </td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function viewAjustes() {
  const nonCommercial = ENGINES.filter((engine) => !engine.commercial);
  return `
  <div class="stack-4">
    <div class="row between wrap">
      <div>
        <h1 style="font-size:var(--text-2xl)">Ajustes</h1>
        <p class="tiny muted mt-2">Solo se muestra como editable lo que el backend puede aplicar. Lo informativo va marcado como tal.</p>
      </div>
      <button class="btn primary" data-action="settings:save">${icon('check', 'sm')} Guardar cambios</button>
    </div>

    <div class="two-col">
      <div class="stack-3">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Inferencia</p><h2>Hardware</h2></div><span class="spacer"></span><span class="badge ok">aplicable en caliente</span></div>
          <div class="panel-body stack-3">
            <div class="controls-row" style="border:0; padding:0; background:none">
              <label class="field">Proveedor
                <select class="select" data-action="settings:provider">
                  <option value="DirectML"${state.ajustes.provider === 'DirectML' ? ' selected' : ''}>DirectML (GPU)</option>
                  <option value="CPU"${state.ajustes.provider === 'CPU' ? ' selected' : ''}>CPU (12 hilos)</option>
                </select>
              </label>
              <label class="field">Dispositivo
                <select class="select"><option>GPU 0 · adaptador principal</option><option>GPU 1 · secundario</option></select>
              </label>
              <label class="range">
                <span class="range-top">Hilos de CPU <b>${state.ajustes.threads}</b></span>
                <input type="range" min="2" max="24" step="1" value="${state.ajustes.threads}" data-action="settings:threads" />
              </label>
              <label class="range">
                <span class="range-top">Limite VRAM <b>${state.ajustes.vram} GB</b></span>
                <input type="range" min="2" max="32" step="1" value="${state.ajustes.vram}" data-action="settings:vram" />
              </label>
            </div>
            <p class="tiny dim">Cambiar proveedor o hilos recrea las sesiones ONNX en el siguiente render; no requiere reiniciar la aplicación.</p>
            <div class="row">
              <button class="btn sm" data-action="settings:unload">${icon('refresh', 'sm')} Liberar memoria de motores</button>
              <span class="tiny muted">Motor residente: ${esc(engineById(system.engine).name)} · ${system.vramUsed.toFixed(1)} GB</span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Politica</p><h2>Licencias y consentimiento</h2></div></div>
          <div class="panel-body" style="padding-top:0">
            ${toggleRow('excludeNC', 'Excluir motores no comerciales', 'En proyectos marcados como comerciales')}
            ${toggleRow('consentGate', 'Exigir consentimiento', 'Bloquea exportación si una voz clonada no lo tiene')}
            <div class="mt-3">
              <table class="table">
                <thead><tr><th>Motor</th><th>Licencia</th><th>Comercial</th></tr></thead>
                <tbody>
                  ${ENGINES.map(
                    (engine) => `<tr>
                      <td class="tiny">${esc(engine.name)}</td>
                      <td class="license-cell">${esc(engine.license)}</td>
                      <td>${engine.commercial ? `<span class="badge ok">si</span>` : `<span class="badge danger">no</span>`}</td>
                    </tr>`,
                  ).join('')}
                </tbody>
              </table>
            </div>
            <p class="tiny dim mt-3">${nonCommercial.map((e) => e.name).join(' y ')} no se propondran en recetas comerciales ni entraran en el informe como aptos.</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Salida</p><h2>Entregables</h2></div></div>
          <div class="panel-body stack-3">
            <div class="controls-row" style="border:0;padding:0;background:none">
              <label class="field">Sample rate<select class="select"><option>24 kHz · producción</option><option>22,05 kHz · Piper</option><option>16 kHz · ligero</option><option>8 kHz · telefonia</option></select></label>
              <label class="field">Formato<select class="select"><option>WAV PCM 16-bit</option><option>WAV PCM 24-bit</option><option>MP3 192 kbps</option><option>M4B con capitulos</option></select></label>
              <label class="field">Loudness<select class="select"><option>-16 LUFS · streaming</option><option>-19 LUFS · audiolibro</option><option>-23 LUFS · broadcast</option></select></label>
              <label class="field">Subtitulos<select class="select"><option>SRT desde bloques</option><option>VTT desde bloques</option><option>ninguno</option></select></label>
            </div>
            <p class="tiny dim">Se guardan como predeterminados de la receta, no como preferencia global.</p>
          </div>
        </section>
      </div>

      <div class="stack-3">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">IA local</p><h2>Modelos auxiliares</h2></div><span class="spacer"></span>
            <span class="badge ok">${system.phi.device}</span>
          </div>
          <div class="panel-body" style="padding-top:0">
            ${toggleRow('phiClean', 'Limpiar guión', 'Muletillas, repeticiones y puntuación con Phi-3.5')}
            ${toggleRow('phiCast', 'Casting asistido', 'Describe un personaje y propone tres voces con auditoria')}
            ${toggleRow('phiNotes', 'Notas de episodio', 'Resumen y tags para podcast')}
            <div class="mt-3">
              <dl class="kv tiny">
                <dt>Modelo</dt><dd>phi-3.5-mini · DirectML</dd>
                <dt>Último uso</dt><dd>hace 2 h · limpieza de guión</dd>
                <dt>Fallback</dt><dd>heuristicas acusticas</dd>
              </dl>
              <p class="tiny dim mt-2">Cada uso muestra que motor respondio. Si Phi no esta, todo sigue funcionando con reglas.</p>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Privacidad</p><h2>Datos y rutas</h2></div></div>
          <div class="panel-body stack-3">
            <div class="row between tiny"><span class="muted">Modo offline estricto</span><span class="badge ok">activo</span></div>
            <div class="row between tiny"><span class="muted">Telemetria externa</span><span class="badge ok">desactivada</span></div>
            <label class="field">Biblioteca<input class="input" value="C:\\antigravityAS\\VozStudio-Omni-ES\\biblioteca" readonly /></label>
            <label class="field">Modelos enlazados<input class="input" value="C:\\antigravityAS\\Modelos -ai-brains" readonly /></label>
            <p class="tiny dim">Rutas en solo lectura: las resuelve el backend desde su configuración.</p>
            <button class="btn sm" data-action="modal:export">${icon('download', 'sm')} Ver ejemplo de informe</button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Interfaz</p><h2>Tema y accesibilidad</h2></div></div>
          <div class="panel-body stack-3">
            <label class="field">Tema
              <select class="select" data-action="theme:set">${themeOptions()}</select>
            </label>
            <p class="tiny dim">Escala minima de 11 px, foco visible, sin zoom bloqueado y respeto a prefers-reduced-motion.</p>
            <div class="row"><span class="badge ok">WCAG AA objetivos</span><span class="badge">3 temas validados</span></div>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

/* --------------------------------- modals --------------------------------- */
function modalWrapper(title, body, foot, extraClass = '') {
  return `<button class="scrim" data-action="modal:close" aria-label="Cerrar"></button>
  <div class="modal ${extraClass}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><span class="spacer" style="margin-left:auto"></span>
      <button class="btn icon-only ghost" data-action="modal:close" aria-label="Cerrar">${icon('x')}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
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
  if (modal.type === 'export') {
    const stats = projectStats();
    const recipe = recipeById(project().recipeId);
    const license = licenseForRole(project(), recipe);
    return modalWrapper(
      `Exportar ${project().name}`,
      `<p class="tiny muted">${stats.total} bloques · ${fmtDuration(stats.duration)} · ${esc(recipe.name)} · loudness ${esc(recipe.lufs)}</p>
      <div class="stack-3">
        ${[
          ['WAV 24 kHz PCM 16', true],
          ['MP3 192 kbps', true],
          ['M4B con marcas de capitulo', recipe.delivery.includes('M4B')],
          ['SRT y VTT desde bloques', true],
          ['CSV de QA', true],
          ['Informe de licencias', true],
          ['Pistas separadas por rol', recipe.delivery.includes('pistas')],
        ]
          .map(
            ([label, checked]) => `<label class="check"><input type="checkbox" ${checked ? 'checked' : ''} /> ${esc(label)}</label>`,
          )
          .join('')}
      </div>
      <div class="norm-preview" style="background:color-mix(in srgb,${license.ok ? 'var(--ok-soft)' : 'var(--danger-soft)'} 60%,transparent)">
        <b style="color:${license.ok ? 'var(--ok)' : 'var(--danger)'}">${icon(license.ok ? 'shield' : 'alert', 'sm')} ${license.ok ? 'Informe de licencias: apto' : 'Informe de licencias: bloqueado'}</b>
        ${license.ok ? 'Todos los motores usados permiten uso comercial.' : `Retira ${license.problems.map(({ voice }) => voice.name).join(', ')} o cambia el proyecto a uso personal.`}
      </div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       <button class="btn primary" data-action="export:run">${icon('download', 'sm')} Exportar entregables</button>`,
      'wide',
    );
  }
  if (modal.type === 'import') {
    return modalWrapper(
      'Importar documento',
      `<p class="tiny muted">El importador crea bloques, detecta hablantes y prepara el documento para asignar elenco.</p>
      <button class="dropzone" data-action="import:run" style="width:100%">
        ${icon('upload')}<strong>Arrastra DOCX, Markdown, SRT o CSV</strong><small>o haz clic para simular la carga</small>
      </button>
      <div class="controls-row">
        <label class="field">Unidad<select class="select"><option>Parrafo (receta)</option><option>Frase</option><option>Cue de subtitulo</option><option>Línea de CSV</option></select></label>
        <label class="field">Detección de hablantes<select class="select"><option>Reglas + Phi local</option><option>Solo reglas (guiones —)</option><option>Ninguna</option></select></label>
      </div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       <button class="btn primary" data-action="import:run">${icon('upload', 'sm')} Importar y segmentar</button>`,
    );
  }
  if (modal.type === 'grabar') {
    const step = state.grabacion.step;
    const steps = ['Prueba de sala', 'Teleprompter', 'Medidor', 'Consentimiento'];
    const scripts = [
      'El veloz murciélago hindú comía feliz cardillo y kiwi; la cigüeña tocaba el saxofón detrás del palenque.',
      'Al caer la tarde sobre el valle, el silencio revelaba antiguos secretos olvidados entre los robles.',
      '—No vuelvas por aquí —le había dicho el viejo—. La ruta del sur se cierra en junio.',
    ];
    return modalWrapper(
      'Grabación guiada de referencia',
      `<div class="row wrap">
        ${steps.map((label, index) => `<span class="badge ${index + 1 === step ? 'accent' : index + 1 < step ? 'ok' : ''}">${index + 1}. ${label}</span>`).join('')}
      </div>
      ${
        step === 1
          ? `<p class="tiny muted">Mide el ruido de fondo antes de grabar. Si el SNR es bajo, la clonación arrastrará el ruido.</p>
             <div class="norm-preview"><b>${icon('gauge', 'sm')} Nivel de sala</b>
               <div class="bar mt-2" style="height:8px"><i style="width:18%"></i></div>
               <div class="row between tiny mt-2"><span>-48 dBFS</span><span class="badge ok">sala valida</span></div>
             </div>`
          : step === 2
            ? `<p class="tiny muted">Lee el guion de calibración. La transcripción se rellena sola: no hay que copiarla a mano.</p>
               <div class="editor" style="padding:0;gap:6px">
                 ${scripts.map((text, index) => `<div class="take" style="grid-template-columns:auto 1fr"><span class="tag">G${index + 1}</span><span>${esc(text)}</span></div>`).join('')}
               </div>`
            : step === 3
              ? `<p class="tiny muted">Duración objetivo 7 a 12 s, sin clipping y con voz detectada.</p>
                 <div class="norm-preview"><b>${icon('mic', 'sm')} 9.2 s capturados</b>
                   <div class="row between tiny mt-2"><span>Pico -3.1 dBFS</span><span>SNR 27 dB</span><span class="badge ok">sin clipping</span></div>
                 </div>
                 <div class="qa-list">
                   ${[
                     ['Duración 7-12 s', true],
                     ['Sin clipping', true],
                     ['Voz detectada', true],
                     ['SNR mayor a 20 dB', true],
                   ]
                     .map(
                       ([label, ok]) => `<div class="qa-row ${ok ? 'ok' : 'warn'}">${icon(ok ? 'check' : 'alert')}<span>${esc(label)}</span><b>${ok ? 'ok' : 'revisar'}</b></div>`,
                     )
                     .join('')}
                 </div>`
              : `<p class="tiny muted">Sin consentimiento no se puede clonar ni exportar en un proyecto comercial. La declaración queda ligada a la voz.</p>
                 <label class="field">Nombre del titular<input class="input" value="${esc(state.grabacion.name)}" data-action="grabar:name" /></label>
                 <label class="check"><input type="checkbox" ${state.grabacion.consent ? 'checked' : ''} data-action="grabar:consent" /> Declaro que tengo consentimiento del titular y que su uso será ${project().license}.</label>
                 <dl class="kv tiny"><dt>Alcance</dt><dd>${project().license}</dd><dt>Fecha</dt><dd>${new Date().toISOString().slice(0, 10)}</dd></dl>`
      }`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       ${step > 1 ? `<button class="btn" data-action="grabar:prev">Anterior</button>` : ''}
       <button class="btn primary" data-action="grabar:next">${step === 4 ? 'Guardar voz' : 'Siguiente'}</button>`,
    );
  }
  if (modal.type === 'cast') {
    const role = modal.role || 'personaje_1';
    return modalWrapper(
      `Asignar voz a ${roleMeta(role).label}`,
      `<p class="tiny muted">Solo se listan voces compatibles con la receta (${esc(recipeById(project().recipeId).name)}) y con la licencia del proyecto.</p>
      <div class="stack-3" style="max-height:320px;overflow:auto">
        ${VOICES.filter((voice) => !state.ajustes.excludeNC || engineById(voice.engine).commercial)
          .map(
            (voice) => `<button class="voice-row" data-action="cast:choose" data-voice="${voice.id}" data-role="${role}">
              <i class="voice-dot" style="--role:${roleMeta(role).color}"></i>
              <span><strong>${esc(voice.name)}</strong><small>${esc(engineById(voice.engine).name)} · ${voice.region} · ${voice.sr / 1000} kHz</small></span>
              <span class="badge">${voice.origin}</span>
              <span class="license-cell ${engineById(voice.engine).commercial ? 'ok' : 'no'}">${esc(engineById(voice.engine).license)}</span>
              ${icon('chevron', 'sm')}
            </button>`,
          )
          .join('')}
      </div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>`,
      'wide',
    );
  }
  if (modal.type === 'project') {
    return modalWrapper(
      'Nuevo proyecto',
      `<label class="field">Nombre del proyecto<input class="input" placeholder="Audiolibro Patagonia" data-action="project:name" value="${esc(state.nuevoProyecto.name)}" /></label>
       <div class="field">Receta
         <div class="grid-cards" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:6px">
           ${RECIPES.map(
             (recipe) => `<button class="card recipe interactive" data-action="project:recipe" data-recipe="${recipe.id}" style="--tone:${recipe.tone};padding:10px">
               <div class="row" style="gap:7px">${icon(recipe.icon, 'sm')}<strong class="tiny">${esc(recipe.name)}</strong></div>
             </button>`,
           ).join('')}
         </div>
       </div>
       <label class="field">Uso
         <select class="select" data-action="project:license">
           <option value="comercial"${state.nuevoProyecto.license === 'comercial' ? ' selected' : ''}>Comercial (excluye MMS y XTTS)</option>
           <option value="personal"${state.nuevoProyecto.license === 'personal' ? ' selected' : ''}>Personal / interno</option>
         </select>
       </label>
       <div class="norm-preview"><b>${icon('info', 'sm')} Receta seleccionada</b>
         ${esc(recipeById(state.nuevoProyecto.recipeId).name)} · ${esc(engineById(recipeById(state.nuevoProyecto.recipeId).engine).name)} · ${esc(recipeById(state.nuevoProyecto.recipeId).lufs)}
       </div>`,
      `<button class="btn" data-action="modal:close">Cancelar</button>
       <button class="btn primary" data-action="project:create">${icon('plus', 'sm')} Crear proyecto</button>`,
    );
  }
  if (modal.type === 'queue') {
    return modalWrapper(
      'Cola de trabajos',
      `<p class="tiny muted">Un worker GPU en orden de prioridad; CPU en paralelo para normalizar, QA, loudness y subtitulos. Cada bloque confirma su toma al terminar.</p>
      <div class="queue">${state.jobs
        .map(
          (job) => `<div class="queue-row" data-state="${job.state}">
            ${job.state === 'ejecutando' ? '<span class="spin"></span>' : job.state === 'listo' ? icon('check', 'sm') : icon('clock', 'sm')}
            <div><strong>${esc(job.title)}</strong><small>${esc(job.detail)} · ${job.progress}/${job.total}</small></div>
            <span class="badge ${job.state === 'listo' ? 'ok' : job.state === 'ejecutando' ? 'accent' : ''}">${job.state}</span>
          </div>`,
        )
        .join('')}</div>`,
      `<button class="btn" data-action="modal:close">Cerrar</button>
       <button class="btn" data-action="queue:clear">Limpiar completados</button>
       <button class="btn primary" data-action="queue:toggle">${state.queueRunning ? 'Pausar' : 'Reanudar'}</button>`,
      'wide',
    );
  }
  if (modal.type === 'cli') {
    return modalWrapper(
      'CLI de Atlas',
      `<p class="tiny muted">La misma cola y el mismo QA, sin abrir la interfaz.</p>
      <pre class="code"># Un documento concreto
atlas render --project patagonia --doc 07 --preset audiolibro --engine piper

# Lote desde CSV
atlas batch --csv curso.csv --recipe elearning --engine piper --out out/

# Carpeta vigilada (inbox -> outbox)
atlas watch --in inbox --out outbox --recipe elearning

# Diagnóstico: modelos, runtimes, licencias y hardware
atlas doctor

# Exportar un proyecto ya aprobado
atlas export --project patagonia --format all --license-report</pre>
      <p class="tiny dim">Cada comando escribe el informe de licencias y el CSV de QA junto al audio.</p>`,
      `<button class="btn primary" data-action="modal:close">Entendido</button>`,
      'wide',
    );
  }
  if (modal.type === 'help') {
    return modalWrapper(
      'Como recorrer este prototipo',
      `<div class="stack-3 tiny muted">
        <p><b class="mono">Producir</b> es la pantalla central: documentos a la izquierda, bloques en el centro, inspector del bloque a la derecha y cola abajo. Todo lo que se ve son datos simulados del proyecto Patagonia.</p>
        <p><b class="mono">Renderizar</b> encola los bloques pendientes y los completa en la cola inferior: veras los estados cambiar y las tomas aparecer en el inspector.</p>
        <p><b class="mono">Recetas</b> muestra las 14 especificaciones de fabricación. <b class="mono">Voces</b> incluye grabación guiada con consentimiento. <b class="mono">Lotes</b> y <b class="mono">CLI</b> cubren la automatización.</p>
        <p>Atajos: <kbd>Ctrl K</kbd> palette · <kbd>J</kbd>/<kbd>K</kbd> bloque siguiente/anterior · <kbd>espacio</kbd> escuchar · <kbd>Enter</kbd> aprobar · <kbd>R</kbd> regenerar · <kbd>Esc</kbd> cerrar.</p>
        <p class="dim">Objetivo del prototipo: validar el modelo proyecto/bloque/toma y la densidad de la pantalla antes de escribir dominio real.</p>
      </div>`,
      `<button class="btn primary" data-action="modal:close">Empezar</button>`,
    );
  }
  if (modal.type === 'palette') {
    const items = paletteItems(state.palette.query);
    return `<button class="scrim" data-action="palette:close" aria-label="Cerrar buscador"></button>
    <div class="modal palette" role="dialog" aria-modal="true" aria-label="Buscar y ejecutar">
      <input class="palette-input" id="palette-input" placeholder="Buscar voces, bloques o comandos" value="${esc(state.palette.query)}" data-action="palette:input" />
      <div class="palette-list" id="palette-list">
        ${items
          .map(
            (item, index) => `<button class="palette-item" data-action="palette:run" data-id="${item.id}" data-active="${index === state.palette.active}">
              ${icon(item.icon, 'sm')}<span>${esc(item.label)}</span><span class="hint">${esc(item.hint || '')}</span>
            </button>`,
          )
          .join('')}
      </div>
    </div>`;
  }
  return '';
}

function paletteItems(query) {
  const q = (query || '').toLowerCase();
  const routes = Object.entries(TITLES)
    .filter(([id]) => id !== state.route)
    .map(([id, label]) => ({ id: `nav:${id}`, label: `Ir a ${label}`, icon: 'arrow', hint: 'navegar' }));
  const actions = [
    { id: 'act:render', label: 'Renderizar documento actual', icon: 'play', hint: 'cola' },
    { id: 'act:export', label: 'Exportar proyecto', icon: 'download', hint: 'entregables' },
    { id: 'act:import', label: 'Importar documento', icon: 'upload', hint: 'DOCX · MD · SRT' },
    { id: 'act:grabar', label: 'Grabar referencia de voz', icon: 'mic', hint: 'clonación' },
    { id: 'act:new', label: 'Nuevo proyecto desde receta', icon: 'plus', hint: 'crear' },
  ];
  const blocks = (currentDoc()?.blocks || [])
    .filter((block) => !q || block.text.toLowerCase().includes(q) || block.id.includes(q))
    .slice(0, 5)
    .map((block) => ({ id: `block:${block.id}`, label: `${block.id} · ${block.text.slice(0, 46)}…`, icon: 'edit', hint: 'bloque' }));
  const voices = VOICES.filter((voice) => q && voice.name.toLowerCase().includes(q))
    .slice(0, 4)
    .map((voice) => ({ id: `voice:${voice.id}`, label: voice.name, icon: 'mic', hint: engineById(voice.engine).name }));
  const all = [...actions, ...routes, ...blocks, ...voices];
  return q ? all.filter((item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)) : all.slice(0, 10);
}

/* ---------------------------------- views --------------------------------- */
function view() {
  switch (state.route) {
    case 'inicio':
      return viewInicio();
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
    case 'cola':
      return viewCola();
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
  app.innerHTML = `${sidebarHtml()}
    <div class="main">
      ${topbarHtml()}
      <main class="content" id="content">${view()}</main>
    </div>
    <div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>
    ${modalHtml()}`;
  renderToasts();
  if (state.route === 'produce') paintPlayer();
}

/* -------------------------------- interactions ----------------------------- */
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
  state.route = route;
  state.search = '';
  state.modals = [];
  state.palette.open = false;
  render();
  window.scrollTo({ top: 0 });
}

function selectBlock(id) {
  state.blockId = id;
  render();
  const node = $(`[data-block-row="${id}"]`);
  node?.scrollIntoView({ block: 'nearest' });
}

function approveBlock(id) {
  const block = findBlock(id);
  if (!block) return;
  block.state = 'aprobado';
  block.qaIssue = null;
  notify('Bloque aprobado', `${block.id} · ${chosenTake(block)?.duration.toFixed(2)} s`, 'ok');
  render();
}

function renderBlock(id) {
  const block = findBlock(id);
  if (!block) return;
  const take = chosenTake(block);
  const engineId = take ? take.engine : recipeById(project().recipeId).engine;
  const estimate = estimateRender(block.text.length, engineId);
  const newTake = {
    id: `${block.id}-t${block.takes.length + 1}`,
    engine: engineId,
    voice: 'em_alex',
    speed: take ? take.speed : 0.96,
    duration: Math.max(0.9, Math.round((block.text.length / 15.2) * (0.96 + Math.random() * 0.08) * 100) / 100),
    sr: 24000,
    rtf: Number((engineById(engineId).rtf * 0.95).toFixed(3)),
    createdAt: 'ahora',
    qa: 1,
  };
  block.takes.push(newTake);
  block.chosenTakeId = newTake.id;
  block.state = 'aprobado';
  block.qaIssue = null;
  notify('Bloque regenerado', `${engineById(engineId).name} · ${newTake.duration.toFixed(2)} s · ~${estimate.seconds.toFixed(1)} s de render`, 'ok');
  render();
}

function selectTake(blockId, takeId) {
  const block = findBlock(blockId);
  if (!block) return;
  block.chosenTakeId = takeId;
  notify('Toma elegida', `${takeId}`, 'ok');
  render();
}

function saveBlockText(blockId, text) {
  const block = findBlock(blockId);
  if (!block) return;
  block.text = text;
  block.state = 'pendiente';
  notify('Texto actualizado', `${block.id} queda pendiente de regenerar`, 'warn');
  // Actualiza contadores sin re-render para no perder el foco del textarea.
  paintProduceCounters();
  const row = $(`[data-block-row="${blockId}"] .block-text`);
  if (row) row.textContent = text;
}

function setMode(mode) {
  state.mode = mode;
  const recipe = recipeById(project().recipeId);
  const engineId = mode === 'borrador' ? recipe.draft : recipe.engine;
  notify(mode === 'borrador' ? 'Pasada borrador' : 'Pasada final', `${engineById(engineId).name} · RTF ${engineById(engineId).rtf}`, 'ok');
  render();
}

function runExport() {
  const recipe = recipeById(project().recipeId);
  const license = licenseForRole(project(), recipe);
  state.modals = [];
  if (!license.ok) {
    notify('Exportación bloqueada', 'El informe de licencias detecto motores no comerciales', 'danger');
    render();
    return;
  }
  notify('Entregables generados', 'WAV · MP3 · SRT · CSV de QA · informe de licencias', 'ok');
  render();
}

function assignCast(voiceId, role) {
  const slot = project().cast.find((item) => item.role === role) || project().cast[0];
  slot.voiceId = voiceId;
  state.modals = [];
  notify('Casting actualizado', `${roleMeta(role).label} → ${voiceLabel(voiceId)}`, 'ok');
  render();
}

function runBatchStep() {
  const row = state.batch.rows.find((item) => item.state === 'ejecutando') || state.batch.rows.find((item) => item.state === 'pendiente');
  if (!row) {
    state.batchRunning = false;
    clearInterval(state.batchTimer);
    notify('Lote finalizado', 'Revisa los avisos de QA antes de entregar', 'ok');
    render();
    return;
  }
  row.state = 'ejecutando';
  render();
  setTimeout(() => {
    row.state = Math.random() > 0.86 ? 'revisar' : 'ok';
    row.duration = `0:${String(20 + Math.floor(Math.random() * 40)).padStart(2, '0')}`;
    row.note = row.state === 'ok' ? 'SRT generado' : 'cobertura 93 % - 1 termino';
    render();
  }, 900);
}

/* ------------------------------- event wiring ------------------------------ */
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;

  switch (action) {
    case 'nav':
      navigate(target.dataset.route);
      break;
    case 'toast:close':
      state.toasts = state.toasts.filter((toast) => toast.id !== target.dataset.id);
      renderToasts();
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
    case 'modal:close':
      closeModal();
      break;
    case 'help':
      openModal({ type: 'help' });
      break;
    case 'recipe:open':
      openModal({ type: 'recipe', recipeId: target.dataset.recipe });
      break;
    case 'recipe:use':
      state.nuevoProyecto.recipeId = target.dataset.recipe;
      state.modals = [];
      openModal({ type: 'project' });
      break;
    case 'recipe:new':
      notify('Receta nueva', 'En el producto real es un YAML de ~20 líneas', 'ok');
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
    case 'import:run': {
      const doc = currentDoc();
      state.modals = [];
      if (!doc) {
        notify('Sin documento', 'En el prototipo solo Patagonia tiene capitulos', 'warn');
        render();
        break;
      }
      doc.blocks.forEach((block) => {
        block.state = 'pendiente';
        block.qaIssue = null;
      });
      notify('Documento importado', `${doc.blocks.length} bloques segmentados · 2 roles detectados`, 'ok');
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
      } else {
        if (!state.grabacion.consent) {
          notify('Falta consentimiento', 'No se puede guardar una voz clonada sin declaración', 'danger');
          break;
        }
        state.modals = [];
        notify('Voz creada', `${state.grabacion.name} · condicionamiento bloqueado`, 'ok');
        render();
      }
      break;
    case 'grabar:prev':
      state.grabacion.step = Math.max(1, state.grabacion.step - 1);
      render();
      break;
    case 'project:new':
      openModal({ type: 'project' });
      break;
    case 'project:recipe':
      state.nuevoProyecto.recipeId = target.dataset.recipe;
      render();
      break;
    case 'project:create': {
      const recipe = recipeById(state.nuevoProyecto.recipeId);
      state.modals = [];
      notify('Proyecto creado', `${state.nuevoProyecto.name || recipe.name} · ${recipe.name}`, 'ok');
      navigate('produce');
      break;
    }
    case 'project:switch': {
      const next = projectById(target.value);
      state.projectId = next.id;
      state.docId = next.docs[0]?.id || null;
      state.blockId = next.docs[0]?.blocks[0]?.id || null;
      if (!['inicio', 'produce', 'elenco'].includes(state.route)) state.route = 'inicio';
      notify('Proyecto activo', next.name, 'ok');
      render();
      break;
    }
    case 'project:open':
      state.projectId = target.dataset.project;
      state.docId = projectById(target.dataset.project).docs[0]?.id || state.docId;
      state.blockId = projectById(target.dataset.project).docs[0]?.blocks[0]?.id || state.blockId;
      navigate('produce');
      break;
    case 'resume':
      navigate('produce');
      break;
    case 'doc:select':
      state.docId = target.dataset.doc;
      state.blockId = currentDoc()?.blocks[0]?.id || state.blockId;
      render();
      break;
    case 'block:select':
      selectBlock(target.dataset.block);
      break;
    case 'block:play':
      startPlayer(target.dataset.block);
      break;
    case 'block:approve':
      approveBlock(target.dataset.block);
      break;
    case 'block:render':
      renderBlock(target.dataset.block);
      break;
    case 'block:review': {
      const block = findBlock(target.dataset.block);
      if (block) {
        block.state = 'revisar';
        block.qaIssue = 'cobertura';
        notify('Marcado para revisar', block.id, 'warn');
        render();
      }
      break;
    }
    case 'blocks:approve-all': {
      const doc = currentDoc();
      if (!doc) break;
      let count = 0;
      doc.blocks.forEach((block) => {
        if (block.state === 'revisar' && block.takes.length) {
          block.state = 'aprobado';
          block.qaIssue = null;
          count += 1;
        }
      });
      notify(count ? 'Bloques aprobados' : 'Nada que aprobar', count ? `${count} bloques con QA aceptado` : 'Los bloques marcados necesitan escucha', count ? 'ok' : 'warn');
      render();
      break;
    }
    case 'take:choose':
      selectTake(target.dataset.block, target.dataset.take);
      break;
    case 'mode:set':
      setMode(target.dataset.mode);
      break;
    case 'queue:render-doc': {
      const doc = currentDoc();
      if (!doc) break;
      const blocks = doc.blocks.filter((block) => block.state !== 'aprobado');
      if (!blocks.length) {
        notify('Nada pendiente', 'Todos los bloques de este documento están aprobados', 'ok');
        break;
      }
      enqueueRender(doc, state.mode, blocks);
      render();
      break;
    }
    case 'queue:render-review': {
      const doc = currentDoc();
      if (!doc) break;
      const blocks = doc.blocks.filter((block) => block.state === 'revisar');
      enqueueRender(doc, state.mode, blocks.length ? blocks : doc.blocks.slice(0, 6));
      render();
      break;
    }
    case 'queue:toggle':
      if (state.queueRunning) {
        state.queueRunning = false;
        clearInterval(state.queueTimer);
        notify('Cola pausada', 'Se reanuda entre bloques, nunca a mitad de una inferencia', 'warn');
        renderQueue();
        render();
      } else {
        notify('Cola reanudada', '', 'ok');
        runQueue();
        renderQueue();
      }
      break;
    case 'queue:detail':
      openModal({ type: 'queue' });
      break;
    case 'queue:clear':
      state.jobs = state.jobs.filter((job) => job.state !== 'listo');
      renderQueue();
      render();
      break;
    case 'inspector:tab':
      state.inspectorTab = target.dataset.tab;
      render();
      break;
    case 'voices:filter':
      state.voiceFilter = target.dataset.filter;
      render();
      break;
    case 'voice:preview':
      notify('Previsualización', `${voiceLabel(target.dataset.voice)} · 6 s de muestra cacheada`, 'ok');
      break;
    case 'voice:delete':
      notify('Voz eliminada', 'El prototipo no borra datos: en el producto se mueve a papelera 10 s', 'warn');
      break;
    case 'voice:lock-refresh':
      notify('Condicionamiento recalculado', 'Nuevo hash de referencia · 3 bloques afectados', 'ok');
      break;
    case 'cast:assign':
      openModal({ type: 'cast', role: target.dataset.role || 'personaje_1' });
      break;
    case 'cast:choose':
      assignCast(target.dataset.voice, target.dataset.role);
      break;
    case 'cast:lock': {
      const slot = project().cast.find((item) => item.role === target.dataset.role);
      if (slot) {
        slot.locked = !slot.locked;
        notify(slot.locked ? 'Voz bloqueada' : 'Voz liberada', roleMeta(slot.role).label, slot.locked ? 'ok' : 'warn');
        render();
      }
      break;
    }
    case 'preset:use':
      notify('Preset aplicado', 'Receta y voz del cliente cargadas en el proyecto', 'ok');
      navigate('produce');
      break;
    case 'preset:new':
      openModal({ type: 'recipe', recipeId: 'audiolibro' });
      break;
    case 'batch:run':
      if (state.batchRunning) break;
      state.batchRunning = true;
      clearInterval(state.batchTimer);
      state.batchTimer = setInterval(() => {
        if (!state.batchRunning) {
          clearInterval(state.batchTimer);
          return;
        }
        runBatchStep();
      }, 1400);
      notify('Lote iniciado', '1 worker GPU · agrupado por motor', 'ok');
      render();
      break;
    case 'batch:retry': {
      const row = state.batch.rows.find((item) => item.id === target.dataset.row);
      if (row) {
        row.state = 'pendiente';
        row.note = 'en cola';
        notify('Reintento encolado', row.title, 'ok');
        render();
      }
      break;
    }
    case 'batch:import':
      notify('Entrada simulada', 'En el producto: CSV, SRT o carpeta vigilada', 'ok');
      break;
    case 'batch:cli':
      openModal({ type: 'cli' });
      break;
    case 'lib:reuse': {
      state.blockId = target.dataset.block;
      navigate('produce');
      notify('Receta reutilizada', 'Texto y parámetros cargados en el inspector', 'ok');
      break;
    }
    case 'settings:toggle': {
      const key = target.dataset.key;
      state.ajustes[key] = !state.ajustes[key];
      render();
      break;
    }
    case 'settings:save':
      notify('Ajustes guardados', 'Sin reinicio: se aplican al siguiente render', 'ok');
      break;
    case 'settings:unload':
      system.vramUsed = 1.2;
      notify('Memoria liberada', 'Sesiones ONNX desalojadas · VRAM 1,2 GB', 'ok');
      render();
      break;
    case 'glossary:remove':
      notify('Entrada eliminada', target.dataset.term, 'warn');
      break;
    case 'player:vol':
      state.player.muted = !state.player.muted;
      notify(state.player.muted ? 'Silenciado' : 'Sonido activo', '', 'ok');
      break;
    default:
      break;
  }
});

document.addEventListener('input', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'voices:search' || action === 'lib:search') {
    state.search = target.value;
    const host = $('#content');
    if (action === 'voices:search') {
      clearTimeout(window.__searchTimer);
      window.__searchTimer = setTimeout(() => {
        if (host) {
          host.innerHTML = view();
          const input = $('#voice-search');
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }
      }, 220);
    } else {
      clearTimeout(window.__searchTimer);
      window.__searchTimer = setTimeout(() => {
        if (host) {
          host.innerHTML = view();
          const input = $('#lib-search');
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }
      }, 220);
    }
  } else if (action === 'palette:input') {
    state.palette.query = target.value;
    state.palette.active = 0;
    const list = $('#palette-list');
    if (list) {
      list.innerHTML = paletteItems(target.value)
        .map(
          (item, index) => `<button class="palette-item" data-action="palette:run" data-id="${item.id}" data-active="${index === 0}">
            ${icon(item.icon, 'sm')}<span>${esc(item.label)}</span><span class="hint">${esc(item.hint || '')}</span>
          </button>`,
        )
        .join('');
    }
  } else if (action === 'project:name') {
    state.nuevoProyecto.name = target.value;
  } else if (action === 'grabar:name') {
    state.grabacion.name = target.value;
  } else if (action === 'block:speed') {
    const block = findBlock(state.blockId);
    const take = chosenTake(block);
    if (take) {
      take.speed = Number(target.value);
      const label = target.parentElement.querySelector('.range-top b');
      if (label) label.textContent = `${Number(target.value).toFixed(2)}x`;
    }
  }
});

document.addEventListener('change', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'theme:set') {
    state.theme = target.value;
    localStorage.setItem(STORE_KEY, JSON.stringify({ theme: state.theme }));
    const app = $('#app');
    if (app) app.dataset.theme = state.theme;
  } else if (action === 'project:switch') {
    const next = projectById(target.value);
    state.projectId = next.id;
    state.docId = next.docs[0]?.id || null;
    state.blockId = next.docs[0]?.blocks[0]?.id || null;
    if (!['inicio', 'produce', 'elenco'].includes(state.route)) state.route = 'inicio';
    notify('Proyecto activo', next.name, 'ok');
    render();
  } else if (action === 'recipes:filter') {
    state.recipeFilter = target.value;
    render();
  } else if (action === 'block:role') {
    const block = findBlock(state.blockId);
    if (block) {
      block.role = target.value;
      notify('Rol actualizado', `${block.id} → ${roleMeta(block.role).label}`, 'ok');
      render();
    }
  } else if (action === 'block:engine') {
    notify('Motor del bloque', 'Se aplicara en la próxima regeneración', 'ok');
  } else if (action === 'project:license') {
    state.nuevoProyecto.license = target.value;
  } else if (action === 'settings:provider') {
    state.ajustes.provider = target.value;
    system.provider = target.value;
    notify('Proveedor actualizado', 'Las sesiones se recrean en el siguiente render', 'ok');
    render();
  } else if (action === 'grabar:consent') {
    state.grabacion.consent = target.checked;
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-action="glossary:add"]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const term = String(data.get('term') || '').trim();
  if (!term) return;
  GLOSSARY.push({ term, speak: String(data.get('speak') || '').trim(), scope: project().name });
  notify('Glosario actualizado', `${term} · se aplicara en el siguiente render`, 'ok');
  render();
});

document.addEventListener('keydown', (event) => {
  const paletteOpen = state.modals.some((modal) => modal.type === 'palette');
  const anyModal = state.modals.length > 0;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    state.palette = { open: true, query: '', active: 0 };
    openModal({ type: 'palette' });
    return;
  }
  if (event.key === 'Escape') {
    if (anyModal) {
      state.palette.open = false;
      closeModal();
    }
    return;
  }
  if (paletteOpen) {
    const items = paletteItems(state.palette.query);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      state.palette.active = clamp(state.palette.active + (event.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
      $$('.palette-item').forEach((node, index) => node.dataset.active = String(index === state.palette.active));
      return;
    }
    if (event.key === 'Enter' && items[state.palette.active]) {
      event.preventDefault();
      runPaletteItem(items[state.palette.active].id);
    }
    return;
  }
  if (typing || anyModal) return;
  if (state.route !== 'produce') return;

  const doc = currentDoc();
  if (!doc) return;
  const index = doc.blocks.findIndex((block) => block.id === state.blockId);
  if (event.key.toLowerCase() === 'j') {
    selectBlock(doc.blocks[Math.min(doc.blocks.length - 1, index + 1)].id);
  } else if (event.key.toLowerCase() === 'k') {
    selectBlock(doc.blocks[Math.max(0, index - 1)].id);
  } else if (event.code === 'Space') {
    event.preventDefault();
    startPlayer(state.blockId);
  } else if (event.key === 'Enter') {
    approveBlock(state.blockId);
  } else if (event.key.toLowerCase() === 'r') {
    renderBlock(state.blockId);
  }
});

function runPaletteItem(id) {
  const [kind, value] = id.split(':');
  state.palette.open = false;
  state.modals = [];
  if (kind === 'nav') {
    navigate(value);
  } else if (kind === 'act') {
    if (value === 'render') {
      const doc = currentDoc();
      if (doc) {
        enqueueRender(doc, state.mode, doc.blocks.filter((block) => block.state !== 'aprobado').length ? doc.blocks.filter((block) => block.state !== 'aprobado') : doc.blocks.slice(0, 5));
        navigate('produce');
      }
    } else if (value === 'export') {
      openModal({ type: 'export' });
    } else if (value === 'import') {
      openModal({ type: 'import' });
    } else if (value === 'grabar') {
      state.grabacion = { step: 1, seconds: 0, level: 0, consent: false, name: state.grabacion.name };
      openModal({ type: 'grabar' });
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

state.blockId = currentDoc()?.blocks.find((block) => block.state === 'revisar')?.id || currentDoc()?.blocks[0]?.id || state.blockId;

// El textarea vive dentro del HTML pintado: se enlaza tras cada render de la vista.
document.addEventListener('input', (event) => {
  if (event.target.id === 'block-text') {
    const block = findBlock(event.target.dataset.block);
    if (block) {
      block.text = event.target.value;
      // Solo cambia de estado la primera vez: reescribir el estado a cada tecla
      // borraria la aprobacion de un bloque por corregir una coma.
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
render();
setInterval(tickSystem, 4200);

// Accesibilidad: el scrim y los modales cierran con click y Escape; foco inicial en buscador.
window.addEventListener('load', () => {
  const input = $('#palette-input');
  if (input) input.focus();
});

// Hooks de verificacion (sin efecto en el navegador).
export { state as __state, render as __render, navigate as __navigate };
