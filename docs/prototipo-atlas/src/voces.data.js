// VozStudio Atlas - catalogo de voces del prototipo.
// Fuente: los adaptadores reales de src/ai/ (get_voices de cada motor).
// 31 voces nativas, mezclas, clonadas y disenadas en 8 arquitecturas.
// Regla del prototipo: no se excluye ninguna voz, porque la app es de uso personal.

import { engineById } from './data.js';

export const CATALOG = [
  /* --------------------------------- Kokoro -------------------------------- */
  { id: 'kokoro-em_alex', vid: 'em_alex', name: 'Alex Neural', engine: 'kokoro', origin: 'nativa', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['narracion', 'documental'], uses: 61, desc: 'Voz masculina equilibrada, clara y articulada.', cloning: false, emotion: true },
  { id: 'kokoro-ef_dora', vid: 'ef_dora', name: 'Dora Neural', engine: 'kokoro', origin: 'nativa', region: 'LATAM', gender: 'FEM', sr: 24000, quality: 'Studio', tags: ['calida', 'conversacional'], uses: 43, desc: 'Voz femenina calida y conversacional de estudio.', cloning: false, emotion: true },
  { id: 'kokoro-em_santa', vid: 'em_santa', name: 'Santa Neural', engine: 'kokoro', origin: 'nativa', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['grave', 'teatro'], uses: 12, desc: 'Voz masculina profunda, grave y expresiva.', cloning: false, emotion: true },
  { id: 'kokoro-es_blend_editorial', vid: 'es_blend_editorial', name: 'Sofia Editorial', engine: 'kokoro', origin: 'mezcla', region: 'LATAM', gender: 'FEM', sr: 24000, quality: 'Studio', tags: ['mezcla vectorial', '70% Dora', '30% Alex'], uses: 8, desc: 'Mezcla vectorial editorial (70% Dora + 30% Alex) para lectura fluida.', cloning: false, emotion: true },
  { id: 'kokoro-es_blend_documental', vid: 'es_blend_documental', name: 'Mateo Documental', engine: 'kokoro', origin: 'mezcla', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['mezcla vectorial', '65% Alex', '35% Santa'], uses: 5, desc: 'Mezcla vectorial documental (65% Alex + 35% Santa) con cuerpo narrativo.', cloning: false, emotion: true },

  /* ---------------------------------- Piper -------------------------------- */
  { id: 'piper-es_MX-claude-high', vid: 'es_MX-claude-high', name: 'Claude MX', engine: 'piper', origin: 'nativa', region: 'MX', gender: 'MASC', sr: 22050, quality: 'Alta', tags: ['mexicana', 'borrador'], uses: 96, desc: 'Voz masculina mexicana de alta definicion y prosodia natural.', cloning: false, emotion: false },
  { id: 'piper-es_MX-ald-medium', vid: 'es_MX-ald-medium', name: 'Aldo MX', engine: 'piper', origin: 'nativa', region: 'MX', gender: 'MASC', sr: 22050, quality: 'Media', tags: ['mexicana', 'informativa'], uses: 14, desc: 'Voz masculina mexicana agil para lectura informativa.', cloning: false, emotion: false },
  { id: 'piper-es_AR-daniela-high', vid: 'es_AR-daniela-high', name: 'Daniela AR', engine: 'piper', origin: 'nativa', region: 'AR', gender: 'FEM', sr: 22050, quality: 'Alta', tags: ['rioplatense', 'fidelidad'], uses: 21, desc: 'Voz femenina rioplatense argentina de alta fidelidad.', cloning: false, emotion: false },
  { id: 'piper-es_ES-davefx-medium', vid: 'es_ES-davefx-medium', name: 'David ES', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 22050, quality: 'Media', tags: ['castellana', 'locucion'], uses: 33, desc: 'Voz masculina castellana clara para locucion general.', cloning: false, emotion: false },
  { id: 'piper-es_ES-sharvard-m', vid: 'es_ES-sharvard-m', name: 'Alvaro Sharvard', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 22050, quality: 'Media', tags: ['castellana', 'corpus Sharvard'], uses: 7, desc: 'Locutor masculino castellano del corpus fonetico Sharvard (speaker 0).', cloning: false, emotion: false },
  { id: 'piper-es_ES-sharvard-f', vid: 'es_ES-sharvard-f', name: 'Elena Sharvard', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'FEM', sr: 22050, quality: 'Media', tags: ['castellana', 'corpus Sharvard'], uses: 9, desc: 'Locutora femenina castellana del corpus fonetico Sharvard (speaker 1).', cloning: false, emotion: false },
  { id: 'piper-es_ES-carlfm-x_low', vid: 'es_ES-carlfm-x_low', name: 'Carlos Ligero', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 16000, quality: 'Minima', tags: ['ultraligera', 'latencia minima'], uses: 4, desc: 'Voz castellana ultraligera de latencia minima (16 kHz).', cloning: false, emotion: false },
  { id: 'piper-es_ES-miro-high', vid: 'es_ES-miro-high', name: 'Miro ES', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 22050, quality: 'Alta', tags: ['castellana', 'alta definicion'], uses: 17, desc: 'Voz castellana de alta definicion de la comunidad OpenVoiceOS.', cloning: false, emotion: false },
  { id: 'piper-es_ES-mls_10246-low', vid: 'es_ES-mls_10246-low', name: 'Marcos MLS', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 16000, quality: 'Baja', tags: ['castellana', 'LibriSpeech'], uses: 2, desc: 'Voz masculina castellana del corpus Multilingual LibriSpeech.', cloning: false, emotion: false },
  { id: 'piper-es_ES-mls_9972-low', vid: 'es_ES-mls_9972-low', name: 'Carmen MLS', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'FEM', sr: 16000, quality: 'Baja', tags: ['castellana', 'LibriSpeech'], uses: 3, desc: 'Voz femenina castellana del corpus Multilingual LibriSpeech.', cloning: false, emotion: false },

  /* ----------------------------------- MMS --------------------------------- */
  { id: 'mms-mms_es_spa', vid: 'mms_es_spa', name: 'Meta MMS Espanol', engine: 'mms', origin: 'nativa', region: 'LATAM', gender: 'MASC', sr: 16000, quality: 'Ligera', tags: ['respaldo', '16 kHz'], uses: 4, desc: 'Voz neural ligera VITS de Meta AI para espanol neutro a 16 kHz.', cloning: false, emotion: false },

  /* -------------------------------- StyleTTS 2 ----------------------------- */
  { id: 'styletts2-styletts2_es_narradora', vid: 'styletts2_es_narradora', name: 'Clara Narrativa BSC', engine: 'styletts2', origin: 'nativa', region: 'ES', gender: 'FEM', sr: 24000, quality: 'Studio', tags: ['audiolibro', 'expresiva'], uses: 6, desc: 'Voz narrativa expresiva femenina para audiolibros y ensayo.', cloning: false, emotion: true },
  { id: 'styletts2-styletts2_es_cronista', vid: 'styletts2_es_cronista', name: 'Javier Cronista BSC', engine: 'styletts2', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['documental', 'prosodia'], uses: 4, desc: 'Voz narrativa masculina con modulacion prosodica documental.', cloning: false, emotion: true },
  { id: 'styletts2-styletts2_es_estudio', vid: 'styletts2_es_estudio', name: 'Irene Estudio BSC', engine: 'styletts2', origin: 'nativa', region: 'ES', gender: 'FEM', sr: 24000, quality: 'Alta', tags: ['editorial', 'largo formato'], uses: 2, desc: 'Timbre equilibrado para locucion editorial de largo formato.', cloning: false, emotion: true },

  /* ---------------------------------- Qwen3 -------------------------------- */
  { id: 'qwen3-qwen3_es_clara', vid: 'qwen3_es_clara', name: 'Clara Qwen3 Narrativa', engine: 'qwen3_tts', origin: 'nativa', region: 'ES', gender: 'FEM', sr: 24000, quality: 'Studio', tags: ['narrativa', 'castellana'], uses: 3, desc: 'Voz narrativa fluida femenina a 24 kHz con articulacion castellana precisa.', cloning: false, emotion: true },
  { id: 'qwen3-qwen3_es_mateo', vid: 'qwen3_es_mateo', name: 'Mateo Qwen3 Documental', engine: 'qwen3_tts', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['documental', 'pausada'], uses: 2, desc: 'Voz documental masculina con modulacion pausada y cadencia editorial.', cloning: false, emotion: true },
  { id: 'qwen3-qwen3_es_custom_clone', vid: 'qwen3_es_custom_clone', name: 'Qwen3 Clonacion Zero-Shot', engine: 'qwen3_tts', origin: 'clonada', region: 'MULTI', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['zero-shot', 'referencia 3-5 s'], uses: 0, desc: 'Clonacion zero-shot a 12 Hz condicionada con audio de referencia de 3-5 s.', cloning: true, emotion: true },
  { id: 'qwen3-qwen3_voice_design', vid: 'qwen3_voice_design', name: 'Qwen3 1.7B VoiceDesign', engine: 'qwen3_tts', origin: 'disenada', region: 'MULTI', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['prompt', 'sin semilla'], uses: 1, desc: 'Diseno acustico parametrico guiado por prompt en lenguaje natural sin audio semilla.', cloning: true, emotion: true },

  /* -------------------------------- CosyVoice ------------------------------ */
  { id: 'cosy-cosy_nova_es', vid: 'cosy_nova_es', name: 'Nova Cross-Lingual', engine: 'cosyvoice', origin: 'nativa', region: 'MULTI', gender: 'FEM', sr: 24000, quality: 'Studio', tags: ['calida', 'cross-lingual'], uses: 5, desc: 'Perfil femenino calido cross-lingual al espanol con soporte de emociones y reemplazo de audio de referencia.', cloning: true, emotion: true },
  { id: 'cosy-cosy_onyx_es', vid: 'cosy_onyx_es', name: 'Onyx Cross-Lingual', engine: 'cosyvoice', origin: 'nativa', region: 'MULTI', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['profunda', 'cross-lingual'], uses: 4, desc: 'Perfil masculino profundo cross-lingual al espanol con soporte de emociones y reemplazo de audio de referencia.', cloning: true, emotion: true },
  { id: 'cosy-cosy_custom_clone', vid: 'cosy_custom_clone', name: 'Clonacion Zero-Shot Usuario', engine: 'cosyvoice', origin: 'clonada', region: 'MULTI', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['referencia 3-10 s', 'transcripcion'], uses: 2, desc: 'Clonacion zero-shot personalizada a partir de 3-10 s de audio WAV y su transcripcion de referencia.', cloning: true, emotion: true },
  { id: 'cosy-cosy_instruct_tts', vid: 'cosy_instruct_tts', name: 'CosyVoice Instruct-TTS', engine: 'cosyvoice', origin: 'disenada', region: 'MULTI', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['instruct', 'estilo'], uses: 3, desc: 'Control expresivo mediante instrucciones de estilo y emocion con soporte de etiquetas paralinguisticas.', cloning: true, emotion: true },

  /* ----------------------------------- F5 ---------------------------------- */
  { id: 'f5-f5_es_neutro_clone', vid: 'f5_es_neutro_clone', name: 'F5 Clonacion Hispana Neutra', engine: 'f5_spanish', origin: 'clonada', region: 'LATAM', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['zero-shot', 'multiacento'], uses: 3, desc: 'Perfil zero-shot multiacento hispano (requiere audio de referencia).', cloning: true, emotion: true },
  { id: 'f5-f5_es_rioplatense_clone', vid: 'f5_es_rioplatense_clone', name: 'F5 Clonacion Cono Sur', engine: 'f5_spanish', origin: 'clonada', region: 'AR', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['zero-shot', 'rioplatense'], uses: 2, desc: 'Adaptacion zero-shot para cadencias rioplatenses y australes.', cloning: true, emotion: true },
  { id: 'f5-f5_es_castellano_clone', vid: 'f5_es_castellano_clone', name: 'F5 Clonacion Iberica', engine: 'f5_spanish', origin: 'clonada', region: 'ES', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['zero-shot', 'peninsular'], uses: 1, desc: 'Adaptacion zero-shot para timbre peninsular castellano.', cloning: true, emotion: true },

  /* --------------------------------- XTTS v2 ------------------------------- */
  { id: 'xtts-xtts_es_clone', vid: 'xtts_es_clone', name: 'XTTS Clonacion Zero-Shot', engine: 'xtts_v2', origin: 'clonada', region: 'MULTI', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['referencia 6 s', 'alta fidelidad'], uses: 0, desc: 'Clonacion de alta fidelidad a partir de un fragmento de audio de 6 segundos.', cloning: true, emotion: true },

  /* ------------------------- Voces del usuario (local) --------------------- */
  {
    id: 'local-elena', vid: 'custom_f5_elena', name: 'Elena (voz del autor)', engine: 'f5_spanish', origin: 'clonada', region: 'AR', gender: 'FEM', sr: 24000, quality: 'Clon', tags: ['referencia 9.2 s', 'F5'],
    uses: 3, desc: 'Voz clonada del autor con referencia de 9,2 s y condicionamiento bloqueado.',
    cloning: true, emotion: true,
    consent: { holder: 'Elena R.', kind: 'consentimiento firmado', date: '2026-10-14', scope: 'personal' },
  },
  {
    id: 'local-abuelo', vid: 'dna_qwen_abuelo', name: 'Abuelo del sur', engine: 'qwen3_tts', origin: 'disenada', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'DNA', tags: ['gravedad serena', 'pausado'],
    uses: 1, desc: 'Voz disenada por prompt: hombre mayor, grave, cadencia lenta y calidez sureña.',
    cloning: false, emotion: true,
    consent: { holder: 'Voz sintetica', kind: 'diseno propio', date: '2026-10-29', scope: 'personal' },
  },
  {
    id: 'local-nova', vid: 'cosy_instruct_nova', name: 'Nova susurro', engine: 'cosyvoice', origin: 'disenada', region: 'ES', gender: 'FEM', sr: 24000, quality: 'DNA', tags: ['susurro', 'intimo'],
    uses: 0, desc: 'Instruccion guardada: susurro intimo, intensidad baja y sibilantes alargadas.',
    cloning: false, emotion: true,
    consent: { holder: 'Voz sintetica', kind: 'diseno propio', date: '2026-09-02', scope: 'personal' },
  },
];

// Acceso por id al catalogo. Se llama catalogVoice (y no voiceById) porque
// data.js ya expone voiceById para el elenco antiguo: un paquete plano
// (prototipo-atlas.html) no admite dos funciones con el mismo nombre.
export const catalogVoice = (id) => CATALOG.find((voice) => voice.id === id) || null;

/** Recuento por motor, siempre sobre el catalogo completo. */
export function catalogCounts() {
  const counts = {};
  CATALOG.forEach((voice) => {
    counts[voice.engine] = (counts[voice.engine] || 0) + 1;
  });
  return counts;
}

export const CATALOG_TOTAL = CATALOG.length;

/** Motores con su recuento real, para la pantalla de voces. */
export function catalogByEngine() {
  const counts = catalogCounts();
  return Object.keys(counts).map((engineId) => ({
    engine: engineById(engineId),
    voices: CATALOG.filter((voice) => voice.engine === engineId),
    count: counts[engineId],
  }));
}
