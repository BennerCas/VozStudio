// VozStudio Atlas - marca compartida.
// Un unico emblema para el sidebar, el icono de escritorio (favicon/PWA) y el splash.
// Geometria calcada de scripts/launcher/generate_icon.py: squircle obsidiana,
// borde cian luminoso y cinco barras acusticas con degradado cian.

const SIZE = 256;
const CENTER = SIZE / 2;
const RADIUS = SIZE * 0.44;
const CORNER = SIZE * 0.21;

// Mismas proporciones que el generador nativo del icono.
const BAR_X = [-0.46, -0.23, 0, 0.23, 0.46];
const BAR_H = [0.28, 0.52, 0.76, 0.48, 0.3];
const BAR_HALF_W = SIZE * 0.046;

function bars(fill = 'url(#vz-bar)') {
  return BAR_X.map((x, index) => {
    const px = CENTER + x * RADIUS * 0.85;
    const halfH = BAR_H[index] * RADIUS * 0.72;
    return `<rect x="${(px - BAR_HALF_W).toFixed(2)}" y="${(CENTER - halfH).toFixed(2)}" width="${(BAR_HALF_W * 2).toFixed(2)}" height="${(halfH * 2).toFixed(2)}" fill="${fill}"/>`;
  }).join('');
}

function defs(idPrefix) {
  return `<defs>
    <radialGradient id="${idPrefix}-glow" cx="50%" cy="50%" r="62%">
      <stop offset="0%" stop-color="#102742"/>
      <stop offset="100%" stop-color="#060b14"/>
    </radialGradient>
    <linearGradient id="${idPrefix}-bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0ed7f2"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>`;
}

/**
 * Emblema de la aplicacion. `plain` omite los gradientes (para data URI estable en favicon).
 */
export function appMark(size = 34, { plain = false, rounded = true } = {}) {
  const uid = plain ? 'vzp' : 'vzm';
  const corner = rounded ? CORNER : 8;
  // A 18 px el aro de 9 unidades se come el dibujo y el degradado difumina las barras:
  // se afina el aro y se pinta el emblema en color plano.
  const small = size <= 22;
  const stroke = small ? 5 : 7;
  const barFill = small ? '#0ed7f2' : `url(#${uid}-bar)`;
  return `<svg class="app-mark" width="${size}" height="${size}" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="VozStudio Atlas" focusable="false">
    ${defs(uid)}
    <rect x="7" y="7" width="${SIZE - 14}" height="${SIZE - 14}" rx="${corner}" fill="${small ? '#0a131c' : `url(#${uid}-glow)`}" stroke="#1aa3d8" stroke-width="${stroke}"/>
    ${bars(barFill)}
  </svg>`;
}

/**
 * Mismo emblema con identificadores fijos, listo para un data URI o un archivo .svg.
 * Conserva el resplandor y el degradado de las barras del icono real.
 */
export function appMarkPlain() {
  const barRects = BAR_X.map((x, index) => {
    const px = CENTER + x * RADIUS * 0.85;
    const halfH = BAR_H[index] * RADIUS * 0.72;
    return `<rect x="${(px - BAR_HALF_W).toFixed(2)}" y="${(CENTER - halfH).toFixed(2)}" width="${(BAR_HALF_W * 2).toFixed(2)}" height="${(halfH * 2).toFixed(2)}" fill="url(#vz-icon-bar)"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <radialGradient id="vz-icon-glow" cx="50%" cy="50%" r="62%">
      <stop offset="0%" stop-color="#102742"/>
      <stop offset="100%" stop-color="#060b14"/>
    </radialGradient>
    <linearGradient id="vz-icon-bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0ed7f2"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect x="7" y="7" width="${SIZE - 14}" height="${SIZE - 14}" rx="${CORNER}" fill="url(#vz-icon-glow)" stroke="#1aa3d8" stroke-width="9"/>
  ${barRects}
</svg>`;
}

export const APP_ICON_URI = `data:image/svg+xml,${encodeURIComponent(appMarkPlain())}`;

export const BRAND = {
  name: 'VozStudio',
  product: 'Atlas',
  claim: 'Estudio de produccion de contenido hablado. 100% local, 100% en espanol.',
  credit: 'HUMAN AI SYNERGY BY BENNER CASTILLO',
  creditParts: ['Human AI Synergy', 'By Benner Castillo'],
  author: 'Benner Castillo',
  initials: 'BC',
};
