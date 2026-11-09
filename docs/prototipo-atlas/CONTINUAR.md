# Cómo continuar este prototipo en otro chat

Este archivo existe para que un chat nuevo pueda retomar el trabajo sin releer la conversación
anterior. Todo lo necesario está en el repositorio.

## Qué hay hecho

| Entregable | Ruta | Estado |
| --- | --- | --- |
| Auditoría de la app real | `docs/MEJORAS_DETECTADAS.md` | completo |
| Propuesta VozStudio Atlas (21 secciones) | `docs/PROPUESTA_VOZSTUDIO_ATLAS.md` | completo |
| Prototipo navegable | `docs/prototipo-atlas/` | funcional, **12 pantallas** |

El prototipo es una SPA sin build y sin dependencias. La portada `index.html` es un
**archivo único autónomo**: el empaquetador `scripts/empaquetar.mjs` incrusta el CSS, los datos
y todo el JavaScript, de modo que se abre con doble clic (`file://`), como adjunto o dentro de un
visor de archivos, sin servidor. El fuente sigue modular en `src/` y `assets/estilos.css`, y
`dev.html` es la versión de desarrollo con `<script type="module">` (esa sí necesita HTTP).
No usa red, ni CDN, ni fuentes externas: funciona dentro de un iframe sandboxeado.

### Módulos del código

| Archivo | Responsabilidad |
| --- | --- |
| `src/app.js` | estado, router, 12 vistas, modales, interacciones |
| `src/ui.js` | componentes reutilizables (tarjetas, paginador, toasts, modal) |
| `src/brand.js` | **emblema único** para sidebar, icono de escritorio y splash |
| `src/data.js` | motores, recetas, proyectos, bloques, tomas |
| `src/voces.data.js` | catálogo de **34 voces** de los 8 motores |
| `src/prompts.data.js` | **1.110 prompts** de diseño de voz |
| `src/lectura.data.js` | 12 presets de lectura y el texto de ejemplo de 12.000 caracteres |
| `scripts/empaquetar.mjs` | incrusta CSS + datos + JS y genera la portada `index.html` |
| `dev.html` | versión modular para desarrollo (necesita servidor HTTP) |
| `favicon.svg` | icono de la app, generado desde el mismo emblema |
| `assets/muestra/` | pruebas en píxeles del emblema contra el icono real del escritorio |

## Cómo abrirlo

La portada se abre con doble clic: es un solo archivo, sin dependencias.

Para servirlo en local (red, móvil o un visor que espere URL):

```bash
cd docs/prototipo-atlas
python3 -m http.server 8123 --bind 0.0.0.0
```

Y abrir `http://localhost:8123/index.html`. Para trabajar sobre el fuente modular usa
`dev.html`, que sí necesita ese servidor porque usa `<script type="module">`.

Después de tocar `src/` o `assets/estilos.css`, se regenera la portada:

```bash
node scripts/empaquetar.mjs        # escribe index.html
node scripts/empaquetar.mjs --check   # valida sin escribir
```

El empaquetador falla -y no escribe nada- si un módulo importa a otro que va después en el
orden, si dos módulos declaran el mismo nombre (paquete plano), si queda un `import`/`export`
suelto, si aparece una URL externa, un identificador no ASCII o un emoji.

## Estado verificado

Comprobado con un DOM real (jsdom) sobre el HTML generado: **386 comprobaciones en catorce suites**
(189 sobre el fuente modular, 27 sobre el archivo único cargado como `file://`, 11 arrancando por
HTTP real, 23 sobre la estructura de columnas fijas, 21 sobre el comportamiento del scroll, 8
sobre el modelo de caja del shell, 38 sobre la reorganización de pantallas, 14 sobre la mecánica
de las bandejas y 53 sobre la rejilla exacta y la navegación inferior).

`check2.mjs` (estructura, 12 rutas, políticas), `flows.mjs` (interacciones), `selects.mjs`
(evento `change` real), `inputs.mjs` (campos numéricos) y `lectura2.mjs` (sliders y foco) cubren:

- Las 12 pantallas pintan sin `undefined`, `NaN` ni `[object Object]`.
- El **archivo único** arranca desde `file://` sin servidor: shell pintado, 12 rutas navegables,
  clicks reales, `change` del tema a AMOLED, 34 voces y cero recursos externos (`filetest.mjs`).
- **Columnas fijas**: la ventana no scrollea, la sidebar tiene su carril, el pie y el topbar
  quedan siempre visibles, y en las 12 pantallas la cabecera es el primer hijo de la pila y se
  pega arriba (`layout.mjs`, `scroll.mjs`, `box.mjs`).
- **Bandejas y listas** (`pantallas.mjs`, `tray.mjs`): Inicio en rejilla 3x4 con desplazamiento;
  Lectura en tres columnas 30/40/30 con los pasos repartidos; en Producir solo scrollea la lista
  de segmentos; en Biblioteca, Glosario, Lotes y Elenco solo el cuerpo con el `thead` fijo; y
  Voces, Recetas y Presets en bandeja de 8/8/12 con flechas, rueda, ratón y dedo.
- Pie fijo con `HUMAN AI SYNERGY BY BENNER CASTILLO` presente en todas las vistas.
- Sidebar, splash e icono de la app dibujan el **mismo emblema** (mismas barras y medidas).
- Splash funcional: INICIAR y "Entrar directo" lo cierran.
- Saludo de Inicio con **hora, fecha en texto y lugar** (Trujillo, La Libertad - Perú).
- Catálogo **completo**: 34 voces en 8 motores, sin exclusiones; recuento por motor
  contrastado contra los `get_voices()` reales de `src/ai/`.
- Módulo TTS: límite de 12.000 caracteres, contador en vivo, 12 presets, importación
  PDF/EPUB/TXT/DOCX/MD/SRT y generación por bloques.
- Diseño de voz: Qwen3 VoiceDesign (temperatura, top-p, semilla, max tokens) y CosyVoice
  Instruct-TTS (estilo, emoción, sampling K, ganancia, referencia zero-shot).
- Mejorador de prompt con IA visible y atribuido (Phi-3.5 o heurísticas).
- Biblioteca de **1.110 prompts**, búsqueda, familias, paginación y modo design/instruct.
- Tema **Negro AMOLED** con tokens propios.
- Escala tipográfica de 90 % a 130 % que **no borra el foco** ni desborda.
- Los **desplegables responden al evento `change`**, no al `click`.
- Los **campos numéricos persisten** (top-p, semilla, max tokens).
- Los **sliders de lectura mueven el cálculo** sin recrear el textarea.
- El **mismo emblema** en sidebar, favicon y splash, verificado comparando el PNG
  renderizado con el icono real del escritorio (aro, silueta y barras coinciden).
- Cero emojis, identificadores `data-*` en ASCII, claves de estado en ASCII, cero red externa.

## Decisiones que no conviene deshacer

1. **Router por `state.route`, sin hash.** `render()` pinta el shell completo en `#app`.
   Para refrescar un nodo suelto hay parches específicos (`paintBlocks`, `paintPlayer`,
   `pedidoDeResultados`). **No metas `render()` dentro de un `input`**: destruye el foco.
   Ya pasó dos veces y está resuelto así:
   - El buscador de prompts repinta solo `#prompt-results`.
   - El contador de lectura actualiza `#lectura-badge` y `#lectura-counter` por separado.
2. **Identificadores en ASCII, texto con tildes.** Las claves del estado y los valores de
   `data-action` van sin acentos (`grabacion`, `duracion`). Solo el texto visible lleva
   tildes. Un pase automático de acentos ya rompió `state.grabacion` una vez.
3. **`seeded()` mezcla la semilla antes de generar.** No lo cambies por un LCG simple:
   dejaba los 58 bloques en `aprobado` y la cola parecía muerta.
4. **El tema no repinta todo**: cambia `data-theme` en `#app` y guarda en `localStorage`
   bajo la clave `atlas-prototipo`.
5. **La escala de letra va por `data-font-scale`, nunca por `style`.** Asignar
   `app.style.setProperty(...)` es un error: el siguiente `innerHTML` borra los estilos en
   línea, pero no los atributos `data-*`. Todos los `font-size` del CSS usan tokens
   `--text-*`, así que la escala alcanza a toda la interfaz.
6. **`createToasts()` resuelve el contenedor en cada pintado.** Si se captura
   `document.body` al crear el store, `render()` escribe los avisos en el `<body>` y
   **borra la aplicación entera** antes de que exista `#app`.
7. **Separador decimal `es-ES`.** `toLocaleString('es-PE')` devuelve `12,000`, que en
   español se lee como doce. Para miles se usa `es-ES` (`12.000`).
8. **Los `<select>` y las casillas se resuelven en `change`, nunca en `click`.** Un
   desplegable no emite `click` al elegir una opción: si se enchufa al click se queda con
   el valor anterior y parece que «no hace nada». Todo control de formulario vive en el
   manejador de `change`; el de `click` es solo para botones.
9. **El emblema se dibuja en `src/brand.js`, en un único sitio.** `appMark(size)` sirve al
   sidebar (38 px), al pie (18 px) y al splash (140 px), y `appMarkPlain()` alimenta
   `favicon.svg` y `APP_ICON_URI`. La geometría está calcada de
   `scripts/launcher/generate_icon.py`; si se cambia allí, hay que cambiarla aquí.
   Por debajo de 22 px el emblema va en color plano y con el aro fino, o las barras
   desaparecen al reducir.
10. **Los campos numéricos necesitan su propio `case` en el handler de `input`.** Un
    `<input type="number">` con `data-action` y sin manejador no guarda nada y el valor
    se pierde al repintar.
11. **Uso personal declarado.** Ni MMS (CC-BY-NC-4.0) ni XTTS (CPML) se ocultan ni se
    excluyen: se muestran marcados. `licenseForRole()` ya no marca error, solo informa.
12. **Honestidad de parámetros.** El backend real acepta `voice_design_prompt`,
    `instruct_prompt` y `temperature`; **no** acepta `top_p` ni `seed`. En la UI esos dos
    campos llevan la etiqueta `planificado` y un aviso que explica qué viaja hoy. No los
    presentes como si funcionaran: es justo el tipo de mentira que la propuesta critica.

13. **La ventana no scrollea nunca: solo el cuerpo de la vista.** La sidebar es una
    columna fija con su propio carril; el topbar y el pie son fijos por construcción
    (filas 1 y 2 de la rejilla, sin `position: sticky`); y de cada pantalla solo se
    desplaza lo que va por debajo de su primera sección. Cada vista es un `.stack-4` /
    `.stack-3` cuyo **primer hijo es la cabecera** (saludo, título y acciones), y esa
    cabecera se pega arriba con `position: sticky` y fondo opaco `var(--bg)`. No añadas
    contenido antes de ese primer hijo: quedaría oculto tras la cabecera.
    El scroll es **invisible** (`scrollbar-width: none` y `::-webkit-scrollbar` a 0).
    Ojo con dos cosas: `html`/`body` llevan `overflow: hidden` (si se quita, reaparece la
    barra externa) y `.main` debe conservar `min-height: 0`, porque su regla base traía
    `min-height: 100vh` y con el pie en su fila eso empujaría el pie fuera de la ventana.
    `navigate()` reinicia `#content.scrollTop` para que cada pantalla empiece arriba.

14. **Cada bandeja muestra exactamente sus tarjetas, y los botones van debajo.**
    `carrusel()` recibe `porVista` y `cols`, y emite `--tray-cols` y `--tray-rows`
    en el propio viewport: 12 tarjetas son 4x3, 8 son 4x2 y los 8 motores 4x2.
    La rejilla no se estira ni se encoge: lo que no cabe vive a la derecha y se
    alcanza desplazando, con `scroll-snap` obligatorio para que siempre encaje
    una página completa. La navegación (`<` `>` y el contador `1 / 5 · 34 voces`)
    va en un `.tray-nav` **después** del viewport, nunca flotando a los lados.
    `moveTray()` mide la página como columnas x ancho + huecos, sincroniza las
    flechas al instante (no solo tras la animación) y no pasa del final.
    Todas las tarjetas de una fila llevan `height: 100%` para que una más alta
    no descuadre las tres filas.
    Bandejas: proyectos 12, voces 8, motores 8, recetas 8, presets de cliente 12.

    Se mueve también con la rueda, el arrastre del ratón y el dedo
    (`attachTrayDrag`, enganchado una sola vez en el arranque). En táctil **no** se
    secuestra el gesto: manda el scroll nativo. Ojo: `syncTrays()` no apaga la flecha
    siguiente si `scrollWidth` aún vale 0, porque en un render temprano la bandeja se
    quedaría muerta para siempre.

15. **Solo se desplaza la lista, nunca el encabezado.** Las listas llevan
    `data-scroll-area` y su `thead` es `sticky`. Producir tiene su propio carril en
    `#block-list`; Biblioteca, Glosario, Lotes y Elenco lo tienen en el cuerpo de la
    tabla. Para que el scroll exista de verdad, la lista necesita un tope de altura
    (se acota a `100dvh` menos topbar, pie y cabecera): sin tope crece y no hay nada
    que desplazar.
16. **Lectura va en tres columnas 30 / 40 / 30.** Paso 1 solo en la primera; paso 2
    más la bandeja de importación en la segunda; paso 3 más entregables en la tercera.
    Cada columna tiene su propio carril. Esto obliga a dos cosas: la pantalla lleva
    `.screen-fill` (si no, la rejilla no tiene altura que repartir y las columnas
    crecen sin scroll) y `.read-grid` usa `align-items: stretch`, no `start`.
    Por debajo de 1280 px vuelve a una sola columna con scroll normal.
17. **Los datos de ejemplo crecieron para que las bandejas tengan qué desplazar.**
    Proyectos pasó de 5 a 14 y presets de cliente de 4 a 15: con menos de 12 por vista
    las flechas nunca aparecían y el desplazamiento era decorativo.

## Pendientes y ampliaciones posibles

- **Capturas de pantalla de la interfaz**: no hay `libnss3` en el sandbox y los
  repositorios de Debian no son accesibles, así que Chromium no arranca. Lo que sí está
  verificado en píxeles es **el emblema**: `favicon.svg` se renderizó con sharp y se
  comparó contra el icono real del escritorio a 18, 38 y 140 px; las imágenes están en
  `assets/muestra/`. Las vistas siguen
  validadas por DOM y por reglas de CSS. **Pendiente prioritario.**
  Si el entorno permite `apt-get install libnss3 libnspr4`, se desbloquea:
  `npx playwright install chromium` y captura de las 12 rutas.
- **Repasar tildes en textos secundarios** de `src/data.js` (descripciones de recetas y
  guiones de ejemplo). Los módulos nuevos ya están escritos sin tildes por política ASCII
  en identificadores; el texto visible de `voces.data.js` y `prompts.data.js` también usa
  ASCII puro y se puede acentuar sin tocar identificadores.
- **Enlazar el prototipo desde `README.md` y desde la propuesta** (sigue pendiente).
- **Modo estrecho por debajo de 860 px**: hay reglas nuevas por debajo de 640, 720, 860,
  980, 1100, 1280 y 1500 px, pero no se han probado en un navegador real.
- Sustituir la simulación de "generar audio" por un reproductor de WAV de verdad
  (`offlinePreviewWav.ts` de la app real es el punto de partida natural).

## Prompt sugerido para el chat nuevo

> Lee `docs/prototipo-atlas/CONTINUAR.md` y `docs/PROPUESTA_VOZSTUDIO_ATLAS.md`. El prototipo
> navegable está en `docs/prototipo-atlas/` y ya funciona. Quiero [lo que quieras hacer].
> Mantén la política cero emojis, los identificadores en ASCII y la coherencia con la
> propuesta.

## Verificación rápida tras cualquier cambio

```bash
cd docs/prototipo-atlas
for f in src/*.js; do node --input-type=module --check < "$f"; done
# llaves del CSS y tamanos por debajo de 12 px
python3 -c "import re,pathlib;c=pathlib.Path('assets/estilos.css').read_text();print('llaves',c.count('{')==c.count('}'),'| <12px',[s for s in {float(x) for x in re.findall(r'font-size:\s*([\d.]+)px',c)} if s<12])"
```

Y abrir la página: si hay un error de sintaxis, la pantalla queda en blanco.
Las suites de verificación (`check2`, `flows`, `selects`, `inputs`, `lectura2`, `filetest`,
`httptest`, `layout`, `scroll`, `box`, `pantallas`, `tray`, `rejilla`, `rejilla2`) se ejecutan
con jsdom instalado aparte (`npm install jsdom`) y **no** forman parte del repositorio: el
prototipo no tiene dependencias. Recuerda neutralizar `setInterval`/`setTimeout` en el
arnés: `tickSystem`, la cola y el splash dejan temporizadores vivos que impiden salir a node.

Para comparar el emblema con el icono real:

```bash
python3 scripts/launcher/generate_icon.py          # escribe scripts/launcher/vozstudio.ico
# extrae la capa de 256 px y compárala con favicon.svg renderizado (sharp o rsvg)
```
