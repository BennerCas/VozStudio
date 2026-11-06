export type PresetCategory = 'Narración' | 'Comercial' | 'Personajes' | 'Corporativo'

export type PresetEmotion =
  | 'NEUTRO'
  | 'NARRATIVO'
  | 'CÁLIDO'
  | 'INFORMATIVO'
  | 'EXPRESIVO'

export interface StudioPreset {
  id: string
  name: string
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

export const STUDIO_PRESETS: readonly StudioPreset[] = [
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
