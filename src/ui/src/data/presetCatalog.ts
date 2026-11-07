export type PresetCategory = 'Narración' | 'Comercial' | 'Personajes' | 'Corporativo'
export type PresetCollection = 'Fundamentos' | 'Latino neural'

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
  engineId: 'kokoro'
  voiceId: 'ef_dora' | 'em_alex' | 'em_santa' | 'es_blend_editorial' | 'es_blend_documental'
  voiceName: string
  speed: number
  pitch: number
  emotion: PresetEmotion
  color: string
  script: string
}

export const PENDING_PRESET_STORAGE_KEY = 'vozstudio-pending-preset'
export const LAST_PRESET_STORAGE_KEY = 'vozstudio-last-preset'
export const PRESET_COLLECTIONS: readonly PresetCollection[] = ['Fundamentos', 'Latino neural']

const FUNDAMENTAL_PRESETS: readonly Omit<StudioPreset, 'collection'>[] = [
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

const LATINO_NEURAL_PRESETS: readonly Omit<StudioPreset, 'collection'>[] = [
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

export const STUDIO_PRESETS: readonly StudioPreset[] = [
  ...FUNDAMENTAL_PRESETS.map((preset) => ({ ...preset, collection: 'Fundamentos' as const })),
  ...LATINO_NEURAL_PRESETS.map((preset) => ({ ...preset, collection: 'Latino neural' as const })),
]
