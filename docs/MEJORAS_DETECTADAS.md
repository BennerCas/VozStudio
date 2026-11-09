# VozStudio Omni-ES - Analisis de producto y lista completa de mejoras

> Auditoria de producto, UX, funciones, interfaz y calidad tecnica realizada sobre el
> arbol de trabajo (`src/`, `tests/`, `scripts/`, `docs/`) el 2026-11-09.
>
> Cada hallazgo indica **donde esta**, **por que importa** y **que hacer**.
> Prioridades: **P0** = rompe o engana la promesa del producto, **P1** = friccion
> grave o riesgo de calidad, **P2** = pulido y consistencia, **P3** = evolucion.

---

## 0. Resumen ejecutivo

La ingenieria de inferencia (separacion de motores, politica Zero-OOM, serializacion
DirectML, normalizacion fonetica, path traversal defensivo, libreria auditada) esta
muy por encima de la media. **El problema no esta en el motor, esta en la capa de
producto**: la interfaz que se ejecuta hoy no es la interfaz descrita en la
documentacion, y varias de sus piezas comunican datos que no son reales
(telemetria fija, segmentacion decorativa, controles que no cambian el resultado).

Top 5 hallazgos por impacto:

1. **Hay dos aplicaciones**: `main.tsx` monta `FigmaMakeApp.tsx` (4.498 lineas) y todo
   `App.tsx` + `components/` (2.558 lineas) quedo como codigo muerto, pero la
   documentacion (README, `ARQUITECTURA.md`, `AUDITORIA.md`) certifica la version
   muerta.
2. **La UI afirma cosas falsas**: GPU 68 %, RAM 13,4/32 GB, CPU 42 %, "1.8 GB" de VRAM
   liberable, "8/8" modelos sanos y contadores 31/40/40 estan escritos a mano.
3. **El estudio ocupa las 4 columnas** y oculta la zona central (`.studio-center`),
   de modo que dos de los tres modos del producto (Laboratorio Zero-Shot y DNA
   Design) solo son alcanzables a traves de la columna de clonacion.
4. **La segmentacion es decorativa**: los botones "Bloque 1/3, 2/3, 3/3" no hacen
   nada, "Sintetizar bloque" y "Sintetizar todo" ejecutan exactamente la misma funcion
   y el texto no se normaliza ni se previsualiza antes de enviarlo.
5. **La tipografia base del producto es de 7-10 px** (61 reglas a 8 px, 27 a 7 px,
   2 a 5 px). En una estacion de escritorio professional esto es inaccesible.

Referencia de esfuerzo: S = horas, M = 1-3 dias, L = 1-2 semanas.

---

## 1. Arquitectura de la interfaz (P0)

### 1.1 Una sola aplicacion, un solo camino de arranque

- **Hallazgo.** `src/main.tsx` renderiza `FigmaMakeApp`. `App.tsx` solo lo importa
  `WorkspaceHub.tsx`, y `WorkspaceHub.tsx` no lo importa nadie. Ademas
  `hooks/useFitCount.ts`, `hooks/useViewportGuard.ts`, `hooks/useVoiceRecorder.ts`,
  `utils/textSegmenter.ts`, `utils/wavEncoder.ts`, `services/offlinePreviewWav.ts`,
  `data/presetCatalog` (via App) y los 10 componentes de `components/` estan fuera
  del grafo de la app viva.
- **Por que importa.** Mantenimiento doble, ~7.000 lineas que ningun test de UI
  cubre, y una documentacion que describe una UI que el usuario nunca ve. Cualquier
  mejora futura se puede implementar en el archivo equivocado sin que nadie lo note.
- **Que hacer.**
  1. Decidir cual es la UI canonica (recomendado: `FigmaMakeApp` como base porque es
     la que se prueba en E2E, y **rescatar** de `App.tsx` las piezas superiores:
     segmentador reactivo, `Paginator`, `Waveform` con canvas real, `OrientationGuard`).
  2. Borrar el resto y actualizar imports.
  3. Reescribir README/ARQUITECTURA/AUDITORIA para reflejar la UI real (los tres
     documentos afirman cosas que ya no existen, ver 1.2).
  4. Renombrar `FigmaMakeApp.tsx` a algo semantico (`StudioApp.tsx`) y **partirlo**
     por dominio: `pages/Studio`, `pages/DnaDesign`, `pages/Presets`, `pages/Batch`,
     `pages/Voices`, `pages/Settings`, `pages/Dashboard`, mas `shell/`.
- **Esfuerzo.** M.

### 1.2 Documentacion desalineada de la realidad

- **Hallazgo.** `docs/AUDITORIA.md` certifica `.studio-stage-16-9`, `ComposerPanel`
  con `ResizeObserver`, `OrientationGuard`, iconos `lucide-react`, `overflow:hidden`
  global y bundle `231 kB / 43 kB`; nada de eso describe el build actual. El build
  medido hoy es `263,82 kB JS (78,47 kB gzip)` y `141,88 kB CSS (25,84 kB gzip)`
  porque el JSX vivo usa casi exclusivamente clases propias (`.quick-grid`,
  `.studio-editor`, `.preset-card`...) y ninguna utilidad Tailwind, mientras el CSS si
  importa `tailwindcss`.
- **Por que importa.** La auditoria es un documento de certificacion; si certifica
  artefactos inexistentes, pierde todo su valor probatorio.
- **Que hacer.** Regenerar `AUDITORIA.md` desde mediciones reproducibles (script que
  emita tamano de bundle, conteo de reglas, resultados de tests) y marcar cada
  seccion con fecha de medicion. Ver 6.6 y 6.3.
- **Esfuerzo.** S.

### 1.3 Politica "16:9 cero scroll" decidida en dos sitios a la vez

- **Hallazgo.** El estudio fuerza `height: calc(100vh - 232px)` (linea 426 del CSS) y
  mantiene la bandera `orientacion`/`orientation-guard` en el codigo muerto. Es una
  restriccion de diseno que hoy se implementa con numeros magicos por pantalla
  (`.content`, `.content.studio-content`, `.content.presets-content`, cada una con su
  propio `calc`).
- **Por que importa.** Cada nueva pantalla obliga a inventar otro `calc`, y en
  portatiles de 1366x768 el estudio entra en modo "auditoria debajo" con alturas
  distintas a 1080p (ver 3.1).
- **Que hacer.** Un unico layout primitivo `WorkspaceFrame` con `grid-template-rows:
  header / main / footer` y `dvh` en vez de `vh`; que cada pagina declare que
  necesita ("fija" o "fluida") y que el frame decida. Eliminar el scroll como
  objetivo global y sustituirlo por "sin scroll en el flujo principal, scroll interno
  en listas" (que es lo que realmente hace falta).
- **Esfuerzo.** M.

---

## 2. Logica de producto y funciones (P0/P1)

### 2.1 El estudio tiene 4 columnas, pero el producto tiene 3 modos

- **Hallazgo.** `concept = "A"` esta fijado en codigo (`FigmaMakeApp.tsx:1791`), lo que
  activa `studio-layout-four` y la regla `.studio-layout-four > .studio-center { display:
  none }`. El modo por defecto se puede conmutar desde la barra de tabs del
  `.studio-center`... que esta oculto. Los dos unicos caminos de entrada a los modos
  son: (a) clicar un motor de clonacion, que cambia `mode` solo; (b) pulsar "Ejecutar
  clonacion Zero-Shot" en la columna 3.
- **Por que importa.** El usuario no puede elegir "DNA Design" desde el estudio, y el
  flujo "Sintetizar bloque" del modo directo esta reimplementado dentro de la columna
  02 (con su propio duplicado de presets, segmentos, editor y controles: lineas
  2336-2427 **y** 2631-2760). Los dos bloques muestran estados distintos porque
  comparten `script`/`speed`/`emotion` pero no el resto.
- **Que hacer.**
  1. Reemplazar el ternario `concept === "A"` por estado real persistido, o mejor,
     eliminar los conceptos B/C/D/E del codigo de produccion (hoy son codigo muerto
     condicionado a una constante).
  2. Quedarse con un unico conjunto de controles por modo y una unica ubicacion para
     ellos: columna izquierda = recursos (motores, timbres), centro = editor + controles
     + salida, derecha = inspector y biblioteca.
  3. Si se quiere conservar la idea de "4 columnas", debe ser una vista opcional
     ("vista experta") con un toggle persistido, no el layout por defecto.
- **Esfuerzo.** M.

### 2.2 Segmentacion falsa

- **Hallazgo.** `.segment-bar` y `.four-segments` pintan tres botones "Bloque 1/3",
  "Bloque 2/3", "Bloque 3/3" con `className="active"` fijo en el primero y sin
  `onClick`. No existe calculo de segmentos en la UI viva: `utils/textSegmenter.ts`
  (163 lineas) esta muerto. En el backend el troceado real ocurre en
  `prepare_spanish_chunks` con `max_chars` fijo (260 por defecto; 460 en
  `/normalize-preview`, 520 en presets).
- **Por que importa.** Se promete control por bloques y no existe; ademas el usuario
  no puede saber cuantos bloques se generaran ni editarlos.
- **Que hacer.**
  1. Llamar a `/api/v1/normalize-preview` (endpoint ya implementado y **sin uso en la
     UI viva**) con debounce de 400 ms mientras se escribe.
  2. Pintar los segmentos reales, permitir navegar, editar y marcar "solo este
     bloque" para sintetizar.
  3. Enviar `max_chunk_chars` coherente con lo mostrado.
  4. Ofrecer un "modo normalizacion" (ver el texto tal como se pronunciara: cifras,
     divisas, horas, siglas) porque hoy es una caja negra y es la causa numero uno de
     audios "raros".
- **Esfuerzo.** M.

### 2.3 "Sintetizar bloque" y "Sintetizar todo" son el mismo boton

- **Hallazgo.** Ambos llaman a `runDirect()` (`FigmaMakeApp.tsx:2412-2420` y 2745-2754),
  que envia `script` completo. Ninguno de los dos deshabilita al otro mientras hay
  trabajo, y el segundo no tiene `disabled={isBusy}` en el modo directo (lineas 2745+).
- **Que hacer.** Un unico CTA primario ("Generar") + un menu secundario con "generar
  solo el bloque actual", "generar por bloques y unir", "generar y descargar cada
  bloque". Deshabilitar todo el grupo mientras `isBusy`.
- **Esfuerzo.** S.

### 2.4 Los presets "Tonos" existen en la UI y no existen en el motor (P1)

- **Hallazgo.** La UI ofrece `NEUTRO / NARRATIVO / CALIDO / INFORMATIVO / EXPRESIVO` y
  envia `emotion.toLowerCase()`, que en espanol lleva tilde (`"calido"` no es
  `"cálido"`). `kokoro_engine._EMOTION_SPEED_FACTOR` y
  `cosyvoice_engine._EMOTION_PROFILES` solo tienen claves sin tilde, y el resto de
  motores (piper, mms, f5, qwen3, xtts) **ignoran `params.emotion` por completo**.
  Resultado: en Kokoro el matiz CALIDO cae al perfil neutro (solo aplica el factor por
  defecto), y en Piper/MMS/F5/Qwen3/XTTS no hace absolutamente nada.
- **Por que importa.** Es una promesa de producto ("MATIZ") que hoy es, en el mejor
  caso, un control de velocidad duplicado.
- **Que hacer.**
  1. Normalizar con `unicodedata` en el orquestador antes de pasar `emotion` a los
     motores (un solo lugar, no en cada adaptador).
  2. Declarar capacidades por motor (`supports_emotion` ya existe en el descriptor de
     voz) y **ocultar/deshabilitar** el selector cuando el motor no la soporta, con
     tooltip explicando el motivo.
  3. Documentar en la ficha del motor que "matiz" = factor de velocidad + K de sampling
     (para no venderlo como emoción real) y enlazar a "para emoción real usa DNA
     Design con instruccion".
  4. Si se quiere emoción real en Kokoro, explorar style vectors (las "mezclas
     personalizadas" ya estan descritas en el README): exponerlas como sliders.
- **Esfuerzo.** S-M.

### 2.5 El prompt de "Mejorar con AI local" y el modelo Phi no aparecen en el estado del sistema

- **Hallazgo.** `prompt_enhancer` carga Phi-3.5 en el mismo proceso del backend con
  un `threading.Lock` global y cae a heuristicas silenciosas. La UI solo dice
  "PHI - DIRECTML LOCAL" de forma fija (`FigmaMakeApp.tsx:3300`).
- **Por que importa.** Si Phi no esta instalado (lo normal), el usuario cree que uso
  IA y en realidad recibio una plantilla heuristica. Ademas el LLM compite por RAM/VRAM
  con el motor TTS y no pasa por `MemoryManager`, rompiendo la politica Zero-OOM.
- **Que hacer.**
  1. Devolver en `/api/v1/system/status` un bloque `capabilities` con la
     disponibilidad real de Phi y del motor activo.
  2. En la UI, mostrar el `engine_used` que ya devuelve el endpoint
     (`EnhancePromptResponse.engine_used`): "phi-3.5-mini (DirectML)" vs
     "heuristicas acusticas".
  3. Integrar Phi en `MemoryManager` (o cargarlo en un runtime aislado como Qwen/F5).
- **Esfuerzo.** S (UI) / M (memoria).

### 2.6 Los lotes piden datos por `window.prompt`

- **Hallazgo.** `BatchPage.runBatch` usa `window.prompt` dos veces (lineas 1166 y 1173)
  para pedir el texto objetivo y la transcripcion. Un `prompt` nativo, bloqueante y
  sin validacion.
- **Que hacer.** Formulario en la propia pagina: textarea de guion, transcripcion
  opcional por archivo (o una global), y un paso de revision con la lista de trabajos
  antes de encolar. Anadir pausar/cancelar/reintentar por elemento (hoy solo existe un
  bucle secuencial sin cancelacion).
- **Esfuerzo.** S.

### 2.7 El lote no persiste ni es auditable

- **Hallazgo.** `completed`/`failed` viven en memoria del componente, y el resultado se
  pierde al navegar. La barra dice "Procesando N/M" mezclando indice global con
  eventos fallidos.
- **Que hacer.** Cola persistida (por proyecto), estado por item (`pendiente / en
  curso / ok / error / cancelado`), errores legibles, y enlace directo a la entrada de
  biblioteca generada. Opcional: procesar de noche y notificar.
- **Esfuerzo.** M.

### 2.8 "Mis voces" no puede escuchar una voz

- **Hallazgo.** El boton "Escuchar" solo hace `setPlayingVoice` y lanza un toast
  pidiendo ir al estudio (linea ~1065). Y la lista se reconstruye desde la API en cada
  montaje, ignorando el `localStorage` que se sigue escribiendo (`vozstudio-voices`).
- **Que hacer.**
  1. Boton "Escuchar" real: generar una frase corta fija (p. ej. 1 frase de 6 s) con
     esa voz/motor y cachearla en `biblioteca/` la primera vez.
  2. Eliminar el `localStorage` de voces (fuente de verdad unica: API).
  3. Agregar busqueda y filtros funcionales (hoy `input` sin `onChange`, botones
     "Todas/Clonadas/Disenadas" sin logica) o quitarlos.
- **Esfuerzo.** S-M.

### 2.9 El telefono de la UI al backend no usa el estado del sistema

- **Hallazgo.** `studioApi.getSystemStatus()` existe y solo lo usa el codigo muerto.
  La UI viva no muestra `active_provider`, `estimated_engine_mb`, `ram_available_gb`
  ni `dml_available`, que es justo lo que el usuario tecnico necesita para decidir.
- **Que hacer.** Panel de estado real en la barra superior o en Configuracion:
  proveedor activo (DirectML vs CPU), motor residente, MB estimados, RAM disponible y
  boton "Liberar memoria" que muestre el resultado real (`unloadEngines` ya devuelve
  `unloaded: boolean`).
- **Esfuerzo.** S.

### 2.10 Falta el viaje de ida y vuelta de un audio de la biblioteca

- **Hallazgo.** Una entrada de biblioteca se puede escuchar, descargar y borrar, pero
  no se puede: reutilizar su texto, reutilizar sus parametros, cambiarle la voz, ni
  exportar varios. Tampoco hay multiseleccion ni borrado masivo.
- **Que hacer.**
  1. "Reusar receta": carga `prompt_original` + `parametros` en el editor.
  2. "Regenerar con otra voz" (A/B real, ver 4.9).
  3. Multiseleccion + exportar (WAV/JSON/CSV de metadatos) + borrado masivo.
  4. Etiquetas y colecciones por proyecto para que la biblioteca escale.
- **Esfuerzo.** M.

### 2.11 "Proyectos" es decorativo

- **Hallazgo.** `ProjectsPage` lee/escribe solo `localStorage`. Los botones "Crear
  proyecto", "Ver todos", "Buscar proyectos" y los filtros no hacen nada funcional;
  el Dashboard pinta tres proyectos hardcodeados con progreso inventado.
- **Por que importa.** Proyectos es la unica forma de agrupar generaciones y hoy no
  toca el backend, asi que la promesa "organiza guiones, voces, versiones" es falsa.
- **Que hacer.** Decidir: (a) **eliminar** la seccion hasta que exista un modelo de
  datos, o (b) implementar proyecto como carpeta de biblioteca (`biblioteca/` con
  subcarpetas o campo `proyecto` en el JSON) con endpoints `GET/POST/DELETE
  /projects` y un selector de proyecto activo en el shell. La opcion (b) es la que
  justifica el producto; el JSON auditado ya es el sitio natural para el campo.
- **Esfuerzo.** M-L.

### 2.12 Dashboard con datos que no son del usuario

- **Hallazgo.** "Buenos dias, Benner" fijo; tres proyectos y "Documental Patagonia -
  Escena 08" hardcodeados; el play del "now playing" solo anima. El saludo ni siquiera
  cambia con la hora.
- **Que hacer.** Dashboard alimentado por: ultimos 5 audios de la biblioteca real,
  contadores reales (`getLibrary().length`, voces personalizadas), y acciones rapidas
  que funcionan. Si no hay datos: estado vacio con el primer paso recomendado.
- **Esfuerzo.** S.

### 2.13 Configuracion que no configura nada

- **Hallazgo.** `SettingsPage` escribe `vozstudio-settings` en `localStorage` y nada
  mas; el backend lee esos valores de `.env`/variables de entorno al arrancar.
  "Dispositivo DirectML" (GPU 0/GPU 1), "Sample rate", "Formato", "Normalizacion",
  "Crossfade", "Modo 100 % offline" y "Auditoria JSON" son `<select>`/`<Toggle>` sin
  efecto. "Fallback CPU seguro" esta siempre en `true` y su `onChange` es
  `() => undefined`.
- **Por que importa.** Es la pantalla donde un usuario tecnico confia para tocar
  rendimiento. Guardar en silencio algo que no se aplica es peor que no ofrecerlo.
- **Que hacer.**
  1. Separar **lo que se puede aplicar en caliente** (hilos de CPU, dispositivo
     DirectML: requieren recargar sesiones, ya soportado por `create_onnx_session_with_fallback`)
     de **lo que es solo informativo** (rutas, licencias).
  2. Anadir `PUT /api/v1/config` que valide y persista en `.env` (o en un
     `config.local.json`), y que devuelva "requiere reiniciar" cuando aplique.
  3. Quitar los controles sin efecto o marcarlos como "solo lectura / informativo".
  4. Rutas: mostrar las reales desde `AppConfig` (hoy son texto de Windows
     hardcodeado).
- **Esfuerzo.** M.

### 2.14 Sin atajos de teclado ni comandos

- **Hallazgo.** El topbar muestra `Cmd K` como decoracion; no hay handler de teclado
  global. No hay `Ctrl+Enter` para generar, `Ctrl+S` para guardar, `Esc` para cerrar
  nada, ni navegacion por bloques.
- **Que hacer.** `Ctrl/Cmd+Enter` generar, `Ctrl/Cmd+K` palette (buscar voces, audios,
  presets, acciones), `J/K` navegar la biblioteca, `space` play/pause, `?` ayuda. La
  palette es la forma mas barata de hacer usable un producto con 8 motores y 40
  presets.
- **Esfuerzo.** S-M.

### 2.15 Sin drag & drop

- **Hallazgo.** La zona de carga dice "Arrastra tus archivos aqui"
  (`FigmaMakeApp.tsx` BatchPage) pero no existe `onDrop`/`onDragOver` en todo el
  proyecto. Lo mismo en la semilla del laboratorio.
- **Que hacer.** Componente `DropZone` reutilizable con estados (idle, hover, error de
  formato, validando duracion).
- **Esfuerzo.** S.

### 2.16 Toast sin semantica y con timers en carrera

- **Hallazgo.** `notify` hace `setTimeout(() => setToast(""), 2600)` sin cancelar el
  anterior: dos mensajes seguidos y el primero borra el segundo antes de tiempo.
  El contenedor no tiene `role="status"`/`aria-live` (0 ocurrencias en todo el
  proyecto).
- **Que hacer.** Cola de toasts (o uno solo con `key`), `role="status"` +
  `aria-live="polite"`, `aria-atomic`, variantes error/exito/info y duracion mayor
  para errores.
- **Esfuerzo.** S.

### 2.17 Sin estados de carga ni progreso en sintesis

- **Hallazgo.** `isBusy` deshabilita botones y cambia el texto de algunos, pero no hay
  spinner, barra de progreso ni tiempo estimado. La sintesis de un texto largo con
  Qwen/F5 puede tardar minutos y la UI parece congelada. Tampoco hay forma de
  cancelar.
- **Que hacer.**
  1. Progreso real: el backend ya sabe cuantos `chunks` hay; exponer un endpoint
     `POST /api/v1/jobs` con estado consultable, o un SSE/WebSocket de progreso por
     bloque.
  2. Estado "generando bloque 3 de 7" con ETA basada en RTF medido.
  3. Boton cancelar.
- **Esfuerzo.** M-L.

### 2.18 El laboratorio zero-shot usa un motor "recomendado" que puede no existir

- **Hallazgo.** `runClone` toma el primero disponible de
  `["f5_spanish","cosyvoice","xtts_v2","qwen3_tts"]` **ignorando `available`**; si
  ninguno esta en el catalogo usa el motor seleccionado (Kokoro), que no clona. El
  aviso de recomendacion ademas se pinta con `engine.id === "kokoro" ? "F5-Spanish" :
  engine.short`, es decir texto inventado.
- **Que hacer.** Derivar el motor de clonacion del catalogo real
  (`engines.filter(e => e.available && e.category === "clone")`), mostrarlo con su
  estado ("disponible" / "requiere `.runtimes/`"), y bloquear el CTA con explicacion
  cuando no haya ninguno.
- **Esfuerzo.** S.

### 2.19 Validaciones de entrada dispersas y asimetria entre endpoints

- **Hallazgo.** `/synthesize` valida con Pydantic estricto (`extra="forbid"`), pero
  `/clone`, `/dna/synthesize` y `/voices/custom` reciben `Form(...)` sueltos sin
  modelo. Ademas:
  - `/clone` acepta `reference_text` de hasta 1200 caracteres pero aqui no se valida
    que exista audio hasta ya dentro del motor.
  - `/synthesize` no admite `reference_audio` (JSON), asi que una voz personalizada
    registrada solo se usa como "semilla inyectada" por el orquestador, sin que la UI
    lo refleje.
  - El mensaje de duracion dice "entre 1 y 30 segundos" mientras el codigo acepta
    0.8-35 s.
- **Que hacer.** Un modelo Pydantic por endpoint (`CloneRequest`, `DnaSynthesisRequest`,
  `CustomVoiceRequest`) con dependencias `Form`, un unico validador de audio
  (`validate_reference_wav`) reutilizado en los tres sitios, y mensajes generados a
  partir de las constantes (sin textos duplicados).
- **Esfuerzo.** S-M.

### 2.20 `synthesize_dna` guarda una "voz" a partir del audio generado

- **Hallazgo.** En `/dna/synthesize` con `save_as_custom=True` se registra el **audio
  sintetizado** como semilla de una voz personalizada (`register_custom_voice` con
  `samples` de la salida y `reference_text=text[:200]`). Para motores zero-shot
  basados en referencia eso funciona de rebote, pero:
  - se guarda como "clon" del propio resultado (calidad degradada en el segundo uso);
  - el nombre por defecto es "DNA KOKORO"/"Mi Timbre DNA" y colisiona;
  - `save_as_custom` desde el estudio (columna DNA) esta cableado a `true`
    automaticamente, asi que cada prueba contamina "Mis voces".
- **Que hacer.** Separar dos conceptos: **receta DNA** (prompt + parametros, barata,
  versionable) y **muestra de voz** (audio). Guardar por defecto la receta; ofrecer
  "guardar muestra" explicitamente y explicar la diferencia. En el estudio, dejar el
  checkbox real (hoy `defaultChecked` sin estado).
- **Esfuerzo.** S-M.

### 2.21 El checkbox "Guardar timbre en Mis voces" del estudio no tiene estado

- **Hallazgo.** `<input type="checkbox" defaultChecked />` en la columna DNA
  (linea 2950): no esta controlado y `runDna` envia siempre `save_as_custom: true`.
- **Que hacer.** Controlarlo y respetar el valor.
- **Esfuerzo.** S.

---

## 3. Experiencia de usuario (P1)

### 3.1 Scroll forzado y perdida de informacion en portatiles

- **Hallazgo.** Por debajo de 1350 px el estudio pasa a 2 columnas + auditoria debajo
  con `min-height: 720px` forzado, y por debajo de 1180 px cae a 1 columna. En un
  portatil 1366x768 la pantalla de estudio exige scroll vertical para ver la salida.
- **Que hacer.** Definir **un** breakpoint de composicion (p. ej. 1440) y por debajo
  usar un layout de 2 columnas con paneles colapsables (no apilado con alturas
  minimas). Medir con Playwright en 1366x768 y 1280x800 (los tests actuales solo
  comprueban 1600x980 / 1600x900).
- **Esfuerzo.** M.

### 3.2 Sin onboarding ni estados vacios utiles

- **Hallazgo.** Primer arranque: splash, y luego un estudio lleno de controles sin
  explicar que motor usar, que hace "DNA", ni por que un motor esta en gris. La
  biblioteca vacia no ofrece accion. `availability_note` (que ya explica que falta)
  nunca se muestra en la lista de motores.
- **Que hacer.**
  1. Tour de 3 pasos descartable (elegir voz -> escribir -> generar).
  2. En cada pantalla, estado vacio con CTA.
  3. En el motor no disponible, mostrar `availability_note` al hacer hover/focus y un
     enlace a `docs/` o a `scripts/install_native_runtimes.ps1`.
  4. Preferencias en el primer arranque: GPU/CPU, idioma de UI.
- **Esfuerzo.** M.

### 3.3 El hablante no sabe cuanto va a tardar

- **Hallazgo.** No hay estimacion antes de generar (RTF por motor ya esta en
  `docs/benchmark_results.json` y en las metricas de cada generacion, pero no se usa).
- **Hacer.** Mostrar "~12 s estimado (£/RTF 0.28)" junto al boton, y recalcular con la
  ultima generacion del mismo motor.
- **Esfuerzo.** S.

### 3.4 Falta historial de undo

- **Hallazgo.** Borrar un audio o una voz personalizada es inmediato y definitivo
  (ademas borra el WAV de disco). Borrar un preset tambien.
- **Hacer.** Confirmacion con nombre + "deshacer" durante 10 s (mover a
  `biblioteca/.papelera/` y restaurar). El backend ya aisla rutas, asi que mover en vez
  de borrar es trivial.
- **Esfuerzo.** S.

### 3.5 Comparacion A/B de voces inexistente

- **Hallazgo.** Para comparar dos timbres hay que generar dos audios, ir a la
  biblioteca, alternar. El waveform es decorativo y no esta vinculado al audio.
- **Hacer.** Boton "Comparar": genera/enlista 2-4 variantes de la misma frase y ofrece
  un reproductor sincronizado con A/B/C y misma posicion.
- **Esfuerzo.** M.

### 3.6 El waveform no es un waveform

- **Hallazgo.** `Waveform` en `FigmaMakeApp` es un `<div>` con 40 barras de alturas
  fijas y animacion CSS; no hay `canvas` ni `analyserNode` en la app viva (el
  `components/Waveform.tsx` con canvas real esta muerto). El play/pause del estudio
  tampoco mueve el cursor. El tiempo mostrado es siempre "00:00.0" al inicio y "En
  reproduccion" durante el play.
- **Hacer.** Resucitar el componente canvas: picos reales (decodificar con
  `AudioContext.decodeAudioData` o picos precalculados desde el WAV), cursor de
  reproduccion, click para seek, zoom.
- **Esfuerzo.** M.

### 3.7 Sin metadatos legibles del audio seleccionado

- **Hallazgo.** El inspector muestra una rejilla de 8 campos en 7-8 px, sin copiar,
  sin abrir el JSON y sin ver el prompt completo.
- **Hacer.** Ficha con el prompt completo, boton "copiar JSON", "abrir carpeta en el
  explorador" (requiere endpoint), y un `details` con el JSON crudo.
- **Esfuerzo.** S.

### 3.8 La barra de busqueda global no busca

- **Hallazgo.** `input placeholder="Buscar voces, proyectos o archivos..."` sin estado
  ni handler; el `<kbd>Cmd K</kbd>` tampoco.
- **Hacer.** Implementar (ver 2.14) o quitarla. Un placeholder que no funciona es peor
  que no tenerlo.
- **Esfuerzo.** S.

### 3.9 El boton de campana y el de engranaje del topbar no hacen nada

- **Hallazgo.** Campana navega a Configuracion (no es notificaciones) y el segundo
  `icon-btn` no tiene `onClick`.
- **Hacer.** Lo uno o lo otro: notificaciones reales (job terminado, error, nuevo
  modelo detectado) o eliminar los iconos.
- **Esfuerzo.** S.

### 3.10 Accesibilidad

- **Hallazgo.** Solo 17 `aria-label` en 4.498 lineas; 0 regiones `aria-live`; el foco
  visible solo esta definido para `.preset-card`; `prefers-reduced-motion` solo cubre
  splash y cabecera del sidebar (las animaciones de `Waveform`, del orbe DNA y de los
  fondos siguen); el `viewport` tiene `maximum-scale=1.0, user-scalable=no` (bloquea
  zoom); muchos `<button>` no llevan `type` explicito (riesgo real si se
  envuelven en un `form`); varios campos no tienen `label` asociado (`htmlFor`).
- **Hacer.**
  1. Foco visible global (`:focus-visible` con anillo de 2 px en todos los
     interactivos).
  2. `role`/`aria` en tabs, listas, toasts, modales y estados de carga.
  3. Quitar `user-scalable=no`.
  4. Extender `prefers-reduced-motion` a todo el documento.
  5. Navegacion completa por teclado en `engine-matrix` y `.studio-voice-list`
     (roving tabindex) y `aria-selected` en las tabs.
  6. Auditar contraste (varios textos `#60777b`/`#647080` sobre `#071012` estan al
     limite).
- **Esfuerzo.** M.

---

## 4. Diseno de interfaz (P1)

### 4.1 Tipografia por debajo del minimo legible

- **Hallazgo.** 61 declaraciones a `8px`, 35 a `9px`, 33 a `10px`, 27 a `7px`, 2 a
  `6px` y 2 a `5px`. La escala real del producto es 7-10 px para casi todo.
- **Por que importa.** En un monitor 1080p a 100 % de escala eso es ilegible; a 125 %
  de escalado de Windows el diseno se rompe porque los `px` no acompanan.
- **Hacer.** Definir una escala de tipos (`--text-xs: 11px`, `--text-sm: 12px`,
  `--text-base: 14px`, `--text-lg: 16px`) con `rem`, auditar cada regla y subir el
  minimo a 11 px (metadatos) y 13 px (contenido). Revisar el espaciado en consecuencia
  (habra que recortar densidad de informacion: es una decision de producto).
- **Esfuerzo.** M-L.

### 4.2 Densidad excesiva y jerarquia plana

- **Hallazgo.** El estudio concentra en una sola vista: 8 motores, 6 filtros de region,
  N voces, 3 presets, un editor, 4 controles, 2 CTAs, un laboratorio de clonacion
  completo (6 bloques), waveform, biblioteca, 3 tabs de inspector, 8 campos. Casi todo
  con el mismo peso visual (bordes finos, misma tipografia, mismo tamano).
- **Hacer.**
  1. Definir 3 niveles de jerarquia y aplicarlos (titulo de seccion, grupo, control).
  2. Colapsar lo secundario por defecto: el laboratorio de clonacion no deberia vivir
     permanentemente al lado de la sintesis directa.
  3. Introducir un "modo enfoque" (una columna, editor grande) que es lo que la mayoria
     del tiempo se necesita.
- **Esfuerzo.** M.

### 4.3 Diez temas sin sistema de diseno

- **Hallazgo.** 10 temas (`omni`, `violet`, `ember`, `ice`, `emerald`, `crimson`,
  `cobalt`, `mono`, `light`, `amoled`) definidos como overrides ad-hoc; `light` y
  `amoled` necesitan decenas de reglas extra por componente (lineas 114-144), sin
  tokens semanticos.
- **Hacer.** Adoptar tokens semanticos (`--surface-*`, `--text-*`, `--border-*`,
  `--accent-*`) y generar los temas solo con esos tokens; con eso `light` deja de
  necesitar parches por componente. Reducir a 3-4 temas y validar contraste de cada
  uno automaticamente.
- **Esfuerzo.** M.

### 4.4 El widget del sidebar come la navegacion

- **Hallazgo.** `.sidebar-animated-header { aspect-ratio: 1; }` ocupa ~232 px de ancho
  completo y el sidebar ademas tiene scroll (`overflow-y:auto`), mientras `nav` queda
  por debajo del pliegue en 768 px de alto.
- **Hacer.** Reducir a una marca compacta (48-56 px) y dejar la animacion para el
  splash o un estado vacio. La navegacion tiene que estar siempre visible.
- **Esfuerzo.** S.

### 4.5 Cabeceras decorativas con datos fijos

- **Hallazgo.** `engine-matrix` dice "8 ARQUITECTURAS" fijo (el catalogo puede tener
  menos); "Mis voces" muestra `31`, "Presets" `40` y "Presets profesionales" `40
  OPERATIVOS` aunque el catalogo real es 40 (2x20) y las voces personalizadas pueden
  ser 0; el badge "DISEÑO PRINCIPAL / 4 columnas" es ruido de Figma que se quedo en
  produccion (`live-concept`).
- **Hacer.** Contar desde el estado (`visualEngines.length`, `saved.length`,
  `STUDIO_PRESETS.length`) y eliminar el badge `live-concept`.
- **Esfuerzo.** S.

### 4.6 El estado del producto miente en el shell

- **Hallazgo.** `const cpu = useMemo(() => 42, [])`; "GPU - DirectML 68 %"; "RAM -
  13.4 / 32 GB"; "SISTEMA LOCAL - Optimo"; "Liberar VRAM 1.8 GB"; "8/8" en estado de
  modelos.
- **Por que importa.** Es exactamente el tipo de dato que un usuario tecnico usa para
  decidir si lanzar otro motor. Datos inventados destruyen la confianza en toda la
  interfaz.
- **Hacer.** Alimentarlos de `/api/v1/system/status` (ya devuelve RAM total/usada/
  disponible, RSS del proceso, `vram_limit_gb`, hilos, `dml_available`,
  `available_providers`) con polling cada 5-8 s; si el backend esta caido, mostrar
  "sin datos" en gris en lugar de numeros.
- **Esfuerzo.** S.

### 4.7 Iconografia

- **Hallazgo.** `lucide-react` esta en `package.json` y en el lockfile, y no se usa:
  la app trae su propio `Icon` con 24 paths inline (bien hecho, cero red). Aun asi el
  paquete pesa en `node_modules` y confunde a futuros contribuidores. Ademas se usa el
  icono `upload` para "descargar" (semantica invertida) y `settings` para "liberar
  VRAM".
- **Hacer.** Quitar `lucide-react` (y `@tailwindcss/vite` si se elimina Tailwind, ver
  4.10) o migrar a el; corregir las semanticas de icono (`download`, `eraser`,
  `trash-2`, `cpu`).
- **Esfuerzo.** S.

### 4.8 Estados de foco/hover inconsistentes

- **Hallazgo.** Solo `.preset-card`, `.icon-btn` y pocos botones tienen `:hover`;
  `:active` y `:disabled` casi no estan definidos; los botones deshabilitados se
  pintan igual que los activos (solo se atenuan por el atributo nativo).
- **Hacer.** Capa de primitivas (`Button`, `IconButton`, `Field`, `Slider`, `Tabs`,
  `Panel`) con estados completos (`default/hover/active/focus/disabled/loading`), que
  ademas reduce las 1.059 lineas de CSS de componentes.
- **Esfuerzo.** M.

### 4.9 El splash bloquea y no aporta

- **Hallazgo.** Pantalla completa con boton "INICIAR" obligatorio en cada arranque,
  incluso si el backend ya esta listo. No hay `skip` por teclado y el boton aparece
  con animacion de 5 pasos.
- **Hacer.** Convertirlo en un loader no bloqueante (se va solo cuando `system/status`
  responde) o eliminarlo; recordar "no volver a mostrar" en `localStorage`.
- **Esfuerzo.** S.

### 4.10 CSS muerto y dependencias innecesarias

- **Hallazgo.** `.studio-variant-b/c/d/e`, `.concept-*`, `.mini-*` y buena parte de
  `.four-*` corresponden a conceptos que no se pueden activar (`concept = "A"`). El
  CSS compilado es de 141,88 kB (25,84 kB gzip) y `tailwindcss` aporta ~48 kB
  (7,8 kB gzip) sin que el JSX use utilidades Tailwind.
- **Hacer.** Purgar clases de variantes inalcanzables (o convertirlas en features
  reales), quitar `@import 'tailwindcss'` y el plugin si no se adoptan utilidades, y
  activar un presupuesto de CSS en el build (falla por encima de X kB).
- **Esfuerzo.** S.

### 4.11 Tipografia y fuentes locales

- **Hallazgo.** Decision correcta (100 % offline) usar `local()`, pero en un equipo
  sin Inter/Montserrat/Space Grotesk el producto se renderiza con Segoe UI y la
  jerarquia se aplana justo en los titulos (`font: 900 ... Montserrat`).
- **Hacer.** Empaquetar como `woff2` las 2-3 familias realmente usadas (subconjunto
  latino, ~120 kB) en `public/fonts`, o comprometerse con una sola familia del sistema
  y ajustar la escala.
- **Esfuerzo.** S.

---

## 5. Funciones nuevas recomendadas (P2/P3)

1. **Trabajos asincronos + progreso** (`/jobs`, SSE). Base de todo lo demas: sin
   trabajos no hay cancelacion, ni lotes robustos, ni notificaciones. P1.
2. **Exportacion profesional** de un clic: WAV 16/24 bit, MP3 (requiere encoder
   empaquetado), normalizacion a -16 LUFS / -23 LUFS, recorte de silencios, y
   **exportar por bloques** en ZIP junto con el JSON. Hoy el DSP ya tiene
   `remove_dc_and_normalize` con `trim_silence`; solo falta exponerlo. P1.
3. **SSML o marcado ligero** (`[pausa:0.5]`, `[enfasis]`, velocidad por frase) que el
   normalizador traduzca a los `chunks`. Es la mejora de calidad mas barata. P2.
4. **Diccionario de pronunciacion** por proyecto (siglas de la empresa, nombres
   propios) aplicado en `normalize_spanish_text`. P2.
5. **Cache de sintesis por hash(texto+params+motor+voz)** antes de inferir: ahorra
   minutos en las iteraciones normales de un locutor. P2.
6. **Historial de versiones por linea de guion** (misma frase, parametros distintos,
   comparables). P2.
7. **Editor de guion con marcas de tiempo**: tras generar, alinear bloques con el audio
   y permitir regenerar solo una frase (ya es posible tecnicamente porque se sintetiza
   por chunks). P2.
8. **Vista de coste/medidor de hardware en vivo** durante la generacion (RAM, VRAM,
   hilos) para entender por que un motor es lento. P2.
9. **Perfiles de exportacion guardables por proyecto** y asignables a la cola de lotes.
   P2.
10. **Soporte multi-idioma**: el producto es "Omni-**ES**" pero Piper/Kokoro pueden
    hablar otros idiomas; un selector de idioma con fallback explicito amplia el
    mercado sin cambiar la API (`lang="es"` esta hardcodeado en `kokoro_engine`). P3.
11. **Plugin/CLI de lote** (`vozstudio --script guion.txt --voice ef_dora`) para
    integrarlo en pipelines; el backend ya es una API limpia. P3.
12. **Dashboard de calidad percibida**: marcar cada generacion con "aprobada /
    rechazada" y usar ese dato para recomendar presets. P3.
13. **Estimacion y limite de contexto**: aviso cuando el texto supera los limites del
    motor (1.200 caracteres en `reference_text`, 12.000 en `synthesize`) con
    explicacion, no solo un 422. P2.

---

## 6. Calidad tecnica, pruebas y operacion (P1/P2)

### 6.1 Un `NameError` latente en el orquestador

- **Hallazgo.** `src/ai/engine_factory.py:129` anota `samples: np.ndarray` pero el
  modulo **no importa numpy** (`from __future__ import annotations` evita que falle en
  la definicion; fallaria al evaluar el tipo si algo hace `get_type_hints`, y confunde
  a cualquier herramienta de analisis). Nota adicional: existe un camino `save_to_library=False` que devuelve un
  diccionario con `samples` en memoria; conviene confirmar que ningun caller dependa
  de el para no filtrar audio por la API.
- **Hacer.** `import numpy as np`, ejecutar `ruff`/`mypy` en CI y eliminar el camino
  muerto (o cubrirlo con un test).
- **Esfuerzo.** S.

### 6.2 Sin manifiesto de dependencias de Python

- **Hallazgo.** No hay `requirements.txt`, `pyproject.toml` ni `Pipfile`. El README pide
  `pytest tests/unit` y asume FastAPI, uvicorn, onnxruntime, soundfile, numpy, scipy,
  `kokoro-onnx`, `onnxruntime-genai`... Todo implicito.
- **Por que importa.** Imposible reproducir el entorno o instalar en un equipo nuevo,
  y `docs/AUDITORIA.md` habla de "Python 3.13 / NumPy 2.5+" sin fijar versiones.
- **Hacer.** `pyproject.toml` con `[project]` + extras (`cpu`, `dml`, `native`,
  `dev`) y versiones pineadas; `uv`/`pip-tools` para el lock. Incluir un
  `python -m src.main.main --doctor` que valide modelos enlazados y runtimes.
- **Esfuerzo.** S.

### 6.3 Sin CI

- **Hallazgo.** No existe `.github/workflows`. Los tests existen pero se ejecutan a
  mano; los E2E asumen rutas `C:\antigravityAS\...` y `channel: 'chrome'`
  (`tests/e2e/live_fullstack.spec.ts`), asi que en cualquier otra maquina fallan.
- **Hacer.** CI con: `ruff` + `mypy` (o `pyright`) + `pytest tests/unit` +
  `tsc --noEmit` + `vite build` + Playwright `no_scroll` con backend mockeado
  (`page.route('**/api/**')`). Parametrizar `PROJECT_ROOT` por variable de entorno.
- **Esfuerzo.** M.

### 6.4 Cobertura de UI inexistente

- **Hallazgo.** No hay tests de componentes ni de logica pura del frontend (el
  segmentador, la conversion de estados, el formateo de metricas). Los dos specs E2E
  cubren navegacion y presets, pero ninguno: sintesis, clonacion, DNA, lotes,
  biblioteca, borrado, errores de API.
- **Hacer.** Vitest + Testing Library para los modulos puros y los formularios; E2E de
  los 6 flujos principales con backend stubeado y uno "humo" contra backend real
  (etiquetado `@live`, fuera del CI por defecto).
- **Esfuerzo.** M.

### 6.5 El test de "no scroll" no prueba el estudio

- **Hallazgo.** `tests/e2e/no_scroll.spec.ts` se llama asi pero no comprueba
  `scrollHeight <= clientHeight` en ninguna resolucion; lo unico que valida es que el
  grid de presets tenga 5 columnas y 4 filas. Y en 1366x768 el estudio si hace scroll
  (ver 3.1).
- **Hacer.** Restaurar la asercion de no-scroll en el estudio a 1920x1080, 1600x900,
  1366x768 y 1280x800, o cambiar de objetivo explicitamente (ver 1.3).
- **Esfuerzo.** S.

### 6.6 Observabilidad

- **Hallazgo.** `logging.basicConfig` basico; sin IDs de correlacion por peticion, sin
  log de que motor/prompt fallo (solo `type(exc).__name__` en las respuestas 500), sin
  rotacion salvo el hack de `headless_server` para stdout, sin endpoint de salud
  detallado.
- **Hacer.** `X-Request-ID` + logger contextual, `/api/v1/health` con estado por motor
  (disponible, cargado, ultimo error), y rotacion real con `TimedRotatingFileHandler`.
- **Esfuerzo.** S-M.

### 6.7 Seguridad de red del servidor de desarrollo

- **Hallazgo.** `vite.config.ts` fija `host: 127.0.0.1` (bien), pero el backend
  acepta CORS solo desde 5173/4173/8880 y sirve la SPA con `StaticFiles` montado en
  `/`; `X-Frame-Options: DENY` impide embeber la app (correcto para escritorio, a
  revisar si algun dia se quiere un preview embebido). No hay CSP.
- **Hacer.** Anadir `Content-Security-Policy` (`default-src 'self'; img-src 'self'
  data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'`), `Permissions-Policy`
  (microfono solo si se usa grabacion) y un limite de tamano de cuerpo global.
- **Esfuerzo.** S.

### 6.8 Grabacion en vivo no implementada pero anunciada

- **Hallazgo.** "Grabar voz en vivo - 15 segundos - nivel y ruido monitorizados" abre
  el selector de archivos (`referenceInput.current?.click()`). El hook
  `useVoiceRecorder.ts` (267 lineas) existe pero esta muerto.
- **Por que importa.** Es la funcion mas natural del laboratorio de clonacion y hoy es
  un boton que miente.
- **Hacer.** Portar el hook a la app viva: `MediaRecorder` + medidor de nivel
  (AnalyserNode) + guia de texto (el pangrama ya esta precargado) + validacion de
  duracion minima (0.8 s) y ruido, y subir el blob resultante. Requiere permiso de
  microfono y un `Permissions-Policy` coherente.
- **Esfuerzo.** M.

### 6.9 El pipeline DSP de limpieza no se aplica al registro de voz

- **Hallazgo.** `dsp` (ruido/nasal/de-esser) se muestra en la columna de clonacion, y
  `cleanVocalAudio` solo se invoca desde un boton "Limpiar" del modo clonacion del
  centro (que esta oculto). Al guardar una voz personalizada
  (`/voices/custom`) no se aplica ninguna limpieza, aunque los toggles esten activos.
- **Hacer.** Pasar las opciones DSP al endpoint de registro (o encadenar
  `clean_vocal_audio` antes de guardar) y mostrar metricas (pico original/final,
  filtros aplicados, ya devueltas en `VocalCleanMetricsResponse`) antes de confirmar.
- **Esfuerzo.** S-M.

### 6.10 Crecimiento sin limites de la biblioteca y del cache DSP

- **Hallazgo.** Cada generacion deja WAV+JSON; cada limpieza deja un WAV en
  `biblioteca/.dsp_cache/`. No hay cuota, ni purga, ni paginacion en
  `GET /library` (devuelve todo y la UI filtra en cliente).
- **Hacer.** Paginacion + filtros en servidor (`limit/offset/date/motor`), limite o
  purga de `.dsp_cache` (TTL), y accion "vaciar cache" en Configuracion.
- **Esfuerzo.** S.

### 6.11 Duplicacion de la logica de IDs y de audio

- **Hallazgo.** `_validate_item_id`, `_resolve_contained_path`, los checks de 15 MB y
  de duracion, y el patron `clean_` del cache DSP estan copiados en `routes.py`,
  `audio_dsp.py` y `custom_voice_store.py` (el regex del nombre de archivo aparece en
  dos sitios).
- **Hacer.** Modulo `src/core/media.py` con `validate_upload`, `read_reference_audio`,
  `resolve_contained_path` publico, y constantes compartidas (con
  `pydantic`-validators reutilizables).
- **Esfuerzo.** S.

### 6.12 Contrato API sin version de esquema

- **Hallazgo.** `/api/v1` esta bien versionado, pero `LibraryItemResponse` y el JSON
  auditado no llevan `schema_version`; `parametros`/`metricas` son `dict[str, Any]`
  libres. Cambiar el formato rompe lecturas historicas en silencio.
- **Hacer.** `schema_version` en el JSON y en el modelo, y `parametros`/`metricas`
  tipados con campos opcionales (`model_config = ConfigDict(extra="allow")` en la capa
  de metadatos).
- **Esfuerzo.** S.

---

## 7. Sesgos detectados en la interfaz (rapido, P1)

| Ubicacion | Texto/valor actual | Problema |
|---|---|---|
| `FigmaMakeApp.tsx:697` | "Buenos dias, Benner" | Nombre y saludo fijos |
| `FigmaMakeApp.tsx:717` | proyectos hardcodeados | No son los del usuario |
| `FigmaMakeApp.tsx:174,177` | `count: 31`, `count: 40` | Contadores inventados |
| `FigmaMakeApp.tsx:1590` | "40 OPERATIVOS" | No depende del catalogo |
| `FigmaMakeApp.tsx:2209` | "Liberar VRAM 1.8 GB" | Dato fijo; el endpoint devuelve boolean |
| `FigmaMakeApp.tsx:2617` | "CALIDAD STUDIO" | Constante |
| `FigmaMakeApp.tsx:3300` | "PHI - DIRECTML LOCAL" | No refleja `engine_used` |
| `FigmaMakeApp.tsx:3665` | "8/8" | No cuenta disponibles |
| `FigmaMakeApp.tsx:4306` | `useMemo(() => 42)` | CPU 42 % |
| `FigmaMakeApp.tsx:4381-4388` | "GPU 68 %", "RAM 13.4 / 32 GB" | Fijos |
| `settings` | GPU 0 "AMD Radeon" | Hardware de un solo equipo |
| `settings` | rutas `C:\antigravityAS\...` | Debilita la portabilidad |
| `Models` | "8 ARQUITECTURAS" | Fijo en el titulo |
| `Studio` | "F5 - COSY" en la cabecera del laboratorio | No depende del motor real |

Regla practica: **ningun numero visible en la UI puede ser una constante**. Si no hay
dato, mostrar el estado vacio ("sin datos") y explicar por que.

---

## 8. Limpieza concreta (checklist accionable)

- [ ] `src/ui/src/App.tsx`, `WorkspaceHub.tsx`, `components/` (10), `hooks/` (3),
      `utils/` (2), `services/offlinePreviewWav.ts` y `styles/studio.css`: decidir
      rescatar o eliminar. Hoy son ~3.500 lineas fuera del grafo.
- [ ] `FigmaMakeApp.tsx`: eliminar `concept`/variantes B-E, `AlternativesPage`,
      `SidebarAnimatedHeader` duplicado con splash, y los bloques de estudio
      duplicados (columna 02 vs `.studio-center`).
- [ ] `styles/figma-make.css`: purgar `.studio-variant-*`, `.concept-*`, `.mini-*`
      inalcanzables; eliminar `@import 'tailwindcss'` si no se usan utilidades.
- [ ] `package.json`: quitar `lucide-react` (sin uso) y `tailwindcss`/`@tailwindcss/vite`
      si corresponde.
- [ ] Root: `pyproject.toml` + `requirements-dev.txt`.
- [ ] `.github/workflows/ci.yml`.
- [ ] `docs/AUDITORIA.md`: regenerar con mediciones; `AUDITORIA_MODELOS.md` referencia
      `GEMINI.md`/`ESTRUCTURA.md`/`SKILLS.md`/`DISENO.md` que **no existen** en el
      repositorio (verificar enlaces o retirarlos).
- [ ] `tests/e2e/live_fullstack.spec.ts`: `PROJECT_ROOT` por entorno, no `C:\...`.
- [ ] `src/ai/engine_factory.py`: `import numpy as np`.

---

## 9. Hoja de ruta propuesta (orden recomendado)

**Sprint 1 - Verdad y coherencia (1 semana)**
1. Eliminar datos fijos y conectarlos a `/system/status` (4.6, 2.9).
2. Decidir UI canonica y borrar el codigo muerto (1.1).
3. Quitar placebo: segmentos, "Sintetizar bloque", busqueda global, campana, botones
   sin handler, `window.prompt` (2.2, 2.3, 3.8, 3.9, 2.6).
4. Normalizar `emotion` y ocultar el selector cuando el motor no lo soporta (2.4).
5. `pyproject.toml` + CI minimo (6.2, 6.3).

**Sprint 2 - Flujo de produccion (2 semanas)**
6. `normalize-preview` conectado + segmentos reales editables (2.2).
7. Waveform real con seek (3.6) y comparacion A/B (3.5).
8. Trabajos asincronos con progreso y cancelacion (2.17).
9. Exportacion (formatos, loudness, ZIP de bloques) (5.2).
10. Biblioteca paginada + multiseleccion + "reusar receta" (2.10, 6.10).

**Sprint 3 - Diseno y accesibilidad (2 semanas)**
11. Escala tipografica y tokens semanticos (4.1, 4.3).
12. Primitivas de UI con estados completos (4.8) y reduccion de densidad (4.2).
13. Accesibilidad: foco, aria-live, teclado, zoom (3.10), atajos y palette (2.14).
14. Onboarding y estados vacios (3.2).

**Sprint 4 - Confianza y escala (2 semanas)**
15. Configuracion real con `PUT /config` (2.13).
16. Proyectos reales sobre la biblioteca (2.11) o retirar la seccion.
17. Lotes persistentes con reintento (2.7), grabacion en vivo (6.8), DSP en registro
    (6.9).
18. Observabilidad, CSP, `schema_version` (6.6, 6.7, 6.12).

---

## 10. Lo que ya esta bien y conviene preservar

- Politica **single-active-engine** con `RLock` y `gc.collect()`: solida y bien
  razonada; no la cambies al refactorizar la UI.
- Fallback DirectML -> CPU con `warmup_fn` dentro del bloque protegido: evita el fallo
  silencioso tipico de DirectML. Excelente decision.
- `text_normalizer` (600 lineas) y `audio_dsp` (816 lineas) en numpy/scipy puro, sin
  `librosa`/`numba`: portabilidad real.
- Path traversal defensivo con `_resolve_contained_path` + `_validate_item_id` en
  lectura, escritura y borrado; regex de nombres de cache DSP.
- Separacion `BaseTTSEngine` / `EngineOrchestrator` / adaptadores: la extension con
  nuevos motores es barata, y los runtimes aislados (Qwen/F5) no contaminan el Python
  del backend.
- JSON gemelo por cada WAV con hardware, parametros y metricas: base perfecta para
  auditar, comparar y construir la cache de sintesis.
- Persistencia atomica de `.custom_voices.json` via fichero temporal + `replace()`.
- Decision de fuentes `local()` y cero peticiones de red: coherente con "100 % offline".

---

*Documento generado como analisis de producto. No modifica codigo; cada seccion indica
archivo y linea para que cualquier hallazgo sea verificable.*
