// VozStudio Atlas - modulo de clonacion de voz.
//
// Solo entran los motores que clonan de verdad y no son Qwen ni CosyVoice:
// F5-TTS Spanish, XTTS-v2 y StyleTTS 2. Kokoro, Piper y MMS quedan fuera
// porque no aceptan una referencia: son motores de voces fijas.
//
// Reglas del backend real que se respetan aqui:
//   - la referencia util va de 3 a 10 segundos (XTTS pide mas de 6 s ideal);
//   - hace falta la transcripcion exacta del fragmento;
//   - sin consentimiento firmado no se guarda la voz;
//   - la limpieza se hace antes de clonar, nunca despues.

/** Motores disponibles para clonar. `minRef` y `maxRef` en segundos. */
export const CLONE_ENGINES = [
  {
    id: 'f5_spanish',
    name: 'F5-TTS Spanish',
    license: 'MIT',
    commercial: true,
    rtf: 0.65,
    sr: 24000,
    minRef: 3,
    maxRef: 10,
    accentos: 'multiacento',
    nota: '218 h de espanol multiacento. Es el clonador de referencia del proyecto.',
    aceptaGrabacion: true,
    calidad: 'alta',
  },
  {
    id: 'xtts_v2',
    name: 'Coqui XTTS-v2',
    license: 'CPML (personal)',
    commercial: false,
    rtf: 0.8,
    sr: 24000,
    minRef: 6,
    maxRef: 12,
    accentos: '17 idiomas',
    nota: 'Clonacion de respaldo. Licencia restrictiva: solo uso personal.',
    aceptaGrabacion: true,
    calidad: 'alta',
  },
  {
    id: 'styletts2',
    name: 'StyleTTS 2 BSC-LT',
    license: 'Apache-2.0',
    commercial: true,
    rtf: 0.22,
    sr: 24000,
    minRef: 3,
    maxRef: 8,
    accentos: 'ES neutro',
    nota: 'Prosodia expresiva: buena para audiolibro, con menos fidelidad de timbre.',
    aceptaGrabacion: true,
    calidad: 'media',
  },
];

/** Como se consigue la referencia. */
export const CLONE_SOURCES = [
  { id: 'archivo', label: 'Subir audio', icon: 'upload', detalle: 'WAV, MP3, M4A, FLAC u OGG. Se convierte a 24 kHz mono en local.' },
  { id: 'grabacion', label: 'Grabar en vivo', icon: 'mic', detalle: 'Microfono del equipo. El contador corta solo al llegar al maximo del motor.' },
];

/** Presets de limpieza: se aplican antes de calcular el condicionamiento. */
export const CLONE_CLEAN_PRESETS = [
  {
    id: 'estudio',
    name: 'Estudio limpio',
    desc: 'Referencia ya grabada con microfono: solo normaliza y recorta silencios.',
    tone: 'var(--ok)',
    params: { denoise: 40, deverb: 15, normalize: true, trim: true, loudness: '-23 LUFS', highpass: 80 },
  },
  {
    id: 'casero',
    name: 'Habitacion con ruido',
    desc: 'Grabado con el portatil o el movil. Quita ruido de fondo y eco suave.',
    tone: 'var(--accent)',
    params: { denoise: 72, deverb: 45, normalize: true, trim: true, loudness: '-23 LUFS', highpass: 90 },
  },
  {
    id: 'telefono',
    name: 'Llamada o movil',
    desc: 'Banda estrecha y compresion agresiva. Recupera lo que se pueda y avisa.',
    tone: 'var(--warn)',
    params: { denoise: 85, deverb: 30, normalize: true, trim: true, loudness: '-20 LUFS', highpass: 120 },
  },
  {
    id: 'eco',
    name: 'Sala con reverberacion',
    desc: 'Cocina, bano o sala vacia. Reduce cola de reverb sin comerse las consonantes.',
    tone: 'var(--info)',
    params: { denoise: 55, deverb: 78, normalize: true, trim: true, loudness: '-23 LUFS', highpass: 85 },
  },
  {
    id: 'musica',
    name: 'Voz sobre musica',
    desc: 'Separa voz y fondo con el modelo de fuente. Avisa de los artefactos.',
    tone: 'var(--amber)',
    params: { denoise: 60, deverb: 20, normalize: true, trim: true, loudness: '-23 LUFS', highpass: 100 },
  },
  {
    id: 'crudo',
    name: 'Sin tocar',
    desc: 'Solo se comprueba el nivel de pico. Util para diagnosticar la referencia.',
    tone: 'var(--text-3)',
    params: { denoise: 0, deverb: 0, normalize: false, trim: false, loudness: 'sin cambio', highpass: 0 },
  },
];

/** Presets de clonacion: fijan motor, limpieza y ajustes del condicionamiento. */
export const CLONE_PRESETS = [
  {
    id: 'narrador-neutro',
    name: 'Narrador neutro',
    desc: 'El uso mas comun: una sola voz para todo el capitulo, ritmo estable.',
    engine: 'f5_spanish',
    cleaning: 'estudio',
    tone: 'var(--accent)',
    params: { speed: 1, exaggeration: 0.5, clarity: 0.5, sampleRate: 24000, seedLock: true },
  },
  {
    id: 'audiolibro-calido',
    name: 'Audiolibro calido',
    desc: 'Mas pausa y calidez en los finales de frase. Pensado para sesiones largas.',
    engine: 'f5_spanish',
    cleaning: 'estudio',
    tone: 'var(--ok)',
    params: { speed: 0.94, exaggeration: 0.58, clarity: 0.62, sampleRate: 24000, seedLock: true },
  },
  {
    id: 'documental',
    name: 'Documental grave',
    desc: 'Timbre firme y poca variacion emocional, para locucion de ciencia.',
    engine: 'xtts_v2',
    cleaning: 'casero',
    tone: 'var(--info)',
    params: { speed: 0.9, exaggeration: 0.35, clarity: 0.7, sampleRate: 24000, seedLock: true },
  },
  {
    id: 'expressivo-dialogo',
    name: 'Expresivo de dialogo',
    desc: 'Sube la expresividad de StyleTTS 2 para personajes y cuentos.',
    engine: 'styletts2',
    cleaning: 'casero',
    tone: 'var(--amber)',
    params: { speed: 1.04, exaggeration: 0.78, clarity: 0.4, sampleRate: 24000, seedLock: false },
  },
  {
    id: 'micro-movil',
    name: 'Referencia de movil',
    desc: 'Para cuando lo unico que hay es una nota de voz: limpieza agresiva.',
    engine: 'f5_spanish',
    cleaning: 'telefono',
    tone: 'var(--warn)',
    params: { speed: 1, exaggeration: 0.45, clarity: 0.55, sampleRate: 22050, seedLock: true },
  },
  {
    id: 'susurro',
    name: 'Susurro intimo',
    desc: 'Clonacion suave con aire y poco cuerpo. Aviso: el backend puede recortar graves.',
    engine: 'xtts_v2',
    cleaning: 'eco',
    tone: 'var(--danger)',
    params: { speed: 0.88, exaggeration: 0.3, clarity: 0.76, sampleRate: 24000, seedLock: true },
  },
  {
    id: 'institucional',
    name: 'Institucional',
    desc: 'Ritmo regular, sin adornos: mensajes de atencion y avisos.',
    engine: 'f5_spanish',
    cleaning: 'estudio',
    tone: 'var(--info)',
    params: { speed: 0.97, exaggeration: 0.4, clarity: 0.66, sampleRate: 24000, seedLock: true },
  },
  {
    id: 'personaje',
    name: 'Personaje de ficcion',
    desc: 'Acepta algo de artefacto a cambio de caracter. Revisa el QA antes de aprobar.',
    engine: 'styletts2',
    cleaning: 'musica',
    tone: 'var(--amber)',
    params: { speed: 1.08, exaggeration: 0.85, clarity: 0.32, sampleRate: 24000, seedLock: false },
  },
];

/** Pasos del asistente, en orden. */
export const CLONE_STEPS = [
  { id: 'fuente', label: 'Fuente', hint: 'Sube o graba la referencia' },
  { id: 'limpieza', label: 'Limpieza', hint: 'Ruido, eco y nivel' },
  { id: 'motor', label: 'Motor', hint: 'Quien clona' },
  { id: 'prueba', label: 'Prueba', hint: 'Escucha y guarda' },
];

export const cloneEngineById = (id) => CLONE_ENGINES.find((item) => item.id === id) || CLONE_ENGINES[0];
export const clonePresetById = (id) => CLONE_PRESETS.find((item) => item.id === id) || CLONE_PRESETS[0];
export const cleanPresetById = (id) => CLONE_CLEAN_PRESETS.find((item) => item.id === id) || CLONE_CLEAN_PRESETS[0];

/** Referencia de ejemplo, coherente con el catalogo del prototipo. */
export const SAMPLE_REFERENCE = {
  name: 'muestra-elena.wav',
  seconds: 8.4,
  format: 'WAV',
  sr: 44100,
  channels: 2,
  sizeMb: 1.5,
  transcript: 'La lluvia insistia sobre el tejado mientras la ciudad se apagaba despacio.',
};

/**
 * Evalua la referencia contra lo que exige cada motor.
 * Devuelve avisos, no bloquea: el prototipo explica por que no se puede seguir.
 */
export function evaluateReference(ref, engineId) {
  const engine = cloneEngineById(engineId);
  if (!ref) return { ok: false, nivel: 'vacio', avisos: [{ tono: 'warn', texto: 'Todavia no hay referencia.' }] };
  const avisos = [];
  if (ref.seconds < engine.minRef) {
    avisos.push({ tono: 'danger', texto: `Muy corta: ${engine.name} pide al menos ${engine.minRef} s y hay ${ref.seconds.toFixed(1)} s.` });
  }
  if (ref.seconds > engine.maxRef) {
    avisos.push({ tono: 'warn', texto: `Se recortara a ${engine.maxRef} s: el motor no usa mas.` });
  }
  if (!ref.transcript || ref.transcript.trim().length < 10) {
    avisos.push({ tono: 'danger', texto: 'Falta la transcripcion exacta: sin ella el condicionamiento no vale.' });
  }
  if (ref.channels > 1) {
    avisos.push({ tono: 'info', texto: `Se convierte a mono (${ref.channels} canales de origen).` });
  }
  if (ref.sr < 16000) {
    avisos.push({ tono: 'warn', texto: `Muestra baja (${ref.sr} Hz): el timbre saldra apagado.` });
  }
  if (!engine.commercial) {
    avisos.push({ tono: 'info', texto: `${engine.name} no es comercial: permitido en uso personal.` });
  }
  const nivel = avisos.some((a) => a.tono === 'danger') ? 'error' : avisos.some((a) => a.tono === 'warn') ? 'aviso' : 'ok';
  return { ok: nivel !== 'error', nivel, avisos };
}

/** Estimacion de la toma de prueba: duracion y coste en RTF. */
export function estimateClone(engineId, seconds) {
  const engine = cloneEngineById(engineId);
  return { rtf: engine.rtf, segundos: Math.max(0.4, (seconds * engine.rtf)).toFixed(2) };
}
