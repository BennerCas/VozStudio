# VozStudio Atlas - Propuesta de nueva aplicacion

> Punto de partida: el `VozStudio Omni-ES` actual (`docs/MEJORAS_DETECTADAS.md`).
> Objetivo: convertir una **consola de sintesis** en una **productora de contenido
> hablado**, reutilizando la capa de motores que ya funciona y reescribiendo solo la
> capa de producto.

---

## 1. Tesis: el problema no es generar voz, es terminar un entregable

Hoy la unidad de trabajo es **"un audio"**: escribes, generas un WAV, aparece en la
biblioteca. Por eso el producto no escala a lo que realmente se pide: un audiolibro de
8 horas, un curso de 30 lecciones, un episodio de podcast de dos voces, un spot de
exactamente 30 segundos.

La propuesta cambia la unidad de trabajo:

```
audio  ->  toma  ->  bloque  ->  documento  ->  proyecto  ->  entregable
```

Con eso cambian todas las preguntas que el producto puede responder:

| Hoy | Con Atlas |
|---|---|
| "Genera 20.000 caracteres y dime cuando acabe" | "Muestra los 214 bloques, cuales estan aprobados y cuales necesitan otra toma" |
| "¿Suena bien?" (hay que escuchar 8 h) | "El QA marco 3 de 214 bloques: escucha solo esos" |
| "Regenera todo" | "Cambia la voz del personaje secundario en el capitulo 7, deja el resto" |
| "No se cuanto va a tardar" | "8 h de audio: borrador Piper en 24 min, final Kokoro en 2 h 17 min" |
| "¿Que motor uso?" | "Audiolibro comercial + ES-MX + sin GPU: Piper high, con aviso de licencia" |

**Los 8 motores son el activo tecnico. El producto es la produccion.**

---

## 2. Nombre y posicionamiento

**VozStudio Atlas** - "Estudio de produccion de contenido hablado. 100 % local, 100 %
en espanol."

Por que *Atlas*: un atlas es una coleccion organizada de mapas de un territorio. Aqui
el territorio es la voz espanola (8 arquitecturas, 12 acentos, voces clonadas y
disenadas) y el producto lo cartografia: por formato, por acento, por licencia, por
rendimiento.

Alternativas si el nombre no gusta: **VozStudio Forja** (enfasis en produccion),
**VozStudio Coral** (elenco/polifonia), **VozStudio Pliego** (editorial, audiolibros).

Dos capas de producto bajo la misma marca:

- **VozStudio Quick** - una frase, un audio, en 3 clics. Es el uso actual, y hay que
  conservarlo: es la puerta de entrada.
- **VozStudio Atlas** - proyectos, elenco, lotes y entregables. Es el producto.

---

## 3. Para quien

| Perfil | Trabajo por resolver | Lo que duele hoy |
|---|---|---|
| **Locutor / productor freelance** | Entregar 20 audios por semana con presets de cliente | Repite ajustes a mano, no tiene "receta de cliente" |
| **Editorial / audiolibros** | 1 libro = 8-12 h, 6-10 capitulos, 1 narrador, cero errores | Revisar 8 h a oido; falta control por bloque y QA |
| **E-learning / corporativo** | 30 lecciones, mismas voces, mismo tono, sincronia con video | No hay proyecto, ni consistencia entre sesiones, ni SRT |
| **Podcast / radio** | 2 voces, tiempos exactos, musica de fondo, salida 30 s | No hay casting multi-voz ni ajuste a duracion |

---

## 4. Modelo de dominio: Proyecto > Documento > Bloque > Toma

```
Proyecto  "Audiolibro: Patagonia"           formato=audiolibro, licencia=comercial
 |
 +-- Elenco (Cast)                         narrador: em_alex (Kokoro, bloqueado)
 |                                         personaje_1: custom_... (clon, consentido)
 |                                         personaje_2: qwen3_voice_design (receta DNA)
 |
 +-- Documento "Capitulo 07"               importado de DOCX/MD/SRT
      |
      +-- Bloque 07-014   "El viento no..."  voz=narrador  estado=APROBADO  toma=#2
      +-- Bloque 07-015   "—No vuelvas."     voz=personaje_1 estado=POR_REVISAR toma=#1
      +-- Bloque 07-016   "Silencio."        voz=narrador  estado=PENDIENTE
           |
           +-- Toma #1  motor=kokoro  speed=0.96  duracion=4.21s  qa=OK
           +-- Toma #2  motor=kokoro  speed=0.98  duracion=4.08s  qa=OK   <- aprobada
```

Propiedades que esto habilita y que hoy son imposibles:

- **Regenerar una frase** sin tocar el resto (el backend ya sintetiza por chunks: la
  granularidad existe, solo hay que exponerla).
- **Aprobar por bloque** y que la exportacion use solo tomas aprobadas.
- **Versionar** (N tomas por bloque, con sus parametros y metricas del JSON auditado).
- **Casting multi-voz**: cada bloque sabe a que voz del elenco pertenece.
- **Progreso real**: 148/214 bloques aprobados. Es la metrica que el usuario entiende.

### 4.1 Consistencia entre sesiones ("voice lock")

Hoy, con motores zero-shot (F5, CosyVoice, XTTS), cada render recalcula el
condicionamiento desde el WAV de referencia y el resultado varia ligeramente entre
sesiones: el capitulo 12 no suena exactamente como el 1.

Propuesta tecnica: al fijar una voz del elenco, **persistir el condicionamiento**
(`gpt_cond_latent`/`speaker_embedding` en XTTS, prompt wav + texto en F5/CosyVoice,
seed y temperatura en Qwen) junto a un hash de la referencia. Todos los renders del
proyecto reutilizan exactamente el mismo condicionamiento. Dos beneficios: consistencia
audible y menos latencia (hoy `XTTS` recalcula latentes en cada llamada y F5 reinyecta
la referencia por chunk).

---

## 5. Los 8 motores, ordenados por lo que sirven (no por marca)

Datos reales: `docs/benchmark_results.json` (frase de 88 caracteres, hardware local) y
metadatos de cada adaptador. RTF = tiempo de inferencia / duracion del audio, menor es
mejor.

| Motor | Rol en Atlas | Licencia | RTF medido | Voz | Fortaleza real | Limite que hay que decir en la UI |
|---|---|---|---|---|---|---|
| **Piper VITS** | **Borrador y produccion masiva** | MIT | **0.035 - 0.06** | 12 (ES/MX/AR, M/F) | 25x mas rapido que Kokoro; acentos regionales nativos | Prosodia plana, 22,05 kHz; sin emocion |
| **Kokoro-82M** | **Locucion final** generica | Apache-2.0 | 0.285 | 3 + 2 mezclas | Calidad 24 kHz, timbre agradable, mezclas vectoriales | Cae a CPU; 1,5 s por frase |
| **MMS-TTS** | Respaldo ultraligero | **CC-BY-NC-4.0** | 0.383 | 1 | Siempre disponible, 16 kHz | **No comercial**; cold start de 46 s |
| **StyleTTS 2 BSC-LT** | Narracion expresiva | Apache-2.0 | n/d (920 MB) | 3 | Prosodia expresiva para audiolibro | Runtime pesado, calidad variable |
| **Qwen3-TTS VoiceDesign** | **Casting por descripcion** | Apache-2.0 | n/d (1,83 GB) | 4 + diseno | Crea voces que no existen desde texto | Runtime aislado; lento; no es clonacion directa |
| **CosyVoice 3** | Clonacion + estilo | Apache-2.0 | n/d (3,85 GB) | 4 + instruct | Zero-shot con control de estilo | El motor mas pesado; requiere referencia |
| **F5-TTS Spanish** | **Clonacion multiacento** | MIT | n/d (1,35 GB) | 3 perfiles | 218 h de espanol multiacento | Requiere runtime `.runtimes/` y referencia |
| **Coqui XTTS-v2** | Clonacion de respaldo | **CPML (uso personal)** | n/d (1,87 GB) | 1 | Fallback automatico a CosyVoice | **No comercial**; licencia restrictiva |

Consecuencias de producto que salen de esta tabla:

1. **Los motores no son intercambiables**: se asignan por rol. La UI debe dejar de
   ofrecer "8 arquitecturas" como si fueran 8 sabores y pasar a "elige rol: borrador,
   locucion, personaje, clonacion".
2. **Hay un pipeline de dos pasadas** que hoy nadie usa (ver 6.2).
3. **Dos motores tienen licencia no comercial**. Un estudio profesional necesita saberlo
   **antes** de exportar, no en el README (ver seccion 13).

---

## 6. Los cuatro pilares del producto

### 6.1 Quick - "una frase, un audio"

Se conserva el flujo actual, simplificado: pegar texto, elegir voz, generar, descargar.
Sin columnas, sin inspector, sin biblioteca. Un panel unico. Es el 80 % de los usos
espontaneos y hoy cuesta 4 columnas de interfaz.

### 6.2 Produce - "un proyecto hasta el entregable"

El corazon. Incluye el pipeline de dos pasadas:

```
 Guion importado (DOCX / MD / SRT / TXT / CSV)
     |
     v
 Normalizacion + segmentacion en bloques        (text_normalizer, ya existe)
     |
     v
 Asignacion de voz por bloque                    (elenco / deteccion de dialogos)
     |
     v
 PASADA 1 - BORRADOR                             Piper, RTF 0.05
     |    objetivo: tiempos, prosodia, deteccion de bloques raros
     |    coste: 1 h de audio en ~3 min
     v
 QA automatico + escucha selectiva               (solo bloques marcados)
     |
     v
 PASADA 2 - FINAL                                Kokoro / Qwen / F5, solo aprobados
     |    coste: 1 h de audio en ~17 min (Kokoro)
     v
 Mezcla, loudness, cortes de capitulo            EBU R128, true peak
     |
     v
 Entregables: WAV + MP3 + M4B + SRT/VTT + CSV + informe de licencias
```

Por que esto es posible ahora y no antes: con RTF medidos, **8 horas de audiolibro se
borradorizan en 24 minutos con Piper y se finalizan en 2 h 17 min con Kokoro**. El
borrador no se tira: sirve para validar duracion, detectar frases mal normalizadas y
decidir que bloques merecen el motor caro.

### 6.3 Automate - "sin abrir la app"

- **Cola persistente** de trabajos por proyecto, reanudable, con reintento por bloque.
- **Carpeta vigilada**: dejas `capitulo-08.md` en `inbox/` y aparece el audio en
  `outbox/` con el mismo nombre. Configurable por receta.
- **CLI**: `atlas render --project patagonia --doc 07 --preset audiolibro --engine piper`
  y `atlas batch --csv guiones.csv --preset spot-30s`.
- **API HTTP** (la actual, ya limpia) + **webhooks** locales al terminar un trabajo.
- **Programacion**: "renderiza de noche entre 01:00 y 07:00" (una sola GPU: hay que
  serializar de todas formas).

### 6.4 Library - "activos reutilizables"

Voces (nativas, clonadas, disenadas), recetas, elencos, presets de cliente, musica y
SFX propios (nunca descargados), glosarios de pronunciacion y reportes de QA. Todo
local, todo versionado, todo exportable.

---

## 7. Pantallas

```
 INICIO            bandeja de proyectos + "continuar donde lo deje" + estado del sistema real
 PRODUCIR          (pantalla principal, ver wireframe)
 ELENCO            voces del proyecto: nativas, clonadas, disenadas; bloquear y previsualizar
 VOCES             biblioteca global de voces + grabacion guiada + consentimiento
 RECETAS           presets por formato (audiolibro, elearning, podcast, radio...)
 LOTES             trabajos masivos desde CSV/SRT/carpeta, con cola y reintentos
 BIBLIOTECA        tomas aprobadas, busqueda, reuso, exportaciones
 AJUSTES           hardware real, licencias, rutas, IA local, privacidad
 (oculto) Quick    una frase, un audio
```

Wireframe de **PRODUCIR**:

```
+----------------------------------------------------------------------------------+
| Patagonia / Cap. 07        [Borrador][Final]   214 bloques  148 OK  3 revisar     |
|                                              [Renderizar...] [Exportar v]        |
+-------------------+------------------------------------------+-------------------+
| DOCUMENTOS        |  07-013  NARRADOR                        | INSPECTOR         |
| > Cap. 05      OK |  "El viento no traia nada..."            | Voz: em_alex      |
| > Cap. 06      OK |  [ Escuchar ] 4.21 s  tomar 2/2          | Motor: Kokoro     |
| > Cap. 07       3 |                                          | Vel 0.96  +0.0st  |
|   - 07-012    OK  |  07-014  PERSONAJE_1        [REVISAR]    | ----------------- |
|   - 07-013    OK  |  "—No vuelvas por aqui."                 | Takes:  #1 #2 OK  |
|   - 07-014    !   |  [ Escuchar ] 1.8 s  QA: duracion -38%   | ----------------- |
|   - 07-015    OK  |  [ Regenerar ] [ Aprobar ] [ Cambiar voz]| QA del bloque      |
|   - 07-016        |                                          | OK duracion        |
| > Cap. 08        |  07-015  NARRADOR                        | OK clipping        |
|                   |  "Y entonces..."                         | OK -18 LUFS        |
| + Importar DOCX   |  [ Escuchar ] 6.02 s                     | X  cobertura 92%   |
+-------------------+------------------------------------------+-------------------+
| COLA:  07-014 regenerando (Piper, 0.4 s)  |  resto: 66 bloques en 2 min 11 s     |
+----------------------------------------------------------------------------------+
```

Decisiones de interfaz que responden a los problemas detectados en la app actual:

- **Una sola zona de trabajo**, no cuatro columnas compitiendo. El editor manda.
- **El estado del bloque es visible** (pendiente / generado / por revisar / aprobado) y
  es accionable.
- **Los numeros son reales**: bloques, segundos, minutos restantes, LUFS medidos.
- **La cola es global y visible**, no un spinner.
- **Teclado primero**: `J/K` siguiente/anterior bloque, `espacio` escuchar, `Enter`
  aprobar, `R` regenerar, `Ctrl+Enter` renderizar documento, `Ctrl+K` palette.
- **Una accion primaria por pantalla**; el resto en inspector o menus.

---

## 8. Recetas de produccion (el nucleo del valor)

Una receta no es "velocidad + matiz" como hoy. Es una **especificacion de fabricacion**
con guardarrailes, y Atlas la usa para: elegir motor, segmentar, poner pausas, validar
duraciones, mezclar y exportar.

Campos de una receta:

```yaml
formato: audiolibro
motor_borrador: piper        # pasada 1
motor_final: kokoro          # pasada 2
voz: { rol: narrador, criterio: "M/F estable, 24 kHz" }
segmentacion: { unidad: parrafo, max_chars: 320, respetar_dialogos: true }
pausas: { entre_bloques_ms: 750, tras_punto_ms: 400, tras_coma_ms: 180 }
prosodia: { speed: 0.96, pitch: 0.0, matiz: NARRATIVO }
loudness: { objetivo: -19 LUFS, true_peak: -1.5 dBTP }
entregables: [wav_24k, mp3_192, m4b_capitulos, srt, csv_qa, informe_licencias]
qa: { duracion_tolerancia: 0.25, cobertura_min: 0.95, prohibir_clipping: true }
guardarrailes: { duracion_maxima: null, licencia_requerida: comercial }
```

### 8.1 Catalogo inicial (14 recetas)

| Receta | Estructura | Elenco | Motor final | Ritmo | Pausas | Loudness | Entregables clave | QA especifico |
|---|---|---|---|---|---|---|---|---|
| **Audiolibro** | capitulos / parrafos | 1 narrador (+personajes) | Kokoro o StyleTTS2 | speed 0.95-0.98 | 700-900 ms | -19 LUFS | WAV + MP3 + M4B con capitulos + SRT | cobertura, duracion, respiracion entre capitulos |
| **Cuentos infantiles** | escenas | narrador + 2-4 personajes | Kokoro mezclas + Qwen DNA | 0.90-0.95 | 900-1200 ms | -18 LUFS | WAV + MP3 | consistencia de personaje entre escenas |
| **E-learning** | lecciones / pasos | instructor (+alumno) | Piper high o Kokoro | 1.00-1.05 | 300-400 ms | -16 LUFS | WAV + MP3 + SRT + CSV por leccion | duracion por leccion, terminos del glosario |
| **Podcast 2 voces** | bloques de dialogo | host A + host B | Kokoro (2 voces) | 1.02-1.08 | 200-300 ms | -16 LUFS | WAV/MP3 mezclado + pistas separadas | solapamientos, cambios de turno |
| **Locucion de radio / spot** | 1-3 frases | 1 locutor | Piper high (rapido) | 1.05-1.12 | 80-150 ms | -16 LUFS, TP -1 | WAV 48k + MP3 + version 15/30/60 s | **duracion exacta**, fit-to-duration |
| **Conferencia / clase** | secciones | 1 ponente | Kokoro | 0.98 | 500 ms | -18 LUFS | WAV + MP3 + SRT | bloques largos, cifras normalizadas |
| **Entrevista** | preguntas/respuestas | entrevistador + invitado | Kokoro o F5 (clon) | 1.00 | 400 ms | -17 LUFS | WAV mezclado + pistas | turnos, silencios entre turnos |
| **Publicidad multi-version** | versiones A/B/C | 1-2 voces | Piper (iteracion) + Kokoro | variable | 100 ms | -16 LUFS | 3 versiones + reporte de duracion | todas <= objetivo |
| **Audiodescripcion** | escenas con timecode | 1 narrador | Kokoro | 0.98 | variable | -20 LUFS | WAV + SRT/VTT sincronizado | **ajuste a hueco entre dialogos** |
| **Doblaje sobre SRT** | cues | elenco por personaje | F5 o Cosy | 1.00 | 0 | -20 LUFS | WAV por cue + SRT re-timing | fit-to-duration por cue |
| **IVR / telefonia** | menus y prompts | 1 voz clara | Piper low (16 kHz) | 1.05 | 150 ms | -23 LUFS mono 8/16 kHz | WAV 8 kHz mono | listo para PBX, longitud de prompt |
| **Meditacion / relax** | frases cortas | 1 voz | CosyVoice susurro / Kokoro | 0.85-0.90 | 2000-4000 ms | -21 LUFS | WAV + MP3 largo | pausas largas reales, sin clipping |
| **Noticias / boletin** | noticias | 1-2 locutores | Piper high | 1.06 | 200 ms | -16 LUFS | WAV + MP3 + SRT | siglas y cifras (glosario obligatorio) |
| **Videojuego / NPC** | lineas | elenco | Piper (volumen) + Qwen DNA | variable | 100 ms | -18 LUFS | WAV por linea con ID | nombres de archivo por ID, lote grande |

Todas comparten infraestructura; lo que cambia es la **receta**, no el codigo. Anadir
una receta nueva debe ser escribir 20 lineas de YAML, no tocar la UI.

### 8.2 Guardarrailes que dan valor de verdad

- **Spot de 30 s**: al exportar, si la suma no cabe, Atlas propone el `speed` por bloque
  que la hace caber (dentro de +/-12 %) y muestra el resultado antes/despues. Si no cabe,
  avisa y sugiere que frase recortar.
- **E-learning con video**: importas el SRT del video y Atlas ajusta cada cue a su hueco
  (ver 11.2).
- **Audiolibro**: si un bloque dura menos de lo esperado para su longitud (por ejemplo
  1,8 s para 90 caracteres), lo marca como sospechoso: es el sintoma tipico de una
  alucinacion o de un corte.
- **Radio**: avisa si un numero se leyo como cifra y no como texto normalizado.

---

## 9. Elenco y clonacion guiada

### 9.1 Casting del proyecto

El elenco es una lista de roles (`narrador`, `personaje_1`, `host_b`, `instructor`), cada
uno apuntando a una voz (nativa, clonada o disenada) con su condicionamiento bloqueado.
La UI de asignacion es una tabla, no un selector escondido:

```
 ROL            VOZ                      ORIGEN        PREVIEW   BLOQUES
 narrador       em_alex (Kokoro)         nativa        [play]    148
 personaje_1    custom_f5_elena_a3       clonada       [play]     22
 personaje_2     dna_qwen_abuelo_7        disenada      [play]     18
 (sin asignar)  -                        -             -           6
```

### 9.2 Grabacion guiada de la referencia

Hoy el laboratorio pide un WAV y una transcripcion que el usuario escribe de memoria, y
la guia (`docs/GUIA_GRABACION_CLONACION.md`) exige que la transcripcion coincida
**exactamente**. Atlas convierte esa guia en un flujo:

1. **Prueba de sala**: 5 s de silencio para medir ruido de fondo y decidir si vale.
2. **Teleprompter** con los 6 guiones calibrados que ya existen en la guia (pangrama,
   narrativa calida, conversacional, comercial, corporativo, intimo).
3. **Medidor en vivo**: nivel, picos, SNR estimado, duracion.
4. **Puerta de calidad** antes de aceptar: duracion 7-12 s, sin clipping, SNR minimo,
   voz detectada, transcripcion verificada.
5. **Transcripcion**: se pega la del teleprompter (ya la conoce el sistema) y se
   verifican discrepancias; opcionalmente ASR local para audio externo (11.3).
6. **Consentimiento** (9.3).
7. **Bloqueo de condicionamiento** y prueba A/B: la misma frase con la nueva voz y con
   la voz mas cercana del catalogo.

### 9.3 Consentimiento y procedencia (obligatorio en un producto de clonacion)

Cada voz clonada guarda: nombre del titular, fecha, declaracion de consentimiento,
uso permitido (personal / comercial), y huella de la referencia. Al exportar, el informe
incluye esa cadena de procedencia. Se puede ademas marcar el audio con metadatos de
procedencia (chunk `LIST-INFO` del WAV / ID3 del MP3) sin alterar la senal. No es
burocracia: es lo que permite usar el producto en un trabajo profesional sin discutir
de donde salio una voz.

---

## 10. IA local: donde aporta y donde no

Hoy la app dice "PHI - DIRECTML LOCAL" de forma fija y el usuario nunca sabe si el
prompt lo mejoro un modelo o una plantilla de heuristicas. En Atlas la IA local tiene
**tareas concretas y visibles**:

| Tarea | Modelo | Donde | Fallback honesto |
|---|---|---|---|
| Limpiar el guion (muletillas, repeticiones, puntuacion) | Phi-3.5 | editor, boton "limpiar" | reglas del normalizador |
| Expandir una descripcion de voz a ficha tecnica | Phi-3.5 | DNA / casting | heuristicas (ya existen) |
| Detectar hablantes en un guion (`—`, `NARRADOR:`) | Phi-3.5 + reglas | importar documento | solo reglas |
| Sugerir receta para un guion pegado | Phi-3.5 | Quick / Importar | clasificador por palabras clave |
| Notas de episodio, resumen, tags | Phi-3.5 | podcast | ninguno (opcional) |
| Transcribir una referencia externa | ASR local opcional | clonacion | pedir transcripcion al usuario |
| Verificar que el audio dice lo que dice el guion | ASR local opcional | QA | omitir la comprobacion |

Reglas de diseno:

1. **Nunca silenciosa**: cada uso de IA local muestra que motor respondio
   (`engine_used`, que el backend ya devuelve) o "heuristicas".
2. **Nunca bloqueante**: si Phi no esta, todo sigue funcionando.
3. **Bajo el mismo `MemoryManager`**: hoy Phi se carga fuera de la politica Zero-OOM y
   compite por RAM/VRAM con el motor TTS. En Atlas es un motor mas de la cola.

---

## 11. QA automatico: el foso del producto

Generar voz es commodity. Lo caro es **no tener que escuchar 8 horas**.

### 11.1 Chequeos por bloque (todos offline, en CPU, ~milisegundos)

| Chequeo | Como | Que detecta |
|---|---|---|
| Duración vs longitud | `caracteres / duracion` contra la mediana del motor y la voz | texto truncado, bloque vacio, alucinacion |
| Cobertura de palabras | normalizado del guion vs normalizado esperado | numeros o siglas mal expandidos |
| Clipping / DC / pico | ya existe en `audio_dsp` | saturacion, motor mal calibrado |
| Silencio inicial y final | `remove_dc_and_normalize(trim_silence)` | concatenaciones con huecos |
| Loudness integrado y true peak | EBU R128 (nuevo, numpy/scipy) | fuera de norma del formato |
| Repeticion o bucle | autocorrelacion en los ultimos 300 ms | alucinacion tipica de modelos autoregresivos |
| Consistencia de voz | embedding simple (MFCC/pitch medio) vs mediana del proyecto | un bloque "suena a otra voz" en un audiolibro |
| RTF anomalo | comparacion con la mediana de la sesion | el motor cayo a CPU o hubo swap |

Resultado: un **semáforo por bloque** y una lista corta de "escucha estos 3". El usuario
aprueba por excepcion, no por defecto.

### 11.2 Fit-to-duration (duracion objetivo por bloque)

Necesario para radio, publicidad, doblaje y audiodescripcion:

1. Se renderiza la toma.
2. Si `duracion > objetivo`, se recalcula `speed = speed * duracion / objetivo`.
3. Si el nuevo `speed` cae dentro del limite de la receta (p. ej. +/-12 %), se
   re-renderiza (barato con Piper: 40 ms) y se valida.
4. Si no cabe ni al limite, se marca `IMPOSIBLE` y se propone recorte de texto o cambio
   de motor.

Como el backend ya acepta `speed` por peticion y ya sintetiza por bloques, esto es
viable sin tocar los motores.

### 11.3 SRT y subtitulos gratis (consecuencia del modelo por bloques)

Como cada bloque se sintetiza por separado, **se conoce su duracion exacta**. Concatenando
con las pausas de la receta se obtienen los tiempos reales de cada bloque: se exporta
`SRT`/`VTT` con marcas exactas, sin alineador forzado y sin coste. Para audiolibros
(trocear por frase) y elearning (sincronizar con video) esto es un entregable directo.
Si se quiere nivel palabra, ahi si hace falta ASR local con timestamps.

---

## 12. Entregables

```
proyecto/Patagonia_Cap07/
   audio/       cap07_narrador_24k.wav, cap07_mix.mp3, cap07.m4b
   subtitulos/  cap07.srt, cap07.vtt
   reportes/    qa_cap07.csv, licencias_cap07.md, metricas.json
   tomas/       07-014_t1.wav, 07-014_t2.wav  (solo si se pide)
```

- **Formatos**: WAV PCM 16/24, MP3 (encoder empaquetado, no descargado), M4B con
  capitulos (ffmpeg empaquetado), mono/estereo.
- **Loudness**: EBU R128 con objetivo por receta, true peak limiting.
- **Mezcla**: pistas separadas por rol + mezcla final, con musica de fondo del usuario y
  ducking automatico para podcast y radio.
- **Paquete**: ZIP por documento o por proyecto, con el JSON de auditoria que ya genera
  el backend.

---

## 13. Licencias: el problema que hoy nadie ve

`MMS-TTS` es **CC-BY-NC-4.0** (no comercial) y `XTTS-v2` es **CPML de uso personal**,
pero la UI los presenta igual que un Apache-2.0. En un trabajo remunerado eso es un
riesgo real para el usuario.

Propuesta: **motor de politicas de licencia**

1. Cada receta declara `licencia_requerida: comercial | personal`.
2. Cada motor lleva `uso_comercial: true | false | con_condiciones`.
3. La UI no oculta los motores no comerciales, pero: los marca, no los propone por
   defecto en recetas comerciales y muestra el motivo.
4. Al exportar, se genera un **informe de licencias** del proyecto: motor, uso, licencia,
   bloques afectados y aviso si se uso un motor NC en un proyecto comercial.
5. El asesor de motor (14.3) excluye automaticamente lo no comercial cuando la receta
   es comercial.

---

## 14. Asistente de decision: que motor usar

### 14.1 Tabla de decision (implementada como reglas, no como UI)

| Si el caso es... | Entonces |
|---|---|
| Proyecto comercial | excluir MMS y XTTS |
| Necesito acentos MX/AR/ES nativos | Piper (12 voces) |
| > 2 h de audio | Piper para borrador, final selectivo |
| Voz que no existe en el mercado | Qwen3 VoiceDesign (recetas DNA) |
| Voz del cliente con 10 s de muestra | F5 (MIT) o CosyVoice |
| Spot con tiempo exacto | Piper + fit-to-duration |
| Necesito 0 dependencias de runtime externo | Kokoro + Piper + MMS (solo ONNX) |
| Sin GPU / portatil | Piper (peor caso 0,06 RTF) |

### 14.2 Estimador de tiempo en la UI

`tiempo_estimado = caracteres / (chars_por_segundo_medido * motor)` y se recalcula con
las metricas reales de cada proyecto (el JSON auditado ya guarda `rtf` y
`duracion_audio_seg`). El boton "Renderizar" dice "66 bloques - 2 min 11 s" en lugar de
un spinner.

### 14.3 "Explicame por que este motor"

Cada recomendacion lleva su justificacion en una linea: "Piper: 0,05 RTF, licencia MIT,
acento MX nativo, prosodia simple; ideal para borrador". Sin cajas negras.

---

## 15. Arquitectura tecnica propuesta

### 15.1 Principio: no tocar el motor, reescribir el producto

```
+--------------------------------------------------------------+
|  UI (React + Vite)  ->  reemplaza FigmaMakeApp por features  |
+--------------------------------------------------------------+
|  API FastAPI            /projects /documents /blocks /takes  |
|                         /jobs /recipes /cast /exports /qa    |
+--------------------------------------------------------------+
|  DOMINIO NUEVO          projects, documents, blocks, takes,  |
|  (src/domain/)          recipes, cast, licenses, exports     |
+--------------------------------------------------------------+
|  SERVICIOS NUEVOS       jobs (cola), qa, loudness, mixdown,  |
|  (src/produce/)         srt/vtt, import, watchfolder, cli    |
+--------------------------------------------------------------+
|  REUTILIZADO TAL CUAL   src/ai/* (8 adaptadores),            |
|                         src/core/{audio_dsp, text_normalizer,|
|                         memory_manager, config, hardware,    |
|                         custom_voice_store, prompt_enhancer} |
+--------------------------------------------------------------+
|  PERSISTENCIA           SQLite (stdlib) + JSON auditado      |
|                         por toma, como hoy                   |
+--------------------------------------------------------------+
```

Lo que ya esta bien y se conserva sin discusion: los 8 adaptadores y su contrato
`BaseTTSEngine`, la politica single-active-engine con `RLock`, el fallback DirectML->CPU
con `warmup`, el normalizador fonetico, el DSP en numpy/scipy, la validacion de rutas y
el JSON gemelo por audio.

### 15.2 Arbol de modulos propuesto

```
src/
  ai/                 (sin cambios)
  core/               (sin cambios; + loudness.py)
  domain/             NUEVO
    models.py         Project, Document, Block, Take, Role, Recipe, VoiceRef
    repository.py     acceso SQLite (dataclasses, sin ORM)
    recipes.py        carga de recetas YAML + validacion
    licenses.py       politicas por motor y por proyecto
  produce/            NUEVO
    jobs.py           cola persistente, un worker GPU + workers CPU
    pipeline.py       importar -> normalizar -> asignar -> render -> qa -> export
    qa.py             chequeos de 11.1
    loudness.py       EBU R128 (integrado, LRA, true peak)
    mixdown.py        mezcla de pistas + ducking
    subtitles.py      SRT/VTT desde duraciones de bloque
    fit.py            fit-to-duration
    importer.py       DOCX/MD/TXT/SRT/CSV -> bloques
  api/routes_v2/      NUEVO (la v1 se mantiene para /synthesize directo)
  cli/                NUEVO  (atlas render | batch | watch | doctor)
  ui/                 reescritura por features
```

### 15.3 Modelo de datos (SQLite, sin dependencias)

```sql
projects(id, name, format, license_required, recipe_id, created_at, settings_json)
documents(id, project_id, title, order_index, source_path, word_count)
blocks(id, document_id, order_index, text, normalized_text, role, state,
       chosen_take_id, target_duration_ms)
takes(id, block_id, engine, voice_id, params_json, wav_path, duration_ms,
      rtf, qa_json, qa_state, created_at, conditioning_hash)
cast(id, project_id, role, voice_ref_type, voice_ref_id, locked, preview_take_id)
recipes(id, format, yaml_path, version, builtin)
jobs(id, project_id, kind, payload_json, state, progress, attempts, error, updated_at)
glossaries(id, project_id, term, pronunciation)
exports(id, project_id, kind, path, created_at, license_report)
```

Por que SQLite y no JSON sueltos: consultas por estado ("bloques pendientes"), reanudacion
tras cierre, y relaciones (toma aprobada de un bloque). Es stdlib (`sqlite3`), offline y
transaccional. El JSON auditado por audio se mantiene como hoy: trazabilidad granular
junto al WAV.

### 15.4 API (resumen)

```
POST   /api/v2/projects                       crear proyecto desde receta
POST   /api/v2/projects/{id}/documents/import subir DOCX/MD/SRT/TXT/CSV
POST   /api/v2/projects/{id}/cast             asignar/bloquear rol
POST   /api/v2/blocks/{id}/render             una toma (sincrono si es corto)
POST   /api/v2/blocks/{id}/takes/{t}/approve  aprobar toma
POST   /api/v2/documents/{id}/render          encola documento (borrador|final)
GET    /api/v2/jobs?project=                  estado de la cola
GET    /api/v2/jobs/{id}/events               SSE de progreso
POST   /api/v2/projects/{id}/export           entregables + informe
GET    /api/v2/recipes /api/v2/engines/{id}/capabilities
POST   /api/v2/batch                          CSV/SRT carpeta
```

Se mantiene `POST /api/v1/synthesize` para integraciones y para Quick.

### 15.5 Cola: una GPU, muchos nucleos

Restriccion real: DirectML se serializa (ya hay `inference_lock`) y un solo motor pesado
reside a la vez. La cola lo asume en lugar de pelearse con ello:

- **1 worker GPU**: ejecuta inferencia en orden de prioridad por proyecto/documento.
- **N workers CPU** (hilos): normalizacion, QA, loudness, mezcla, subtitulos, import.
- **Agrupacion por motor**: la cola ordena por motor para evitar recargas de pesos
  (hoy cada cambio de motor desaloja y recarga; agrupar ahorra minutos por trabajo).
- **Reanudable**: cada bloque commitea su toma; un cierre inesperado no pierde progreso.
- **Pausable**: entre bloques, nunca a mitad de una inferencia.

Solo con agrupar por motor, un audiolibro evita decenas de `unload`/`load` de 5 s.

### 15.6 Frontend

- React + Vite, pero **partido por features** (`projects`, `produce`, `cast`, `recipes`,
  `batch`, `library`, `settings`), no un archivo de 4.500 lineas.
- Estado de servidor con **TanStack Query** (cache, reintentos, invalidacion tras render)
  y estado local minimo; hoy todo es `useState` manual con `fetch` repetido.
- **Design tokens** (superficie, texto, borde, acento, estados) y 3 temas validados por
  contraste automatico, en lugar de 10 temas con parches por componente.
- **Tipografia minima 12 px** y densidad medida; los 7-8 px actuales desaparecen.
- **Accesibilidad de serie**: foco visible global, `aria-live` para la cola y los
  errores, navegacion completa por teclado, sin bloquear zoom.

---

## 16. Que se conserva, que se retira, que se anade

| Del VozStudio actual | Decision |
|---|---|
| `src/ai/*` (8 adaptadores, `BaseTTSEngine`) | **Conservar tal cual** |
| `memory_manager`, `hardware`, `config` | Conservar (+ integra Phi en el manager) |
| `text_normalizer` (600 lineas) | Conservar; **exponer** el resultado al usuario |
| `audio_dsp` (DSP, WAV, biblioteca) | Conservar; anadir loudness y mezcla |
| `custom_voice_store` | Conservar; anadir consentimiento y bloqueo |
| JSON auditado por audio | Conservar; enlazarlo a `takes` |
| `prompt_enhancer` | Conservar; hacer visible `engine_used` |
| Los 4 "conceptos" de Figma (A-E) | **Retirar** (`concept = "A"` fijo, variantes inalcanzables) |
| `App.tsx` + `components/` (codigo muerto) | **Retirar**, rescatando `Paginator`, `Waveform` canvas y el segmentador |
| Telemetria fija (GPU 68 %, RAM 13,4 GB, "8/8", "1.8 GB") | **Retirar**: datos reales o "sin datos" |
| Segmentacion decorativa, "Sintetizar bloque" duplicado | **Retirar**: bloques reales |
| Proyectos en `localStorage` | **Sustituir** por dominio real |
| Presets de 40 tarjetas con speed/pitch | **Sustituir** por recetas por formato |
| `lucide-react` sin uso, Tailwind sin uso | Retirar del bundle |
| Modelo Proyecto/Bloque/Toma | **Anadir** |
| Elenco, casting, voice lock | **Anadir** |
| Cola de trabajos + SSE + reanudacion | **Anadir** |
| QA automatico | **Anadir** |
| Fit-to-duration, SRT/VTT, M4B, loudness, mezcla | **Anadir** |
| Licencias y consentimiento | **Anadir** |
| CLI, carpeta vigilada, webhooks | **Anadir** |

---

## 17. Que se puede prometer con los RTF medidos

Numeros reales del benchmark (frase de 88 caracteres):

| Trabajo | Piper (RTF 0,05) | Kokoro (RTF 0,285) | MMS (RTF 0,38) |
|---|---|---|---|
| 1 spot de 30 s | 2 s | 9 s | 12 s |
| 1 leccion de 10 min | 30 s | 2 min 51 s | 3 min 50 s |
| 1 capitulo de 1 h | 3 min | 17 min | 23 min |
| Audiolibro de 8 h (borrador) | **24 min** | 2 h 17 min | 3 h 4 min |
| Curso de 30 x 10 min (borrador) | **15 min** | 1 h 25 min | 1 h 55 min |

Conclusion de producto: **prometer "8 horas en 24 minutos" solo es honesto con Piper en
modo borrador**, y eso debe estar escrito en la receta y en el estimador. Con Kokoro, la
promesa es "un capitulo en 17 minutos". La UI que muestra un spinner sin numero es la que
hace que el usuario pierda la confianza.

---

## 18. Roadmap

Supuesto: 1 desarrollador senior full-stack + diseno parcial. Semanas calendario.

### Fase 0 - Cimientos (2 semanas)
- Dominio + SQLite + migracion del catalogo de motores y voces.
- Recetas YAML (4 recetas: audiolibro, elearning, spot, podcast) + validador.
- Import de TXT/MD; segmentacion reutilizando `text_normalizer`.
- Job minimo: renderizar documento completo con un motor, progreso por SSE.
- **Aceptacion**: un `.md` de 20.000 caracteres se convierte en 70 bloques y se renderiza
  con progreso visible y sin perder estado si se cierra la app.

### Fase 1 - Producir (3 semanas)
- Pantalla PRODUCIR (arbol, editor por bloques, inspector, cola).
- Tomas multiples, aprobacion, regeneracion por bloque.
- Elenco + casting + voice lock (condicionamiento persistido).
- Estimador de tiempo real y agrupacion de la cola por motor.
- **Aceptacion**: audiolibro de 2 capitulos producido entero desde la app, aprobando
  bloque a bloque, en menos tiempo que escuchandolo (objetivo: menos de 2x la duracion
  del audio con Kokoro, menos de 0,2x con Piper en borrador).

### Fase 2 - Confiar (3 semanas)
- QA automatico (tabla 11.1) + semaforo + "escucha solo lo marcado".
- Loudness EBU R128 + true peak + mezcla con ducking.
- Export: WAV/MP3/M4B/ZIP + SRT/VTT + CSV de QA + informe de licencias.
- Consentimiento y procedencia en voces clonadas.
- **Aceptacion**: de un capitulo de 1 h, el QA marca menos del 5 % de bloques y todos los
  motores usados aparecen correctamente en el informe de licencias.

### Fase 3 - Automatizar (2-3 semanas)
- CLI (`render`, `batch`, `watch`, `doctor`), carpeta vigilada, webhooks.
- Lotes desde CSV y desde SRT (con fit-to-duration).
- Reintentos, prioridades, ventana horaria.
- **Aceptacion**: soltar 30 `.md` en `inbox/` produce 30 entregables completos sin abrir
  la UI, con informe por trabajo.

### Fase 4 - Ampliar (continuo)
- ASR local opcional (transcripcion y verificacion de guion, SRT a nivel palabra).
- Casting asistido por IA (describir personaje, proponer 3 voces y auditarlas).
- Colaboracion local (perfiles, revision por otra persona, comentarios por bloque).
- Multi-idioma (Piper/Kokoro tienen modelos; la UI Omni-ES es una decision, no un limite).
- Integraciones: plugin para editor de video que consume la API.

---

## 19. Metricas de exito del producto

- **% de bloques aprobados sin regenerar** (calidad de la primera toma). Objetivo > 90 %.
- **Minutos de render por hora de audio**, por motor (rendimiento real, no percibido).
- **% de bloques marcados por QA** (sensibilidad del detector; validar contra escucha).
- **Tiempo desde importar hasta entregable** (la metrica del usuario, no la del motor).
- **Reutilizacion**: recetas y elencos reutilizados por proyecto.
- **Cero audio entregado con motor no comercial sin aviso**.

---

## 20. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Licencias NC (MMS, XTTS) usadas en trabajo pagado | Legal/reputacional | Politica de licencias + informe + exclusion en recetas comerciales |
| Un solo motor pesado en memoria limita el paralelismo | Rendimiento | Cola single-GPU + agrupacion por motor + CPU para QA/DSP |
| Consistencia entre sesiones en zero-shot | Calidad narrativa | Voice lock (condicionamiento persistido + seed) |
| QA con falsos positivos | Ruido y desconfianza | Calibrar umbrales por motor/voz con las metricas del propio proyecto |
| Fit-to-duration con textos demasiado largos | Imposible de cumplir | Limite declarado en la receta + propuesta de recorte, nunca forzar |
| Scope creep (M4B, ASR, mezcla, colaboracion) | Retraso del nucleo | Fases 0-2 primero; lo demas detras de banderas |
| Dependencias nuevas (ffmpeg, encoder MP3) | Instalacion | Empaquetarlas o usar alternativas nativas; `atlas doctor` verifica |
| Windows-only | Mercado | La capa Python ya es portable salvo `hardware.py` (ctypes Win32); abstraer y probar en Linux |
| Phi fuera de la politica de memoria | Inestabilidad | Integrarlo como motor de la cola |

---

## 21. Decisiones que necesito de ti

1. **Alcance del primer entregable**: ¿Fase 0+1 (producir) o prefieres ver antes un
   prototipo visual navegable de la pantalla PRODUCIR con datos simulados?
2. **Licencias**: ¿el producto se usara en trabajos comerciales? Si es asi, MMS y XTTS
   pasan a "solo banca de pruebas" y conviene priorizar F5 (MIT) como motor de clonacion
   principal.
3. **Musica y SFX**: ¿se incluyen en el alcance (mezcla con ducking) o la mezcla se hace
   fuera, en el editor de video?
4. **ASR local**: ¿lo quieres en el alcance (transcripcion y verificacion de guion) o se
   puede dejar para Fase 4 aceptando que la transcripcion de referencia sea manual?
5. **Repositorio**: ¿evolucionamos este mismo repo (backend reutilizado, UI nueva, v1
   congelada) o prefieres un repositorio nuevo que consuma el backend actual como
   libreria?
6. **Nombre**: ¿Atlas, Forja, Coral, otro?

---

*Propuesta de producto basada en el codigo real del repositorio y en los RTF medidos en
`docs/benchmark_results.json`. Los tiempos son extrapolaciones lineales del benchmark;
conviene re-medirlos con textos largos antes de fijar promesas comerciales.*
