#!/usr/bin/env node
// Empaqueta el prototipo en un unico archivo autonomo.
//
// Motivo: el prototipo usa <script type="module">, y eso obliga a servirlo por HTTP.
// Abierto con file:// (o dentro de un visor que no ejecuta modulos) la pantalla queda
// en blanco. Este empaquetador incrusta CSS, JS, datos y emblema en un solo HTML para
// que funcione en cualquier sitio: file://, visor de archivos, adjunto o servidor.
//
// Uso:
//   node scripts/empaquetar.mjs            -> escribe index.html (version publicada)
//   node scripts/empaquetar.mjs --check     -> valida el resultado sin escribir

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'index.html');

// Orden de resolucion: cada modulo solo importa de los que estan antes.
const MODULES = ['data.js', 'voces.data.js', 'prompts.data.js', 'lectura.data.js', 'clonacion.data.js', 'qwen.data.js', 'brand.js', 'ui.js', 'app.js'];

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.log(`FALLO ${message}`);
};

/** Quita export/import y devuelve el cuerpo del modulo listo para incrustar. */
function transformModule(file) {
  const src = readFileSync(join(ROOT, 'src', file), 'utf8');
  const imports = [];

  // 1. Se anotan los imports relativos y se eliminan (el orden ya garantiza la disponibilidad).
  //    Se registran los alias (`voiceById as catalogVoice`) para poder reescribirlos.
  const importRe = /^import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([^']+)';$/gm;
  const renames = [];
  let body = src.replace(importRe, (match, clause, target) => {
    clause
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const [imported, alias] = part.split(/\s+as\s+/).map((piece) => piece.trim());
        imports.push({ imported, alias: alias || imported, target });
        if (alias && alias !== imported) renames.push({ from: imported, to: alias });
      });
    return '';
  });
  if (/^import\s/m.test(body)) {
    fail(`${file}: import sin resolver (revisa el formato del modulo)`);
  }

  // 1b. Los alias se aplican en todo el cuerpo salvo la palabra clave del import.
  renames.forEach(({ from, to }) => {
    const re = new RegExp(`\\b${from}\\b`, 'g');
    body = body.replace(re, to);
  });

  // 2. Declaraciones exportadas -> declaraciones locales.
  body = body.replace(/^export const ([A-Za-z0-9_$]+)/gm, 'const $1');
  body = body.replace(/^export function ([A-Za-z0-9_$]+)/gm, 'function $1');
  body = body.replace(/^export let ([A-Za-z0-9_$]+)/gm, 'let $1');

  // 3. `export { state as __state, ... }` de app.js: se reemite como asignacion.
  const aliasRe = /export\s*\{\s*([^}]*)\}\s*;?/g;
  const aliases = [];
  body = body.replace(aliasRe, (match, inner) => {
    inner
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const [local, exported] = part.split(/\s+as\s+/).map((piece) => piece.trim());
        aliases.push({ local, exported: exported || local });
      });
    return '';
  });
  if (aliases.length) {
    body += '\n' + aliases.map(({ local, exported }) => `window.${exported} = ${local};`).join('\n');
  }

  if (/^\s*(import|export)\s/m.test(body)) {
    fail(`${file}: quedaron sentencias import/export sin transformar`);
  }

  return { file, body: body.trim(), imports, aliases };
}

console.log('== Empaquetando el prototipo ==');

const transformed = MODULES.map((file) => {
  if (!existsSync(join(ROOT, 'src', file))) {
    fail(`falta src/${file}`);
    return null;
  }
  return transformModule(file);
});

// El orden de MODULES debe cubrir todas las dependencias.
const indexOf = Object.fromEntries(MODULES.map((name, i) => [name, i]));
transformed.filter(Boolean).forEach(({ file, imports }) => {
  imports.forEach(({ target }) => {
    const targetFile = target.replace(/^\.\//, '');
    if (!(targetFile in indexOf)) fail(`${file} importa './${target}' y ese modulo no esta en el paquete`);
    else if (indexOf[targetFile] > indexOf[file]) fail(`${file} importa './${target}' despues de su turno`);
  });
});

// Colisiones de nombres entre modulos: romperian el paquete plano.
const seen = new Map();
transformed.filter(Boolean).forEach(({ file, body }) => {
  const declared = [...body.matchAll(/^(?:const|let|function)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
  declared.forEach((name) => {
    if (seen.has(name) && seen.get(name) !== file) fail(`nombre duplicado '${name}' en ${file} y ${seen.get(name)}`);
    else seen.set(name, file);
  });
});

const css = readFileSync(join(ROOT, 'assets', 'estilos.css'), 'utf8');
const favicon = readFileSync(join(ROOT, 'favicon.svg'), 'utf8').trim();

// La CSP se relaja a 'unsafe-inline' porque ahora todo va incrustado; sigue sin red.
const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VozStudio Atlas - Prototipo navegable</title>
    <!-- GENERADO por scripts/empaquetar.mjs. No editar a mano: edita src/ o assets/estilos.css
         y vuelve a ejecutar el empaquetador. Version modular para desarrollo: dev.html -->
    <meta name="description" content="Prototipo visual navegable de VozStudio Atlas: produccion de contenido hablado 100% local." />
    <meta name="theme-color" content="#000000" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(favicon)}" />
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="app" class="shell" data-theme="omni"></div>
    <script>
(function () {
  'use strict';
  // Prototipo VozStudio Atlas empaquetado: sin red, sin CDN, sin modulos.
  // Este archivo se genera con scripts/empaquetar.mjs - no editar a mano.

// ---------------------------------------------------------------------------
// data.js
${MODULES.map((file) => `// ---------------------------------------------------------------------------
// ${file}
// ---------------------------------------------------------------------------
${transformed[MODULES.indexOf(file)].body}`).join('\n\n')}

// Hooks de verificacion: mismo contrato que la version por modulos.
window.__atlas = {
  state: window.__state,
  render: window.__render,
  navigate: window.__navigate,
  catalog: window.__catalog,
};
})();
    </script>
  </body>
</html>
`;

// Validaciones del resultado.
if (!html.includes('function render()')) fail('no se encontro render() en el paquete');
if ((html.match(/<script/g) || []).length !== 1) fail('debe haber exactamente un <script>');
if (/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, ''))) {
  fail('el paquete contiene URLs externas');
}
// Cero emojis en todo el paquete (norma del proyecto).
const emoji = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu);
if (emoji) fail(`el paquete contiene emojis: ${[...new Set(emoji)].join(' ')}`);

const sizeKb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`  css:     ${(Buffer.byteLength(css) / 1024).toFixed(0)} KB`);
transformed.filter(Boolean).forEach((m) => console.log(`  ${m.file.padEnd(8)} ${(Buffer.byteLength(m.body) / 1024).toFixed(0)} KB`));
console.log(`  total:   ${sizeKb} KB`);

if (failures.length) {
  console.log(`\n${failures.length} fallos: el paquete NO se escribe`);
  process.exit(1);
}

if (!process.argv.includes('--check')) {
  writeFileSync(OUT, html, 'utf8');
  console.log(`\nEscrito ${OUT}`);
} else {
  console.log('\nValidacion correcta (sin escribir)');
}
