// VozStudio Atlas - componentes de interfaz reutilizables.
// Todo devuelve cadenas HTML; el estado vive en app.js. Sin dependencias.

import { ICONS, ENGINES, engineById } from './data.js';
import { appMark } from './brand.js';

export const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.wave}</svg>`;

export const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

export function fmtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}

export function fmtDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ------------------------------ toasts en vivo ----------------------------- */
let toastSeq = 0;

export function createToasts() {
  const items = [];
  // El contenedor se resuelve en cada pintado: al crear el store todavia no existe
  // #toasts en el DOM y usar document.body borraria toda la aplicacion.
  const container = () => (typeof document !== 'undefined' ? document.getElementById('toasts') : null);

  function render() {
    const el = container();
    if (!el) return;
    el.innerHTML = items
      .map(
        (toast) => `<div class="toast ${toast.kind}" role="status">
          <span class="toast-icon">${icon(toast.kind === 'danger' ? 'alert' : toast.kind === 'warn' ? 'info' : 'check', 'sm')}</span>
          <div class="toast-body"><strong>${esc(toast.title)}</strong>${toast.detail ? `<span>${esc(toast.detail)}</span>` : ''}</div>
          <button class="toast-x" data-toast="${toast.id}" aria-label="Cerrar aviso">${icon('x', 'sm')}</button>
        </div>`,
      )
      .join('');
  }

  function push(title, detail = '', kind = 'ok') {
    const id = `t${++toastSeq}`;
    items.push({ id, title, detail, kind });
    render();
    return id;
  }

  function drop(id) {
    const index = items.findIndex((toast) => toast.id === id);
    if (index >= 0) items.splice(index, 1);
    render();
  }

  return { push, drop, items, render };
}

/* ---------------------------------- base ---------------------------------- */
export function panel(title, eyebrow, body, extra = '') {
  return `<section class="panel ${extra}">
    <div class="panel-head">
      <div>${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2>${title}</h2></div>
      <span class="spacer"></span>
    </div>
    <div class="panel-body">${body}</div>
  </section>`;
}

export function statCard(label, value, detail, tone = '') {
  return `<div class="stat ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
}

export function field(label, control, hint = '') {
  // `hint` acepta texto o HTML corto (por ejemplo, una etiqueta de estado).
  return `<label class="field">${esc(label)}${control}${hint ? `<em class="field-hint">${hint}</em>` : ''}</label>`;
}

export function rangeControl({ label, id, min, max, step = 0.01, value, action, unit = '', format }) {
  const shown = format ? format(value) : `${value}${unit}`;
  return `<div class="range">
    <div class="range-top"><span>${esc(label)}</span><b data-range-out="${id}">${esc(shown)}</b></div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" data-action="${action}" data-key="${id}" />
  </div>`;
}

export function engineBadge(engineId) {
  const engine = engineById(engineId);
  if (!engine) return '';
  return `<span class="badge ${engine.commercial ? 'ok' : 'warn'}">${engine.commercial ? icon('check', 'sm') : icon('alert', 'sm')}${esc(engine.license)}</span>`;
}

/** Marca de licencia: este producto es personal, no comercial. */
export function licenseChip(engineId) {
  const engine = engineById(engineId);
  if (!engine || engine.commercial) return '';
  return `<span class="badge info" title="El prototipo declara uso personal: se muestran todos los motores sin excluir ninguno">${icon('info', 'sm')}uso personal</span>`;
}

/* ---------------------------------- voces --------------------------------- */
export function voiceCard(voice, { compact = false } = {}) {
  const engine = engineById(voice.engine) || ENGINES[0];
  const originIcon = voice.origin === 'clonada' ? 'mic' : voice.origin === 'disenada' ? 'sparkles' : voice.origin === 'mezcla' ? 'layers' : 'wave';
  return `<article class="card voice-card" data-voice-card="${voice.id}">
    <div class="card-top">
      <span class="card-icon" style="--tone:${engine.commercial ? 'var(--accent)' : 'var(--info)'}">${icon(originIcon)}</span>
      <div class="grow" style="min-width:0">
        <h3 class="truncate">${esc(voice.name)}</h3>
        <p class="tiny">${esc(engine.name)} · ${esc(voice.region)} · ${esc(voice.gender)} · ${voice.sr / 1000} kHz</p>
      </div>
      <span class="badge ${voice.origin === 'clonada' ? 'info' : voice.origin === 'disenada' ? 'accent' : ''}">${esc(voice.origin)}</span>
    </div>
    <div class="chips">${voice.tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div>
    <div class="row between tiny muted">
      <span class="license-cell ${engine.commercial ? 'ok' : 'no'}">${icon(engine.commercial ? 'check' : 'info', 'sm')} ${esc(engine.license)}</span>
      <span>${voice.uses} bloques</span>
    </div>
    ${!compact ? `<p class="tiny dim voice-desc">${esc(voice.desc || '')}</p>` : ''}
    ${
      voice.consent
        ? `<div class="badge ok" style="justify-self:start">${icon('shield', 'sm')} ${esc(voice.consent.kind)} · ${esc(voice.consent.scope)}</div>`
        : voice.origin === 'clonada'
          ? `<div class="badge danger" style="justify-self:start">${icon('alert', 'sm')} Sin consentimiento</div>`
          : ''
    }
    <div class="card-foot">
      <button class="btn sm" data-action="voice:preview" data-voice="${voice.id}">${icon('play', 'sm')} Escuchar</button>
      <button class="btn sm" data-action="voice:detail" data-voice="${voice.id}">${icon('info', 'sm')} Ficha</button>
      <button class="btn sm" data-action="voice:assign" data-voice="${voice.id}">${icon('users', 'sm')} Asignar</button>
    </div>
  </article>`;
}

/** Selector de motor con recuento real de voces del catalogo. */
export function engineOptions(voices, selected) {
  return ENGINES.map((engine) => {
    const count = voices.filter((voice) => voice.engine === engine.id).length;
    return `<option value="${engine.id}" ${engine.id === selected ? 'selected' : ''}>${esc(engine.name)} · ${count} ${count === 1 ? 'voz' : 'voces'}</option>`;
  }).join('');
}

/* ------------------------------- paginacion -------------------------------- */
export function paginate(items, page, perPage) {
  const total = Math.max(1, Math.ceil(items.length / perPage));
  const safe = clamp(page, 0, total - 1);
  return {
    slice: items.slice(safe * perPage, safe * perPage + perPage),
    page: safe,
    total,
    from: items.length === 0 ? 0 : safe * perPage + 1,
    to: Math.min(items.length, safe * perPage + perPage),
    count: items.length,
  };
}

export function pager(id, info, action) {
  if (info.total <= 1) {
    return `<div class="pager"><span class="tiny muted">${info.count} ${info.count === 1 ? 'resultado' : 'resultados'}</span></div>`;
  }
  return `<div class="pager">
    <span class="tiny muted">${info.from}-${info.to} de ${info.count}</span>
    <div class="row">
      <button class="btn sm icon-only" data-action="${action}" data-page="${info.page - 1}" ${info.page === 0 ? 'disabled' : ''} aria-label="Pagina anterior">${icon('arrowLeft', 'sm')}</button>
      <span class="tiny mono dim">${info.page + 1} / ${info.total}</span>
      <button class="btn sm icon-only" data-action="${action}" data-page="${info.page + 1}" ${info.page >= info.total - 1 ? 'disabled' : ''} aria-label="Pagina siguiente">${icon('arrow', 'sm')}</button>
    </div>
  </div>`;
}

/* --------------------------------- modal ---------------------------------- */
export function modalShell({ title, subtitle = '', body, foot = '', wide = false, mark = true }) {
  return `<div class="scrim" data-action="modal:close"></div>
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        ${mark ? `<span class="modal-mark">${appMark(28)}</span>` : ''}
        <div class="grow"><h2>${esc(title)}</h2>${subtitle ? `<p class="tiny muted">${subtitle}</p>` : ''}</div>
        <button class="btn icon-only" data-action="modal:close" aria-label="Cerrar">${icon('x')}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${foot ? `<footer class="modal-foot">${foot}</footer>` : ''}
    </div>`;
}

/* -------------------------------- helpers --------------------------------- */
export function meter(value, tone = '', label = '') {
  return `<div class="meter ${tone}" ${label ? `aria-label="${esc(label)}"` : ''}><i style="width:${clamp(value, 0, 100)}%"></i></div>`;
}

export function emptyState(title, detail, actionHtml = '') {
  return `<div class="empty"><span class="empty-icon">${icon('sparkles', 'hero')}</span>
    <h3>${esc(title)}</h3><p class="tiny muted">${esc(detail)}</p>${actionHtml}</div>`;
}

export function bar(value, tone = '') {
  return `<div class="bar ${tone}"><i style="width:${clamp(value, 0, 100)}%"></i></div>`;
}

/* ------------------------------- carrusel -------------------------------- */
/*
  Bandeja horizontal: muestra un numero fijo de tarjetas y el resto se alcanza
  desplazando. Se mueve con los botones, la rueda, el arrastre del raton y el
  dedo. Las flechas de los extremos se desactivan solas.
*/
export function carrusel({ id, items, porVista, cols = 4, etiqueta = 'tarjetas' }) {
  const paginas = Math.ceil(items.length / porVista);
  const flechas = paginas > 1
    ? `<button class="tray-arrow prev" data-action="tray:prev" data-tray="${id}" aria-label="Ver ${etiqueta} anteriores" disabled>${icon('arrowLeft', 'sm')}</button>
       <button class="tray-arrow next" data-action="tray:next" data-tray="${id}" aria-label="Ver mas ${etiqueta}">${icon('arrow', 'sm')}</button>`
    : '';
  return `<div class="tray" data-tray-id="${id}" data-tray-cols="${cols}" data-tray-visible="${porVista}" data-tray-total="${items.length}">
    <div class="tray-viewport" tabindex="0" role="group" aria-label="Bandeja de ${esc(etiqueta)}: ${items.length} en total, ${porVista} por vista">
      <div class="tray-track">${items.join('')}</div>
    </div>
    ${flechas}
  </div>`;
}

/* ------------------------------ desplazamiento ---------------------------- */
/*
  Una sola implementacion para todas las bandejas: mide la pagina con el ancho
  real de las tarjetas, asi que el tamano de la ventana no importa.
*/
function trayStep(tray) {
  const viewport = tray.querySelector('.tray-viewport');
  const cards = tray.querySelectorAll('.tray-track > *');
  if (!viewport || !cards.length) return { step: 0, max: 0 };
  const visible = Number(tray.dataset.trayVisible) || 1;
  let step = 0;
  if (cards.length >= visible) {
    const first = cards[0].getBoundingClientRect().width;
    const last = cards[visible - 1].getBoundingClientRect().width;
    if (first > 0) step = last + (first * 0.75); // ancho de la ultima visible + hueco
  }
  if (!step) step = viewport.clientWidth; // sin motor de layout: una pagina entera
  const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  return { step, max };
}

export function syncTrays(root = document) {
  root.querySelectorAll('[data-tray-id]').forEach((tray) => {
    const viewport = tray.querySelector('.tray-viewport');
    if (!viewport) return;
    const prev = tray.querySelector('.tray-arrow.prev');
    const next = tray.querySelector('.tray-arrow.next');
    const max = viewport.scrollWidth - viewport.clientWidth;
    // Sin motor de layout no se puede medir: no se apaga nada, o la flecha
    // quedaria muerta para siempre en un render temprano.
    if (prev) prev.disabled = viewport.scrollLeft <= 2;
    if (next) next.disabled = max > 0 ? viewport.scrollLeft >= max - 2 : false;
  });
}

export function moveTray(id, direction, root = document) {
  const tray = root.querySelector(`[data-tray-id="${id}"]`);
  if (!tray) return;
  const viewport = tray.querySelector('.tray-viewport');
  if (!viewport) return;
  const { step } = trayStep(tray);
  viewport.scrollBy({ left: direction * step, behavior: 'smooth' });
  window.setTimeout(() => syncTrays(root), 340);
}

/* ------------------------- arrastre con raton y dedo ---------------------- */
export function attachTrayDrag(root = document) {
  if (root.__trayDragAttached) return;
  root.__trayDragAttached = true;

  let drag = null;

  const inicio = (event) => {
    const tray = event.target.closest?.('[data-tray-id]');
    const viewport = tray?.querySelector('.tray-viewport');
    if (!viewport) return;
    // En tactil manda el desplazamiento nativo del navegador.
    if (event.pointerType === 'touch') return;
    if (event.target.closest('button') && !event.target.closest('.tray-arrow')) return;
    drag = { viewport, x: event.clientX, left: viewport.scrollLeft, movido: false, tray };
    viewport.classList.add('dragging');
  };

  const mover = (event) => {
    if (!drag || event.pointerType === 'touch') return;
    const delta = event.clientX - drag.x;
    if (Math.abs(delta) > 4) drag.movido = true;
    drag.viewport.scrollLeft = drag.left - delta;
    if (drag.movido) event.preventDefault();
  };

  const soltar = () => {
    if (!drag) return;
    drag.viewport.classList.remove('dragging');
    const { tray } = drag;
    drag = null;
    syncTrays(tray.parentElement || root);
  };

  root.addEventListener('pointerdown', inicio, { passive: true });
  root.addEventListener('pointermove', mover, { passive: false });
  root.addEventListener('pointerup', soltar);
  root.addEventListener('pointercancel', soltar);
  root.addEventListener('pointerleave', soltar);

  // Un arrastre no debe acabar en clic sobre la tarjeta.
  root.addEventListener('click', (event) => {
    if (event.target.closest('.tray-viewport.dragging')) event.preventDefault();
  }, true);

  // Rueda vertical u horizontal sobre la bandeja: mueve la bandeja, no la pagina.
  root.addEventListener('wheel', (event) => {
    const viewport = event.target.closest?.('[data-tray-id] .tray-viewport');
    if (!viewport) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    if (max <= 0) return;
    const antes = viewport.scrollLeft;
    if ((delta > 0 && antes < max - 1) || (delta < 0 && antes > 1)) {
      viewport.scrollLeft = antes + delta;
      event.preventDefault();
      syncTrays(viewport.closest('[data-tray-id]').parentElement || root);
    }
  }, { passive: false });

  root.addEventListener('scroll', (event) => {
    const viewport = event.target.closest?.('.tray-viewport');
    if (viewport) syncTrays(viewport.closest('[data-tray-id]').parentElement || root);
  }, true);

  // Con teclado: las flechas mueven la bandeja que tiene el foco.
  root.addEventListener('keydown', (event) => {
    const viewport = event.target.closest?.('.tray-viewport');
    if (!viewport) return;
    const tray = viewport.closest('[data-tray-id]');
    if (!tray) return;
    const { step } = trayStep(tray);
    if (event.key === 'ArrowRight') { viewport.scrollBy({ left: step, behavior: 'smooth' }); event.preventDefault(); }
    if (event.key === 'ArrowLeft') { viewport.scrollBy({ left: -step, behavior: 'smooth' }); event.preventDefault(); }
  });
}
