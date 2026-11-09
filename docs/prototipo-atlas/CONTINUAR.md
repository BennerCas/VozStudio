# Cómo continuar este prototipo en otro chat

Este archivo existe para que un chat nuevo pueda retomar el trabajo sin releer la conversación
anterior. Todo lo necesario está en el repositorio.

## Qué hay hecho

| Entregable | Ruta | Estado |
| --- | --- | --- |
| Auditoría de la app real | `docs/MEJORAS_DETECTADAS.md` | completo |
| Propuesta VozStudio Atlas (21 secciones) | `docs/PROPUESTA_VOZSTUDIO_ATLAS.md` | completo |
| Prototipo navegable | `docs/prototipo-atlas/` | funcional, 11 pantallas |

El prototipo es una SPA sin build y sin dependencias: `index.html` carga
`assets/estilos.css` y `src/app.js` como módulo. Los datos simulados viven en `src/data.js`.
No usa red, ni CDN, ni fuentes externas: funciona dentro de un iframe sandboxeado.

## Cómo abrirlo

```bash
cd docs/prototipo-atlas
python3 -m http.server 8123 --bind 0.0.0.0
```

Y abrir `http://localhost:8123/index.html`. Debe servirse por HTTP porque usa
`<script type="module">`; abrir el archivo con `file://` falla por CORS.

## Estado verificado

Comprobado con un DOM real (jsdom) sobre el HTML generado: 43 de 43 comprobaciones
correctas. Cubre navegación por las 11 pantallas, cambio de proyecto, edición de un bloque
conservando el foco, aprobación, cola que avanza sola, elección de toma, modales, gate de
consentimiento, paleta de comandos, atajos y temas.

También verificado:

- Política CERO EMOJIS: 0 violaciones en `src/`, `tests/`, `scripts/`, `docs/`.
- Sin marcadores `undefined`, `NaN` ni `[object Object]` en ninguna vista.
- `state` nunca muta los datos de `data.js` en el arranque.

## Decisiones que no conviene deshacer

1. **Router por `state.route`, sin hash.** `render()` pinta el shell completo en `#app`.
   Para refrescar un nodo suelto hay parches específicos (`paintBlocks`, `paintPlayer`,
   `paintQueue`, `paintProduceCounters`). No metas `render()` dentro de un `input`:
   destruye el foco del textarea.
2. **Identificadores en ASCII, texto con tildes.** Las claves del estado y los valores de
   `data-action` van sin acentos (`grabacion`, `duracion`). Solo el texto visible lleva
   tildes. Un pase automático de acentos ya rompió `state.grabacion` una vez: si vuelves a
   acentuar en masa, excluye identificadores y valores de atributos.
3. **`seeded()` mezcla la semilla antes de generar.** El generador anterior tenía
   correlación entre semillas consecutivas y dejaba los 58 bloques en `aprobado`, con lo que
   la cola parecía muerta. No lo cambies por un LCG simple.
4. **El tema no repinta todo**: cambia `data-theme` en `#app` y guarda en `localStorage`
   bajo la clave `atlas-prototipo`.

## Qué falta o se puede ampliar

- Capturas de pantalla reales: no hay navegador con `libnss3` en el sandbox, así que la
  validación visual quedó pendiente. La verificación fue por DOM, no por píxeles.
- Repasar tildes en textos secundarios (quedan algunas palabras llanas sin tilde en
  `data.js`, sobre todo en descripciones de recetas y guiones de ejemplo).
- Pulir el modo estrecho por debajo de 1024 px: hay reglas, pero no se han probado.
- Enlazar el prototipo desde `README.md` y desde la propuesta.

## Prompt sugerido para el chat nuevo

> Lee `docs/prototipo-atlas/CONTINUAR.md` y `docs/PROPUESTA_VOZSTUDIO_ATLAS.md`. El prototipo
> navegable está en `docs/prototipo-atlas/` y ya funciona. Quiero [lo que quieras hacer].
> Mantén la política cero emojis, los identificadores en ASCII y la coherencia con la
> propuesta.

## Verificación rápida tras cualquier cambio

```bash
cd docs/prototipo-atlas
node --input-type=module --check < src/app.js
node --input-type=module --check < src/data.js
```

Y abrir la página: si hay un error de sintaxis, la pantalla queda en blanco.
