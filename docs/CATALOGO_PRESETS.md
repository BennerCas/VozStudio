# Catálogo de presets de VozStudio Omni-ES

Este documento exporta el catálogo que la aplicación materializa en
`src/ui/src/data/presetCatalog.ts`: 40 recetas de producción, 20 en
**Fundamentos** y 20 en **Latino neural**.

## Qué es y qué no es un preset

Un preset es una **receta de producción reproducible**, no una voz entrenada ni
una simple etiqueta. Al pulsar **Aplicar**, la app conserva la receta de forma
temporal, abre **Estudio neural** y carga automáticamente el motor, la voz
predeterminada, velocidad, tono, matiz y texto de muestra. El usuario puede
reemplazar el texto y cambiar la voz antes de generar.

La receta actual tiene una sola voz predeterminada para que la tarjeta se pueda
usar con un clic. Esa voz es una referencia al inventario independiente de
voces; no queda incrustada ni bloqueada en el preset. Las voces personalizadas,
clonadas y de VoiceDesign siguen siendo entidades propias.

La preescucha de una tarjeta y el botón **Generar WAV real** sí ejecutan el
motor, envían la instrucción de diseño y crean un elemento nuevo en la
biblioteca. Aplicar la tarjeta, por sí solo, no genera audio.

> Estado actual importante: tras **Aplicar**, el modo de síntesis directa del
> Estudio neural conserva los seis ajustes operativos (motor, voz, velocidad,
> tono, matiz y texto), pero todavía no reinyecta `designInstruction` en la
> solicitud. Para que la receta sea íntegra en esa pantalla, falta conectar esa
> instrucción al estado del preset activo y reenviarla al sintetizar.

## Estructura actual

```ts
type StudioPreset = {
  id: string
  name: string
  collection: 'Fundamentos' | 'Latino neural' | 'Mis variantes'
  category: 'Narración' | 'Comercial' | 'Personajes' | 'Corporativo'
  engineId: string       // motor predeterminado
  voiceId: string        // voz predeterminada, referenciada por id
  voiceName: string
  speed: number
  pitch: number          // semitonos
  emotion: 'NEUTRO' | 'NARRATIVO' | 'CÁLIDO' | 'INFORMATIVO' | 'EXPRESIVO'
  color: string
  script: string         // texto cohesivo de muestra, editable
  designFamily: string
  designInstruction: string // prompt cohesivo para el motor
}
```

Por tanto, no es un checklist plano. Sus campos producen dos salidas distintas:

1. **Texto de muestra** (`script`): una frase cohesiva que sirve para probar el
   caso de uso y que el usuario puede sustituir por su guion real.
2. **Prompt de diseño** (`designInstruction`): instrucción completa de timbre,
   interpretación y parámetros. Es especialmente útil para Qwen3 VoiceDesign;
   el resto de motores recibe los parámetros que admite.

## Relación correcta entre preset y voz

La pantalla de aterrizaje debe mostrar la intención —por ejemplo, “podcast
cercano” o “tráiler”—, no obligar a elegir una voz antes de saber qué se va a
producir. El flujo recomendado, y el que ya inicia la app, es:

```text
Pantalla Presets → elegir receta → Aplicar → Estudio neural ya configurado
                                         ↘ Preescuchar → WAV en biblioteca
```

Una receta sí debe tener una voz inicial, pero para una evolución más rica no
debería limitarse a ella. El modelo recomendado sería mantener la voz como
entidad separada y añadir opciones compatibles al preset:

```ts
type PresetVoiceChoice = {
  voiceId: string
  role: 'predeterminada' | 'alternativa'
  rationale: string
}

type FutureStudioPreset = StudioPreset & {
  voiceChoices: PresetVoiceChoice[]
}
```

Así, “Podcast natural” podría abrir con Nova CosyVoice, pero ofrecer Dora
Neural, una voz personalizada o una clonación compatible sin duplicar el
preset. Este campo de alternativas aún **no está implementado** en el catálogo
actual: hoy sólo existe `voiceId`/`voiceName` como opción predeterminada.

## Cómo se compone el prompt

Cada entrada de este catálogo da los valores necesarios para reconstruir el
prompt exacto con esta plantilla:

```text
Diseña {nombre} para español latino con {persona}.
Interpretación: {instrucción de familia}.
Micrófono cercano y seco, sin música, sin reverberación, sin eco y sin efectos de sala.
Ejecuta con {voz} en {motor}, velocidad {velocidad}x, tono {tono} semitonos y matiz {matiz}.
Mantén dicción latinoamericana natural, respiraciones discretas y pausas sólo donde ayuden al sentido.
```

Las familias y sus instrucciones son:

| Familia | Instrucción de interpretación |
| --- | --- |
| Documental humano | Cadencia reflexiva, pausas breves entre ideas, intención observadora y cierre sereno. |
| Conversación cercana | Ritmo natural de conversación, sonrisa leve, respiración discreta y énfasis cálido en las preguntas. |
| Comercial contemporáneo | Energía medida, articulación precisa, intención persuasiva sin gritar y remate memorable. |
| Formación clara | Velocidad didáctica, pronunciación limpia, pausas antes de los conceptos y tono que acompaña. |
| Personaje controlado | Interpretación reconocible y expresiva, sin caricatura extrema, conservando inteligibilidad en español latino. |
| Poesía íntima | Fraseo musical suave, silencios con intención, consonantes delicadas y una emoción contenida. |
| Deportivo en vivo | Impulso ascendente, dicción rápida pero nítida, energía de estadio y énfasis en las acciones decisivas. |
| Romántico cercano | Timbre próximo, volumen moderado, pausas afectivas y una sonrisa audible sin susurrar artificialmente. |
| Suspenso cinematográfico | Ritmo contenido, graves controlados, pausas tensas y finales de frase que dejen expectativa. |
| Urbano rítmico | Ataque ágil, acentos rítmicos limpios, confianza de calle y consonantes definidas sin perder claridad. |
| Tropical festivo | Sonrisa abierta, energía bailable, frases luminosas y pulsación alegre sin saturar la voz. |
| Periodismo de campo | Entrega directa, datos claros, urgencia moderada y una presencia confiable de reportaje en español latino. |

## Catálogo

En cada ficha, **Voz inicial** indica el motor y la voz que se cargarán al
aplicar. **Persona** y **familia** alimentan el prompt de diseño según la
plantilla anterior.

### Fundamentos

#### 01. Documental íntimo

- ID: `documental-intimo` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 0.90x · -0.5 semitonos · NARRATIVO
- Familia: Documental humano · Persona: narrador masculino maduro, cercano y profundo.
- Texto: “En el silencio de la cordillera, cada paso revela una historia que la naturaleza ha guardado durante siglos.”

#### 02. Tráiler cinematográfico

- ID: `trailer-cinematografico` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.05x · +1.0 semitonos · EXPRESIVO
- Familia: Suspenso cinematográfico · Persona: narrador masculino de registro grave, épico y contenido.
- Texto: “Cuando todo parecía perdido, una decisión cambiará el destino de quienes se atreven a avanzar.”

#### 03. Podcast natural

- ID: `podcast-natural` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_nova_es` — Nova CosyVoice
- Parámetros: 1.00x · +0.0 semitonos · NEUTRO
- Familia: Conversación cercana · Persona: locutora adulta, amable y espontánea.
- Texto: “Hoy queremos conversar sin prisa sobre las ideas que hacen más humano nuestro trabajo cada día.”

#### 04. Comercial premium

- ID: `comercial-premium` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.05x · +0.5 semitonos · EXPRESIVO
- Familia: Comercial contemporáneo · Persona: locutora elegante, segura y sobria.
- Texto: “Descubre una experiencia diseñada para acompañarte con precisión, elegancia y atención a cada detalle.”

#### 05. Audiolibro cálido

- ID: `audiolibro-calido` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_nova_es` — Nova CosyVoice
- Parámetros: 0.90x · +0.0 semitonos · CÁLIDO
- Familia: Poesía íntima · Persona: narradora adulta con intimidad de lectura nocturna.
- Texto: “Abrió la carta con cuidado y, al reconocer aquella caligrafía, comprendió que el viaje apenas comenzaba.”

#### 06. Noticias preciso

- ID: `noticias-preciso` · Categoría: Corporativo
- Voz inicial: `kokoro` · `es_blend_documental` — Mateo Documental
- Parámetros: 1.05x · +0.0 semitonos · INFORMATIVO
- Familia: Periodismo de campo · Persona: locutor masculino preciso, objetivo y estable.
- Texto: “Estas son las noticias principales de la jornada, con los datos verificados y el contexto necesario.”

#### 07. Corporativo moderno

- ID: `corporativo-moderno` · Categoría: Corporativo
- Voz inicial: `kokoro` · `es_blend_editorial` — Sofía Editorial
- Parámetros: 1.00x · +0.0 semitonos · INFORMATIVO
- Familia: Formación clara · Persona: locutor masculino moderno, calmo y competente.
- Texto: “Transformamos procesos complejos en soluciones claras para que cada equipo pueda avanzar con confianza.”

#### 08. Personaje juvenil

- ID: `personaje-juvenil` · Categoría: Personajes
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.10x · +2.0 semitonos · EXPRESIVO
- Familia: Personaje controlado · Persona: voz joven, ágil y optimista.
- Texto: “¡Vamos, no podemos quedarnos aquí! La mejor parte de la aventura está justo al otro lado.”

#### 09. Narrador épico

- ID: `narrador-epico` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 0.85x · +0.5 semitonos · EXPRESIVO
- Familia: Documental humano · Persona: narrador masculino amplio, noble y de gran presencia.
- Texto: “Y entonces, bajo el cielo encendido, los últimos guardianes levantaron su estandarte una vez más.”

#### 10. Meditación suave

- ID: `meditacion-suave` · Categoría: Narración
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.80x · -1.0 semitonos · CÁLIDO
- Familia: Conversación cercana · Persona: guía femenina serena, respirada y sin teatralidad.
- Texto: “Respira lentamente. Permite que el aire llegue sin esfuerzo y suelta, poco a poco, lo que ya no necesitas.”

#### 11. Radio enérgica

- ID: `radio-energica` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.15x · +1.0 semitonos · EXPRESIVO
- Familia: Comercial contemporáneo · Persona: animador masculino joven, dinámico y sonriente.
- Texto: “¡Muy buenos días! Arrancamos con la energía que necesitas para poner en marcha tus mejores planes.”

#### 12. E-learning claro

- ID: `elearning-claro` · Categoría: Corporativo
- Voz inicial: `kokoro` · `ef_dora` — Dora Neural
- Parámetros: 0.95x · +0.0 semitonos · NARRATIVO
- Familia: Formación clara · Persona: tutora paciente, clara y muy articulada.
- Texto: “En esta lección aprenderás a identificar los tres pasos que convierten una idea en una acción medible.”

#### 13. Entrevista cercana

- ID: `entrevista-cercana` · Categoría: Corporativo
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.95x · +0.5 semitonos · CÁLIDO
- Familia: Conversación cercana · Persona: entrevistadora empática, curiosa y relajada.
- Texto: “Gracias por acompañarnos. Para empezar, ¿qué fue lo primero que te impulsó a iniciar este proyecto?”

#### 14. Doblaje neutro

- ID: `doblaje-neutro` · Categoría: Personajes
- Voz inicial: `kokoro` · `em_alex` — Alex Neural
- Parámetros: 1.00x · +0.0 semitonos · NEUTRO
- Familia: Personaje controlado · Persona: protagonista masculino natural, neutro y versátil.
- Texto: “Entiendo lo que dices, pero antes de decidir necesitamos revisar todas las posibilidades con calma.”

#### 15. Crónica nocturna

- ID: `cronica-nocturna` · Categoría: Narración
- Voz inicial: `kokoro` · `es_blend_documental` — Mateo Documental
- Parámetros: 0.90x · -0.5 semitonos · NARRATIVO
- Familia: Suspenso cinematográfico · Persona: cronista masculino sobrio, nocturno y reflexivo.
- Texto: “La ciudad continuaba despierta, aunque sus calles ya hablaban con el tono sereno de la madrugada.”

#### 16. Tecnología futura

- ID: `tecnologia-futura` · Categoría: Corporativo
- Voz inicial: `kokoro` · `em_alex` — Alex Neural
- Parámetros: 1.05x · +1.0 semitonos · INFORMATIVO
- Familia: Formación clara · Persona: presentador editorial de tecnología, claro y curioso.
- Texto: “La nueva plataforma integra inteligencia local, automatización verificable y control completo de los datos.”

#### 17. Historia emocional

- ID: `historia-emocional` · Categoría: Narración
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.90x · +0.5 semitonos · CÁLIDO
- Familia: Romántico cercano · Persona: narradora sensible, madura y luminosa.
- Texto: “Al volver a casa encontró la luz encendida y, por primera vez en mucho tiempo, dejó de sentir miedo.”

#### 18. Deportes dinámico

- ID: `deportes-dinamico` · Categoría: Comercial
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 1.20x · +1.5 semitonos · EXPRESIVO
- Familia: Deportivo en vivo · Persona: relator masculino de ritmo alto y entusiasmo controlado.
- Texto: “¡Últimos minutos del encuentro! El equipo acelera, recupera el balón y busca una oportunidad decisiva.”

#### 19. Lujo sereno

- ID: `lujo-sereno` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.85x · -0.5 semitonos · CÁLIDO
- Familia: Comercial contemporáneo · Persona: locutora de lujo, pausada, segura y silenciosa.
- Texto: “El verdadero lujo no necesita imponerse: se percibe en la calma, la materia y el tiempo bien elegido.”

#### 20. Asistente amable

- ID: `asistente-amable` · Categoría: Personajes
- Voz inicial: `kokoro` · `ef_dora` — Dora Neural
- Parámetros: 1.00x · +0.5 semitonos · CÁLIDO
- Familia: Conversación cercana · Persona: asistente femenina cordial, clara y resolutiva.
- Texto: “Claro, estaré encantada de ayudarte. Cuéntame qué necesitas y lo resolvemos paso a paso.”

### Latino neural

#### 21. Poeta latino

- ID: `poeta-latino` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_nova_es` — Nova CosyVoice
- Parámetros: 0.85x · +0.5 semitonos · CÁLIDO
- Familia: Poesía íntima · Persona: poeta femenina latinoamericana, íntima y contemplativa.
- Texto: “La lluvia toca los balcones de la ciudad y en cada gota despierta una palabra que todavía no sabía decir.”

#### 22. MC rapero latino

- ID: `mc-rapero-latino` · Categoría: Personajes
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 1.15x · +1.0 semitonos · EXPRESIVO
- Familia: Urbano rítmico · Persona: MC masculino joven, rítmico, seguro y expresivo.
- Texto: “Sube el ritmo, barrio presente, ideas en movimiento; cada rima abre camino y convierte el momento en talento.”

#### 23. Locutor de fútbol

- ID: `locutor-futbol` · Categoría: Comercial
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 1.20x · +1.5 semitonos · EXPRESIVO
- Familia: Deportivo en vivo · Persona: narrador deportivo masculino, intenso y muy inteligible.
- Texto: “¡Recupera la pelota en la mitad, acelera por la banda, levanta la mirada y remata! ¡Golazo para encender el estadio!”

#### 24. Romántico íntimo

- ID: `romantico-intimo` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_nova_es` — Nova CosyVoice
- Parámetros: 0.90x · +0.5 semitonos · CÁLIDO
- Familia: Romántico cercano · Persona: voz femenina adulta, afectiva y próxima.
- Texto: “Desde que llegaste, las tardes tienen otra luz y hasta el silencio aprendió a decir tu nombre con ternura.”

#### 25. Terror nocturno

- ID: `terror-nocturno` · Categoría: Personajes
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.85x · -1.0 semitonos · EXPRESIVO
- Familia: Suspenso cinematográfico · Persona: narrador masculino veterano, oscuro y contenido.
- Texto: “La casa permanecía inmóvil, pero desde el pasillo alguien repetía su nombre con una voz que no debía estar allí.”

#### 26. Cumbia tropical

- ID: `cumbia-tropical` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.15x · +1.0 semitonos · EXPRESIVO
- Familia: Tropical festivo · Persona: animadora femenina tropical, alegre y luminosa.
- Texto: “Que suene la cumbia, que se mueva la plaza y que esta noche cada paso tenga el sabor alegre de nuestra tierra.”

#### 27. Salsa brava

- ID: `salsa-brava` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.15x · +1.0 semitonos · EXPRESIVO
- Familia: Tropical festivo · Persona: animador masculino salsero, rápido y entusiasta.
- Texto: “La clave marca el camino, el barrio responde y la pista se enciende con una energía que nadie quiere soltar.”

#### 28. Relato regional mexicano

- ID: `relato-regional-mexicano` · Categoría: Narración
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.95x · -0.5 semitonos · NARRATIVO
- Familia: Documental humano · Persona: narrador mayor con cercanía regional y pausa familiar.
- Texto: “Al caer la tarde sobre la sierra, la familia se reunió para contar las historias que cruzaron generaciones enteras.”

#### 29. Relato caribeño

- ID: `relato-caribeno` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_nova_es` — Nova CosyVoice
- Parámetros: 1.00x · +0.5 semitonos · CÁLIDO
- Familia: Tropical festivo · Persona: narradora caribeña cálida, brillante y pausada.
- Texto: “El mar amaneció brillante y la brisa llevó hasta el malecón el aroma dulce de las frutas recién cortadas.”

#### 30. Locutora urbana

- ID: `locutora-urbana` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.10x · +0.5 semitonos · EXPRESIVO
- Familia: Urbano rítmico · Persona: locutora urbana contemporánea, directa y carismática.
- Texto: “La ciudad no se detiene, y tu idea tampoco. Conecta, crea y deja que tu voz encuentre a quienes están listos para escuchar.”

#### 31. Viaje latinoamericano

- ID: `viaje-latinoamericano` · Categoría: Comercial
- Voz inicial: `kokoro` · `es_blend_documental` — Mateo Documental
- Parámetros: 1.05x · +0.5 semitonos · INFORMATIVO
- Familia: Documental humano · Persona: presentador viajero, curioso y amable.
- Texto: “Recorre paisajes, sabores y ciudades que guardan una historia distinta en cada esquina de Latinoamérica.”

#### 32. Comedia cotidiana

- ID: `comedia-cotidiana` · Categoría: Personajes
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.10x · +1.0 semitonos · EXPRESIVO
- Familia: Personaje controlado · Persona: personaje femenina con humor cotidiano y sonrisa audible.
- Texto: “Yo venía por una sola cosa, pero salí con tres bolsas, una planta y la certeza de que no aprendí nada.”

#### 33. Suspenso policial

- ID: `suspenso-policial` · Categoría: Narración
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 0.90x · -0.5 semitonos · NARRATIVO
- Familia: Suspenso cinematográfico · Persona: detective masculino sereno, analítico y tenso.
- Texto: “La evidencia parecía sencilla, hasta que la detective encontró una fecha imposible escrita detrás de la fotografía.”

#### 34. Mito latinoamericano

- ID: `mito-latinoamericano` · Categoría: Narración
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.90x · -0.5 semitonos · NARRATIVO
- Familia: Poesía íntima · Persona: abuelo narrador, grave, misterioso y cálido.
- Texto: “Dicen los abuelos que, cuando la luna se queda quieta, los guardianes del monte vuelven a caminar entre los árboles.”

#### 35. Coach motivacional

- ID: `coach-motivacional` · Categoría: Comercial
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.10x · +1.0 semitonos · EXPRESIVO
- Familia: Comercial contemporáneo · Persona: coach masculino cálido, firme y sin agresividad.
- Texto: “No necesitas tener todo resuelto para empezar. Da el siguiente paso, aprende del camino y confía en tu proceso.”

#### 36. Streamer gaming

- ID: `streamer-gaming` · Categoría: Personajes
- Voz inicial: `cosyvoice` · `cosy_onyx_es` — Onyx CosyVoice
- Parámetros: 1.15x · +1.5 semitonos · EXPRESIVO
- Familia: Personaje controlado · Persona: streamer masculino joven, reaccionando con energía clara.
- Texto: “¡Atención al mapa! Tenemos una oportunidad, el equipo está listo y esta jugada puede cambiar toda la partida.”

#### 37. Poeta romántico

- ID: `poeta-romantico` · Categoría: Narración
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 0.85x · -0.5 semitonos · CÁLIDO
- Familia: Romántico cercano · Persona: poeta masculino maduro, vulnerable y elegante.
- Texto: “Te pensé en la distancia y descubrí que el corazón también tiene memoria para guardar los momentos que importan.”

#### 38. Crianza cercana

- ID: `crianza-cercana` · Categoría: Corporativo
- Voz inicial: `cosyvoice` · `cosy_nova_es` — Nova CosyVoice
- Parámetros: 0.95x · +0.5 semitonos · CÁLIDO
- Familia: Conversación cercana · Persona: orientadora femenina de crianza, paciente y protectora.
- Texto: “Acompañar también es escuchar. Cada pregunta de una niña o un niño es una oportunidad para crecer juntos.”

#### 39. Reportera en la calle

- ID: `reportera-calle` · Categoría: Corporativo
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.10x · +0.0 semitonos · INFORMATIVO
- Familia: Periodismo de campo · Persona: reportera femenina de campo, directa y confiable.
- Texto: “Estamos en el centro de la ciudad, donde vecinas y vecinos comparten cómo esta iniciativa transforma su día a día.”

#### 40. Animador de fiesta

- ID: `animador-fiesta` · Categoría: Personajes
- Voz inicial: `qwen3_tts` · `qwen3_voice_design` — Qwen3 VoiceDesign
- Parámetros: 1.20x · +1.5 semitonos · EXPRESIVO
- Familia: Tropical festivo · Persona: animador masculino festivo, potente y cercano.
- Texto: “¡Que se escuche hasta el último rincón! Levanten las manos, celebren con la gente y hagan de esta noche un recuerdo inolvidable.”

## Límites y trazabilidad

- Los campos de voz del preset son la selección inicial. El motor efectivo y la
  voz efectiva de cada WAV se conservan por separado en los metadatos de la
  biblioteca.
- Qwen3 VoiceDesign interpreta el prompt de diseño y genera un resultado que
  puede variar entre ejecuciones. Guardar ese resultado como voz personalizada
  conserva su descripción y configuración; no es un entrenamiento del modelo.
- F5-TTS no debe presentarse como una voz directa del preset: necesita audio y
  transcripción de referencia para clonar. Puede figurar como alternativa
  compatible cuando se implemente `voiceChoices`.
