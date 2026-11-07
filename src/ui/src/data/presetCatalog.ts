export type PresetCategory = 'Narración' | 'Comercial' | 'Personajes' | 'Corporativo'
export type PresetCollection = 'Fundamentos' | 'Latino neural' | 'Mis variantes'
export type PresetDesignFamily =
  | 'documental'
  | 'conversacional'
  | 'comercial'
  | 'formativo'
  | 'personaje'
  | 'poetico'
  | 'deportivo'
  | 'romantico'
  | 'suspenso'
  | 'urbano'
  | 'tropical'
  | 'periodistico'

export type PresetEmotion =
  | 'NEUTRO'
  | 'NARRATIVO'
  | 'CÁLIDO'
  | 'INFORMATIVO'
  | 'EXPRESIVO'

export interface StudioPreset {
  id: string
  name: string
  collection: PresetCollection
  category: PresetCategory
  engineId: string
  voiceId: string
  voiceName: string
  speed: number
  pitch: number
  emotion: PresetEmotion
  color: string
  script: string
  designFamily: PresetDesignFamily
  designInstruction: string
}

export const PENDING_PRESET_STORAGE_KEY = 'vozstudio-pending-preset'
export const LAST_PRESET_STORAGE_KEY = 'vozstudio-last-preset'
export const PRESET_COLLECTIONS: readonly PresetCollection[] = ['Fundamentos', 'Latino neural']

type PresetSeed = Omit<StudioPreset, 'collection' | 'designFamily' | 'designInstruction'>

const FUNDAMENTAL_PRESETS: readonly PresetSeed[] = [
  {
    id: 'documental-intimo', name: 'Documental íntimo', category: 'Narración', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 0.9, pitch: -0.5, emotion: 'NARRATIVO', color: '#00c2d7',
    script: 'En el silencio de la cordillera, cada paso revela una historia que la naturaleza ha guardado durante siglos.',
  },
  {
    id: 'trailer-cinematografico', name: 'Tráiler cinematográfico', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 1.05, pitch: 1, emotion: 'EXPRESIVO', color: '#8b7cff',
    script: 'Cuando todo parecía perdido, una decisión cambiará el destino de quienes se atreven a avanzar.',
  },
  {
    id: 'podcast-natural', name: 'Podcast natural', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1, pitch: 0, emotion: 'NEUTRO', color: '#37cfa2',
    script: 'Hoy queremos conversar sin prisa sobre las ideas que hacen más humano nuestro trabajo cada día.',
  },
  {
    id: 'comercial-premium', name: 'Comercial premium', category: 'Comercial', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1.05, pitch: 0.5, emotion: 'EXPRESIVO', color: '#ffb547',
    script: 'Descubre una experiencia diseñada para acompañarte con precisión, elegancia y atención a cada detalle.',
  },
  {
    id: 'audiolibro-calido', name: 'Audiolibro cálido', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.9, pitch: 0, emotion: 'CÁLIDO', color: '#f57878',
    script: 'Abrió la carta con cuidado y, al reconocer aquella caligrafía, comprendió que el viaje apenas comenzaba.',
  },
  {
    id: 'noticias-preciso', name: 'Noticias preciso', category: 'Corporativo', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.05, pitch: 0, emotion: 'INFORMATIVO', color: '#00c2d7',
    script: 'Estas son las noticias principales de la jornada, con los datos verificados y el contexto necesario.',
  },
  {
    id: 'corporativo-moderno', name: 'Corporativo moderno', category: 'Corporativo', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1, pitch: 0, emotion: 'INFORMATIVO', color: '#8b7cff',
    script: 'Transformamos procesos complejos en soluciones claras para que cada equipo pueda avanzar con confianza.',
  },
  {
    id: 'personaje-juvenil', name: 'Personaje juvenil', category: 'Personajes', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1.1, pitch: 2, emotion: 'EXPRESIVO', color: '#37cfa2',
    script: '¡Vamos, no podemos quedarnos aquí! La mejor parte de la aventura está justo al otro lado.',
  },
  {
    id: 'narrador-epico', name: 'Narrador épico', category: 'Narración', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 0.85, pitch: 0.5, emotion: 'EXPRESIVO', color: '#ffb547',
    script: 'Y entonces, bajo el cielo encendido, los últimos guardianes levantaron su estandarte una vez más.',
  },
  {
    id: 'meditacion-suave', name: 'Meditación suave', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.8, pitch: -1, emotion: 'CÁLIDO', color: '#f57878',
    script: 'Respira lentamente. Permite que el aire llegue sin esfuerzo y suelta, poco a poco, lo que ya no necesitas.',
  },
  {
    id: 'radio-energica', name: 'Radio enérgica', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.15, pitch: 1, emotion: 'EXPRESIVO', color: '#00c2d7',
    script: '¡Muy buenos días! Arrancamos con la energía que necesitas para poner en marcha tus mejores planes.',
  },
  {
    id: 'elearning-claro', name: 'E-learning claro', category: 'Corporativo', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.95, pitch: 0, emotion: 'NARRATIVO', color: '#8b7cff',
    script: 'En esta lección aprenderás a identificar los tres pasos que convierten una idea en una acción medible.',
  },
  {
    id: 'entrevista-cercana', name: 'Entrevista cercana', category: 'Corporativo', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.95, pitch: 0.5, emotion: 'CÁLIDO', color: '#37cfa2',
    script: 'Gracias por acompañarnos. Para empezar, ¿qué fue lo primero que te impulsó a iniciar este proyecto?',
  },
  {
    id: 'doblaje-neutro', name: 'Doblaje neutro', category: 'Personajes', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1, pitch: 0, emotion: 'NEUTRO', color: '#ffb547',
    script: 'Entiendo lo que dices, pero antes de decidir necesitamos revisar todas las posibilidades con calma.',
  },
  {
    id: 'cronica-nocturna', name: 'Crónica nocturna', category: 'Narración', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 0.9, pitch: -0.5, emotion: 'NARRATIVO', color: '#f57878',
    script: 'La ciudad continuaba despierta, aunque sus calles ya hablaban con el tono sereno de la madrugada.',
  },
  {
    id: 'tecnologia-futura', name: 'Tecnología futura', category: 'Corporativo', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.05, pitch: 1, emotion: 'INFORMATIVO', color: '#00c2d7',
    script: 'La nueva plataforma integra inteligencia local, automatización verificable y control completo de los datos.',
  },
  {
    id: 'historia-emocional', name: 'Historia emocional', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.9, pitch: 0.5, emotion: 'CÁLIDO', color: '#8b7cff',
    script: 'Al volver a casa encontró la luz encendida y, por primera vez en mucho tiempo, dejó de sentir miedo.',
  },
  {
    id: 'deportes-dinamico', name: 'Deportes dinámico', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.2, pitch: 1.5, emotion: 'EXPRESIVO', color: '#37cfa2',
    script: '¡Últimos minutos del encuentro! El equipo acelera, recupera el balón y busca una oportunidad decisiva.',
  },
  {
    id: 'lujo-sereno', name: 'Lujo sereno', category: 'Comercial', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.85, pitch: -0.5, emotion: 'CÁLIDO', color: '#ffb547',
    script: 'El verdadero lujo no necesita imponerse: se percibe en la calma, la materia y el tiempo bien elegido.',
  },
  {
    id: 'asistente-amable', name: 'Asistente amable', category: 'Personajes', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1, pitch: 0.5, emotion: 'CÁLIDO', color: '#f57878',
    script: 'Claro, estaré encantada de ayudarte. Cuéntame qué necesitas y lo resolvemos paso a paso.',
  },
]

const LATINO_NEURAL_PRESETS: readonly PresetSeed[] = [
  {
    id: 'poeta-latino', name: 'Poeta latino', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.85, pitch: 0.5, emotion: 'CÁLIDO', color: '#b38cff',
    script: 'La lluvia toca los balcones de la ciudad y en cada gota despierta una palabra que todavía no sabía decir.',
  },
  {
    id: 'mc-rapero-latino', name: 'MC rapero latino', category: 'Personajes', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.15, pitch: 1, emotion: 'EXPRESIVO', color: '#ff5b8f',
    script: 'Sube el ritmo, barrio presente, ideas en movimiento; cada rima abre camino y convierte el momento en talento.',
  },
  {
    id: 'locutor-futbol', name: 'Locutor de fútbol', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.2, pitch: 1.5, emotion: 'EXPRESIVO', color: '#55d68b',
    script: '¡Recupera la pelota en la mitad, acelera por la banda, levanta la mirada y remata! ¡Golazo para encender el estadio!',
  },
  {
    id: 'romantico-intimo', name: 'Romántico íntimo', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.9, pitch: 0.5, emotion: 'CÁLIDO', color: '#ff6d9d',
    script: 'Desde que llegaste, las tardes tienen otra luz y hasta el silencio aprendió a decir tu nombre con ternura.',
  },
  {
    id: 'terror-nocturno', name: 'Terror nocturno', category: 'Personajes', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 0.85, pitch: -1, emotion: 'EXPRESIVO', color: '#8b6cff',
    script: 'La casa permanecía inmóvil, pero desde el pasillo alguien repetía su nombre con una voz que no debía estar allí.',
  },
  {
    id: 'cumbia-tropical', name: 'Cumbia tropical', category: 'Comercial', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1.15, pitch: 1, emotion: 'EXPRESIVO', color: '#ffb547',
    script: 'Que suene la cumbia, que se mueva la plaza y que esta noche cada paso tenga el sabor alegre de nuestra tierra.',
  },
  {
    id: 'salsa-brava', name: 'Salsa brava', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.15, pitch: 1, emotion: 'EXPRESIVO', color: '#ff7a49',
    script: 'La clave marca el camino, el barrio responde y la pista se enciende con una energía que nadie quiere soltar.',
  },
  {
    id: 'relato-regional-mexicano', name: 'Relato regional mexicano', category: 'Narración', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 0.95, pitch: -0.5, emotion: 'NARRATIVO', color: '#d8b25a',
    script: 'Al caer la tarde sobre la sierra, la familia se reunió para contar las historias que cruzaron generaciones enteras.',
  },
  {
    id: 'relato-caribeno', name: 'Relato caribeño', category: 'Narración', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1, pitch: 0.5, emotion: 'CÁLIDO', color: '#38c9d4',
    script: 'El mar amaneció brillante y la brisa llevó hasta el malecón el aroma dulce de las frutas recién cortadas.',
  },
  {
    id: 'locutora-urbana', name: 'Locutora urbana', category: 'Comercial', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1.1, pitch: 0.5, emotion: 'EXPRESIVO', color: '#a771ff',
    script: 'La ciudad no se detiene, y tu idea tampoco. Conecta, crea y deja que tu voz encuentre a quienes están listos para escuchar.',
  },
  {
    id: 'viaje-latinoamericano', name: 'Viaje latinoamericano', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.05, pitch: 0.5, emotion: 'INFORMATIVO', color: '#27bf8a',
    script: 'Recorre paisajes, sabores y ciudades que guardan una historia distinta en cada esquina de Latinoamérica.',
  },
  {
    id: 'comedia-cotidiana', name: 'Comedia cotidiana', category: 'Personajes', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1.1, pitch: 1, emotion: 'EXPRESIVO', color: '#ffd15d',
    script: 'Yo venía por una sola cosa, pero salí con tres bolsas, una planta y la certeza de que no aprendí nada.',
  },
  {
    id: 'suspenso-policial', name: 'Suspenso policial', category: 'Narración', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 0.9, pitch: -0.5, emotion: 'NARRATIVO', color: '#5f89ff',
    script: 'La evidencia parecía sencilla, hasta que la detective encontró una fecha imposible escrita detrás de la fotografía.',
  },
  {
    id: 'mito-latinoamericano', name: 'Mito latinoamericano', category: 'Narración', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 0.9, pitch: -0.5, emotion: 'NARRATIVO', color: '#a86f4c',
    script: 'Dicen los abuelos que, cuando la luna se queda quieta, los guardianes del monte vuelven a caminar entre los árboles.',
  },
  {
    id: 'coach-motivacional', name: 'Coach motivacional', category: 'Comercial', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.1, pitch: 1, emotion: 'EXPRESIVO', color: '#2ed69b',
    script: 'No necesitas tener todo resuelto para empezar. Da el siguiente paso, aprende del camino y confía en tu proceso.',
  },
  {
    id: 'streamer-gaming', name: 'Streamer gaming', category: 'Personajes', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.15, pitch: 1.5, emotion: 'EXPRESIVO', color: '#6a8cff',
    script: '¡Atención al mapa! Tenemos una oportunidad, el equipo está listo y esta jugada puede cambiar toda la partida.',
  },
  {
    id: 'poeta-romantico', name: 'Poeta romántico', category: 'Narración', engineId: 'kokoro', voiceId: 'em_santa', voiceName: 'Santa Neural', speed: 0.85, pitch: -0.5, emotion: 'CÁLIDO', color: '#ef7db2',
    script: 'Te pensé en la distancia y descubrí que el corazón también tiene memoria para guardar los momentos que importan.',
  },
  {
    id: 'crianza-cercana', name: 'Crianza cercana', category: 'Corporativo', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 0.95, pitch: 0.5, emotion: 'CÁLIDO', color: '#f09b65',
    script: 'Acompañar también es escuchar. Cada pregunta de una niña o un niño es una oportunidad para crecer juntos.',
  },
  {
    id: 'reportera-calle', name: 'Reportera en la calle', category: 'Corporativo', engineId: 'kokoro', voiceId: 'ef_dora', voiceName: 'Dora Neural', speed: 1.1, pitch: 0, emotion: 'INFORMATIVO', color: '#47b7e8',
    script: 'Estamos en el centro de la ciudad, donde vecinas y vecinos comparten cómo esta iniciativa transforma su día a día.',
  },
  {
    id: 'animador-fiesta', name: 'Animador de fiesta', category: 'Personajes', engineId: 'kokoro', voiceId: 'em_alex', voiceName: 'Alex Neural', speed: 1.2, pitch: 1.5, emotion: 'EXPRESIVO', color: '#ff5e71',
    script: '¡Que se escuche hasta el último rincón! Levanten las manos, celebren con la gente y hagan de esta noche un recuerdo inolvidable.',
  },
]

export const PRESET_DESIGN_FAMILIES: Record<
  PresetDesignFamily,
  { label: string; instruction: string }
> = {
  documental: {
    label: 'Documental humano',
    instruction: 'Cadencia reflexiva, pausas breves entre ideas, intención observadora y cierre sereno.',
  },
  conversacional: {
    label: 'Conversación cercana',
    instruction: 'Ritmo natural de conversación, sonrisa leve, respiración discreta y énfasis cálido en las preguntas.',
  },
  comercial: {
    label: 'Comercial contemporáneo',
    instruction: 'Energía medida, articulación precisa, intención persuasiva sin gritar y remate memorable.',
  },
  formativo: {
    label: 'Formación clara',
    instruction: 'Velocidad didáctica, pronunciación limpia, pausas antes de los conceptos y tono que acompaña.',
  },
  personaje: {
    label: 'Personaje controlado',
    instruction: 'Interpretación reconocible y expresiva, sin caricatura extrema, conservando inteligibilidad en español latino.',
  },
  poetico: {
    label: 'Poesía íntima',
    instruction: 'Fraseo musical suave, silencios con intención, consonantes delicadas y una emoción contenida.',
  },
  deportivo: {
    label: 'Deportivo en vivo',
    instruction: 'Impulso ascendente, dicción rápida pero nítida, energía de estadio y énfasis en las acciones decisivas.',
  },
  romantico: {
    label: 'Romántico cercano',
    instruction: 'Timbre próximo, volumen moderado, pausas afectivas y una sonrisa audible sin susurrar artificialmente.',
  },
  suspenso: {
    label: 'Suspenso cinematográfico',
    instruction: 'Ritmo contenido, graves controlados, pausas tensas y finales de frase que dejen expectativa.',
  },
  urbano: {
    label: 'Urbano rítmico',
    instruction: 'Ataque ágil, acentos rítmicos limpios, confianza de calle y consonantes definidas sin perder claridad.',
  },
  tropical: {
    label: 'Tropical festivo',
    instruction: 'Sonrisa abierta, energía bailable, frases luminosas y pulsación alegre sin saturar la voz.',
  },
  periodistico: {
    label: 'Periodismo de campo',
    instruction: 'Entrega directa, datos claros, urgencia moderada y una presencia confiable de reportaje en español latino.',
  },
}

type PresetDesignSpec = {
  family: PresetDesignFamily
  persona: string
  model?: Pick<PresetSeed, 'engineId' | 'voiceId' | 'voiceName'>
}

const PRESET_DESIGN_SPECS: Record<string, PresetDesignSpec> = {
  'documental-intimo': { family: 'documental', persona: 'narrador masculino maduro, cercano y profundo', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'trailer-cinematografico': { family: 'suspenso', persona: 'narrador masculino de registro grave, épico y contenido', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'podcast-natural': { family: 'conversacional', persona: 'locutora adulta, amable y espontánea', model: { engineId: 'cosyvoice', voiceId: 'cosy_nova_es', voiceName: 'Nova CosyVoice' } },
  'comercial-premium': { family: 'comercial', persona: 'locutora elegante, segura y sobria', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'audiolibro-calido': { family: 'poetico', persona: 'narradora adulta con intimidad de lectura nocturna', model: { engineId: 'cosyvoice', voiceId: 'cosy_nova_es', voiceName: 'Nova CosyVoice' } },
  'noticias-preciso': { family: 'periodistico', persona: 'locutor masculino preciso, objetivo y estable', model: { engineId: 'kokoro', voiceId: 'es_blend_documental', voiceName: 'Mateo Documental' } },
  'corporativo-moderno': { family: 'formativo', persona: 'locutor masculino moderno, calmo y competente', model: { engineId: 'kokoro', voiceId: 'es_blend_editorial', voiceName: 'Sofía Editorial' } },
  'personaje-juvenil': { family: 'personaje', persona: 'voz joven, ágil y optimista', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'narrador-epico': { family: 'documental', persona: 'narrador masculino amplio, noble y de gran presencia', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'meditacion-suave': { family: 'conversacional', persona: 'guía femenina serena, respirada y sin teatralidad', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'radio-energica': { family: 'comercial', persona: 'animador masculino joven, dinámico y sonriente', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'elearning-claro': { family: 'formativo', persona: 'tutora paciente, clara y muy articulada' },
  'entrevista-cercana': { family: 'conversacional', persona: 'entrevistadora empática, curiosa y relajada', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'doblaje-neutro': { family: 'personaje', persona: 'protagonista masculino natural, neutro y versátil' },
  'cronica-nocturna': { family: 'suspenso', persona: 'cronista masculino sobrio, nocturno y reflexivo', model: { engineId: 'kokoro', voiceId: 'es_blend_documental', voiceName: 'Mateo Documental' } },
  'tecnologia-futura': { family: 'formativo', persona: 'presentador editorial de tecnología, claro y curioso' },
  'historia-emocional': { family: 'romantico', persona: 'narradora sensible, madura y luminosa', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'deportes-dinamico': { family: 'deportivo', persona: 'relator masculino de ritmo alto y entusiasmo controlado', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'lujo-sereno': { family: 'comercial', persona: 'locutora de lujo, pausada, segura y silenciosa', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'asistente-amable': { family: 'conversacional', persona: 'asistente femenina cordial, clara y resolutiva' },
  'poeta-latino': { family: 'poetico', persona: 'poeta femenina latinoamericana, íntima y contemplativa', model: { engineId: 'cosyvoice', voiceId: 'cosy_nova_es', voiceName: 'Nova CosyVoice' } },
  'mc-rapero-latino': { family: 'urbano', persona: 'MC masculino joven, rítmico, seguro y expresivo', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'locutor-futbol': { family: 'deportivo', persona: 'narrador deportivo masculino, intenso y muy inteligible', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'romantico-intimo': { family: 'romantico', persona: 'voz femenina adulta, afectiva y próxima', model: { engineId: 'cosyvoice', voiceId: 'cosy_nova_es', voiceName: 'Nova CosyVoice' } },
  'terror-nocturno': { family: 'suspenso', persona: 'narrador masculino veterano, oscuro y contenido', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'cumbia-tropical': { family: 'tropical', persona: 'animadora femenina tropical, alegre y luminosa', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'salsa-brava': { family: 'tropical', persona: 'animador masculino salsero, rápido y entusiasta', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'relato-regional-mexicano': { family: 'documental', persona: 'narrador mayor con cercanía regional y pausa familiar', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'relato-caribeno': { family: 'tropical', persona: 'narradora caribeña cálida, brillante y pausada', model: { engineId: 'cosyvoice', voiceId: 'cosy_nova_es', voiceName: 'Nova CosyVoice' } },
  'locutora-urbana': { family: 'urbano', persona: 'locutora urbana contemporánea, directa y carismática', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'viaje-latinoamericano': { family: 'documental', persona: 'presentador viajero, curioso y amable', model: { engineId: 'kokoro', voiceId: 'es_blend_documental', voiceName: 'Mateo Documental' } },
  'comedia-cotidiana': { family: 'personaje', persona: 'personaje femenina con humor cotidiano y sonrisa audible', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'suspenso-policial': { family: 'suspenso', persona: 'detective masculino sereno, analítico y tenso', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'mito-latinoamericano': { family: 'poetico', persona: 'abuelo narrador, grave, misterioso y cálido', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'coach-motivacional': { family: 'comercial', persona: 'coach masculino cálido, firme y sin agresividad', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'streamer-gaming': { family: 'personaje', persona: 'streamer masculino joven, reaccionando con energía clara', model: { engineId: 'cosyvoice', voiceId: 'cosy_onyx_es', voiceName: 'Onyx CosyVoice' } },
  'poeta-romantico': { family: 'romantico', persona: 'poeta masculino maduro, vulnerable y elegante', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'crianza-cercana': { family: 'conversacional', persona: 'orientadora femenina de crianza, paciente y protectora', model: { engineId: 'cosyvoice', voiceId: 'cosy_nova_es', voiceName: 'Nova CosyVoice' } },
  'reportera-calle': { family: 'periodistico', persona: 'reportera femenina de campo, directa y confiable', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
  'animador-fiesta': { family: 'tropical', persona: 'animador masculino festivo, potente y cercano', model: { engineId: 'qwen3_tts', voiceId: 'qwen3_voice_design', voiceName: 'Qwen3 VoiceDesign' } },
}

function materializePreset(preset: PresetSeed, collection: PresetCollection): StudioPreset {
  const spec = PRESET_DESIGN_SPECS[preset.id]
  const family = spec ? PRESET_DESIGN_FAMILIES[spec.family] : PRESET_DESIGN_FAMILIES.conversacional
  const model = spec?.model ?? {}
  const resolved = { ...preset, ...model }
  return {
    ...resolved,
    collection,
    designFamily: spec?.family ?? 'conversacional',
    designInstruction: [
      `Diseña ${preset.name} para español latino con ${spec?.persona ?? 'una voz natural y reconocible'}.`,
      `Interpretación: ${family.instruction}`,
      'Micrófono cercano y seco, sin música, sin reverberación, sin eco y sin efectos de sala.',
      `Ejecuta con ${resolved.voiceName} en ${resolved.engineId}, velocidad ${resolved.speed.toFixed(2)}x, tono ${resolved.pitch >= 0 ? '+' : ''}${resolved.pitch.toFixed(1)} semitonos y matiz ${resolved.emotion.toLowerCase()}.`,
      'Mantén dicción latinoamericana natural, respiraciones discretas y pausas sólo donde ayuden al sentido.',
    ].join(' '),
  }
}

export const STUDIO_PRESETS: readonly StudioPreset[] = [
  ...FUNDAMENTAL_PRESETS.map((preset) => materializePreset(preset, 'Fundamentos')),
  ...LATINO_NEURAL_PRESETS.map((preset) => materializePreset(preset, 'Latino neural')),
]
