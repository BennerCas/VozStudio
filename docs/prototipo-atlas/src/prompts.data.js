// VozStudio Atlas - biblioteca de prompts para diseno de voz.
// Dos modos, igual que el backend real:
//   voice_design  -> Qwen3 VoiceDesign (descripcion timbrica, src/core/prompt_enhancer.py)
//   instruct_tts  -> CosyVoice Instruct-TTS (una instruccion que empieza por "Habla con")
// Las entradas se generan por combinacion y se deduplican; los identificadores son ASCII.

const ACCENTS = [
  ['castellano_neutro', 'castellano neutro de Espana'],
  ['mexicano', 'mexicano del centro'],
  ['rioplatense', 'rioplatense argentino'],
  ['colombiano', 'colombiano andino'],
  ['chileno', 'chileno santiaguino'],
  ['peruano', 'peruano limeño'],
  ['caribeno', 'caribeno cubano'],
  ['venezolano', 'venezolano central'],
  ['andaluz', 'andaluz suave'],
  ['neutro_latam', 'latinoamericano neutro'],
];

const AGES = [
  ['18-24', 'joven de 18 a 24 anos'],
  ['25-32', 'joven de 25 a 32 anos'],
  ['33-40', 'adulto de 33 a 40 anos'],
  ['41-50', 'maduro de 41 a 50 anos'],
  ['51-62', 'maduro de 51 a 62 anos'],
  ['63-75', 'senior de 63 a 75 anos'],
  ['76+', 'anciano de mas de 76 anos'],
];

const TIMBRES_F = [
  'calido y aterciopelado',
  'claro y cristalino',
  'grave y envolvente',
  'brillante y luminoso',
  'suave y sedoso',
  'metalico y preciso',
  'terroso y cercano',
  'aereo y ligero',
  'denso y resonante',
  'dulce y amable',
];

const TIMBRES_M = [
  'profundo y resonante',
  'calido y firme',
  'claro y articulado',
  'grave y pausado',
  'brillante y energetico',
  'aterciopelado y sobrio',
  'nasal y caracteristico',
  'seco y directo',
  'templado y estable',
  'ronco y gastado',
];

const CADENCES = [
  'cadencia pausada y reflexiva',
  'cadencia agil y ritmica',
  'cadencia ondulante y expresiva',
  'cadencia firme y ceremoniosa',
  'cadencia conversacional y cercana',
  'cadencia ritmica de locucion',
  'cadencia lenta y contemplativa',
  'cadencia nerviosa y urgente',
  'cadencia equilibrada y neutra',
  'cadencia dramatica y teatral',
];

const TEXTURES = [
  'respiracion tenue y audible',
  'sonrisa perceptible en la voz',
  'articulacion impecable de estudio',
  'ligero aire en las consonantes',
  'proyeccion de sala pequeña',
  'cercania de microfono de condensador',
  'distancia de escenario sin reverberacion',
  'grabacion seca sin procesado',
];

/** Familias de diseno timbrico: cada una aporta su propio encuadre profesional. */
const FAMILIES = [
  {
    id: 'narracion',
    label: 'Narracion de audiolibro',
    mode: 'voice_design',
    gender: 'F',
    build: ({ age, timbre, accent, texture }) =>
      `Voz femenina ${age}, timbre ${timbre}, cadencia pausada y reflexiva, acento ${accent}, ${texture}, pensada para narrar un audiolibro de ficcion literaria de largo formato.`,
  },
  {
    id: 'narracion_m',
    label: 'Narracion documental',
    mode: 'voice_design',
    gender: 'M',
    build: ({ age, timbre, accent }) =>
      `Voz masculina ${age}, timbre ${timbre}, cadencia pausada y reflexiva, acento ${accent}, autoridad serena y articulacion impecable, para documental de naturaleza y divulgacion cientifica.`,
  },
  {
    id: 'locucion',
    label: 'Locucion comercial',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, timbre, accent }) =>
      `Voz ${genderWord} ${age}, timbre ${timbre}, cadencia agil y ritmica, acento ${accent}, proyeccion comercial energetica y diccion clara, apta para spot de radio de treinta segundos.`,
  },
  {
    id: 'noticias',
    label: 'Boletin de noticias',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, accent }) =>
      `Voz ${genderWord} ${age}, timbre claro y articulado, cadencia ritmica de locucion, acento ${accent}, tono informativo sobrio y neutralidad periodistica, para boletin horario de noticias.`,
  },
  {
    id: 'podcast',
    label: 'Podcast conversacional',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, timbre, accent, texture }) =>
      `Voz ${genderWord} ${age}, timbre ${timbre}, cadencia conversacional y cercana, acento ${accent}, ${texture}, como un anfitrion de podcast que habla a un amigo con complicidad.`,
  },
  {
    id: 'personaje',
    label: 'Personaje de ficcion',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, timbre, accent }) =>
      `Voz ${genderWord} ${age}, timbre ${timbre}, cadencia dramatica y teatral, acento ${accent}, con matices de villano elegante y amenaza contenida, para ficcion sonora.`,
  },
  {
    id: 'infantil',
    label: 'Cuentos infantiles',
    mode: 'voice_design',
    gender: 'F',
    build: ({ age, timbre, accent }) =>
      `Voz femenina ${age}, timbre ${timbre}, cadencia ondulante y expresiva, acento ${accent}, calidez de cuentacuentos que modula personajes sin perder claridad para ninos de seis anos.`,
  },
  {
    id: 'elearning',
    label: 'E-learning y corporativo',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, accent }) =>
      `Voz ${genderWord} ${age}, timbre calido y firme, cadencia equilibrada y neutra, acento ${accent}, claridad didactica y paciencia de instructor, para curso de formacion corporativa.`,
  },
  {
    id: 'meditacion',
    label: 'Meditacion y descanso',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, accent }) =>
      `Voz ${genderWord} adulta, timbre suave y sedoso, cadencia lenta y contemplativa, acento ${accent}, respiracion tenue y volumen bajo, para guiar una meditacion de veinte minutos.`,
  },
  {
    id: 'videojuego',
    label: 'Videojuego y NPC',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, timbre, accent }) =>
      `Voz ${genderWord} ${age}, timbre ${timbre}, cadencia firme y ceremoniosa, acento ${accent}, presencia de personaje no jugable que entrega misiones y advertencias breves.`,
  },
  {
    id: 'doblaje',
    label: 'Doblaje y animacion',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, accent, texture }) =>
      `Voz ${genderWord} ${age}, timbre brillante y energetico, cadencia expresiva, acento ${accent}, ${texture}, sincronizable con animacion y labios de personaje caricaturesco.`,
  },
  {
    id: 'telefonia',
    label: 'Telefonia e IVR',
    mode: 'voice_design',
    gender: 'F',
    build: ({ accent }) =>
      `Voz femenina adulta, timbre claro y cristalino, cadencia equilibrada y neutra, acento ${accent}, diccion perfecta y baja fatiga auditiva, para menus telefonicos y avisos de espera.`,
  },
  {
    id: 'deportes',
    label: 'Radio y deportes',
    mode: 'voice_design',
    gender: 'M',
    build: ({ age, accent }) =>
      `Voz masculina ${age}, timbre brillante y energetico, cadencia nerviosa y urgente, acento ${accent}, pulmon de narrador deportivo y emocion contenida al relatar una jugada.`,
  },
  {
    id: 'poesia',
    label: 'Poesia y teatro',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, age, timbre, accent }) =>
      `Voz ${genderWord} ${age}, timbre ${timbre}, cadencia dramatica y teatral, acento ${accent}, fraseo de recital poetico con silencios largos y respiracion expresiva.`,
  },
  {
    id: 'audiodescripcion',
    label: 'Audiodescripcion',
    mode: 'voice_design',
    gender: 'MIX',
    build: ({ genderWord, accent }) =>
      `Voz ${genderWord} adulta, timbre templado y estable, cadencia neutra y sin enfasis, acento ${accent}, pensada para audiodescripcion de cine que no compita con el dialogo original.`,
  },
];

const STYLES = [
  ['susurro', 'susurrando con misterio e intimidad, bajando la intensidad y alargando las sibilancias'],
  ['alegre', 'tono sonriente y alegre, proyectando optimismo y energia calida en cada frase'],
  ['serio', 'tono firme, pausado y profesional, manteniendo una diccion neutral y ceremoniosa'],
  ['melancolico', 'modulacion melancolica y reflexiva, con pausas expresivas y respiracion tenue'],
  ['ironico', 'tono ironico y jugueton, con enfasis en la ultima silaba y sonrisa contenida'],
  ['urgente', 'ritmo urgente y entrecortado, como quien avisa de algo que ocurre en este instante'],
  ['tierno', 'tono tierno y protector, con volumen bajo y finales de frase descendentes'],
  ['epico', 'registro epico y solemne, con proyeccion amplia y pausas de tambor'],
  ['cientifico', 'tono cientifico y preciso, con articulacion neutra y ausencia de adjetivos emotivos'],
  ['complice', 'tono complice de confidencia, cercano al microfono y con guinos de complicidad'],
  ['solemne', 'registro solemne de ceremonia, marcando cada coma con una micro pausa'],
  ['divertido', 'tono divertido y exagerado, con cambios de registro y risas contenidas'],
  ['triste', 'tono triste y quebrado, con finales de frase que caen y respiracion pesada'],
  ['misterioso', 'tono misterioso y lento, con volumen bajo y consonantes alargadas'],
  ['entusiasta', 'tono entusiasta y ascendente, con energia de presentacion de producto'],
  ['pausado', 'lectura pausada y didactica, con pausas claras despues de cada idea'],
  ['nervioso', 'tono nervioso y acelerado, con micro vacilaciones y respiraciones cortas'],
  ['seductor', 'tono seductor y grave, con cadencia lenta y proximidad de microfono'],
  ['autoritario', 'tono autoritario y seco, con ordenes breves y finales firmes'],
  ['calmado', 'tono calmado y envolvente, con respiracion larga y ritmo de meditacion'],
  ['emocionado', 'tono emocionado con la voz a punto de quebrarse y enfasis en los nombres propios'],
  ['sarcastico', 'tono sarcastico y filoso, estirando las vocales y remarcando el contraste'],
  ['infantil', 'tono infantil y jugueton, con saltos de registro y onomatopeyas'],
  ['solemne_radio', 'tono de radio antigua, con compresion media y presencia de banda AM'],
];

const STYLE_CONTEXTS = [
  'una escena de suspense',
  'un anuncio de perfumeria',
  'un cuento antes de dormir',
  'un tutorial de cocina',
  'una crónica de viaje',
  'un mensaje de voz personal',
  'una bienvenida corporativa',
  'un combate de videojuego',
  'una explicacion medica',
  'un poema breve',
  'una llamada de emergencia',
  'una despedida emotiva',
  'una cita de negocios',
  'una clase de historia',
  'un cierre de podcast',
  'una narracion de museo',
  'un mensaje de buzon de voz',
  'una retransmision deportiva',
  'un resumen de noticias',
  'una carta leida en voz alta',
];

function pick(list, index) {
  return list[index % list.length];
}

const genderWord = (gender) => (gender === 'F' ? 'femenina' : gender === 'M' ? 'masculina' : 'androgina');

function buildVoiceDesign() {
  const out = [];
  FAMILIES.forEach((family, familyIndex) => {
    const timbrePool = family.gender === 'F' ? TIMBRES_F : family.gender === 'M' ? TIMBRES_M : TIMBRES_M.concat(TIMBRES_F);
    // Barrido combinatorio controlado: cada voz de la familia usa una combinacion distinta.
    for (let i = 0; i < 52; i += 1) {
      const accent = pick(ACCENTS, i * 3 + familyIndex);
      const age = pick(AGES, i * 2 + familyIndex);
      const timbre = pick(timbrePool, i * 7 + familyIndex * 3);
      const texture = pick(TEXTURES, i * 5 + familyIndex * 4);
      const gender = family.gender === 'MIX' ? (i % 2 === 0 ? 'F' : 'M') : family.gender;
      const text = family.build({
        age: age[1],
        timbre,
        accent: accent[1],
        texture,
        genderWord: genderWord(gender),
      });
      out.push({
        id: '',
        family: family.id,
        familyLabel: family.label,
        mode: 'voice_design',
        gender,
        accent: accent[0],
        text,
      });
    }
  });
  return out;
}

function buildInstruct() {
  const out = [];
  const actions = [
    'narrando un cuento para adultos',
    'presentando un producto en una feria',
    'explicando un procedimiento paso a paso',
    'leyendo un mensaje personal',
    'cerrando un episodio de podcast',
    'describiendo un paisaje',
    'dando una noticia dificil',
    'vendiendo una entrada de ultimo minuto',
    'guiando una respiracion',
    'recitando una lista de compras',
    'contando un secreto',
    'animando a un equipo antes de un partido',
    'despidiendo a alguien en el aeropuerto',
    'anunciando el proximo tren',
    'leyendo un fragmento de novela negra',
    'haciendo una pregunta retorica',
    'pidiendo silencio en una biblioteca',
    'celebrando un cumpleanos',
    'explicando una receta familiar',
    'dando instrucciones de seguridad',
    'presentando a un invitado',
    'cerrando una reunion de trabajo',
    'contando una leyenda local',
    'narrando un partido de futbol',
    'leyendo un poema de amor',
  ];
  STYLES.forEach((style, styleIndex) => {
    for (let i = 0; i < 19; i += 1) {
      const context = pick(STYLE_CONTEXTS, i + styleIndex);
      const action = pick(actions, i * 5 + styleIndex);
      const accent = pick(ACCENTS, i + styleIndex * 3);
      out.push({
        id: '',
        family: `instruct_${style[0]}`,
        familyLabel: `Estilo: ${style[0]}`,
        mode: 'instruct_tts',
        gender: 'MIX',
        accent: accent[0],
        text: `Habla ${style[1]}. El texto corresponde a ${action}, en ${context}, y debe sonar con acento ${accent[1]}.`,
      });
    }
  });
  return out;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function finalize(list) {
  return dedupe(list).map((item, index) => ({ ...item, id: `vp-${String(index + 1).padStart(4, '0')}` }));
}

export const PROMPT_LIBRARY = finalize([...buildVoiceDesign(), ...buildInstruct()]);

export const PROMPT_FAMILIES = (() => {
  const map = new Map();
  PROMPT_LIBRARY.forEach((item) => {
    if (!map.has(item.family)) map.set(item.family, { id: item.family, label: item.familyLabel, mode: item.mode, count: 0 });
    map.get(item.family).count += 1;
  });
  return Array.from(map.values());
})();

export const PROMPT_TOTAL = PROMPT_LIBRARY.length;

export function searchPrompts(query, family, mode) {
  const q = (query || '').toLowerCase().trim();
  return PROMPT_LIBRARY.filter((item) => {
    if (family !== 'todas' && item.family !== family) return false;
    if (mode !== 'todos' && item.mode !== mode) return false;
    if (!q) return true;
    return `${item.text} ${item.familyLabel} ${item.accent}`.toLowerCase().includes(q);
  });
}

/* ------------------------------------------------------------------ *
 * VERSION MEJORADA
 *
 * La auditoria del modulo Qwen Voice Studio encontro que 654 de los 654
 * prompts de VoiceDesign no declaran emocion ni grabacion, y que ninguno
 * llega al maximo de los controles. En vez de reescribir la biblioteca a
 * mano (que destruiria el texto auditado), cada prompt guarda aqui su
 * version mejorada: el original se conserva intacto y se puede comparar.
 *
 * Las instrucciones de CosyVoice ya cumplen los cinco controles de su modo,
 * asi que su version mejorada es identica al original y no se duplica.
 * ------------------------------------------------------------------ */

// Frases fijas del compilador. Se anaden solo cuando el original no las dice.
const IMPROVE_ADDITIONS = [
  { check: 'age', re: /\b(anos|años|joven|adult[ao]|madur[ao]|senior|ancian)\b/i, text: 'adulta de unos 35 a 45 anos' },
  { check: 'timbre', re: /\b(timbre|grave|agudo|calid|brillante|nasal|ronc|asper|sedos|aterciopelad|metalic|profund)/i, text: 'timbre calido y aterciopelado' },
  { check: 'cadence', re: /\b(cadencia|ritmo|pausad|lento|rapid|agil|conversacional|contemplativ)\b/i, text: 'cadencia pausada y reflexiva' },
  { check: 'emotion', re: /\b(emocion|tono (alegre|serio|triste|solemne|ironic|epic)|alegre|solemne|triste|serio|ironic|misterios|urgente|tierno|epico|complice|divertid|melancol|seductor|autoritari|calmad|sarcast|nervios|entusiast)/i, text: 'emocion serena y contenida' },
  { check: 'accent', re: /\b(acento|castellano|mexican|rioplatense|colombian|chilen|peruan|caribe|venezolan|andaluz|latinoamerican|neutro)\b/i, text: 'acento castellano neutro de Espana' },
  { check: 'purpose', re: /\b(audiolibro|documental|comercial|spot|noticias|podcast|videojuego|doblaje|cuento|elearning|telefonia|ivr|poesia|meditacion|audiodescripcion|narracion|locucion)/i, text: '' },
  { check: 'recording', re: /\b(estudio|microfono|microfon|cercan|grabacion|reverberacion|sala peque|seca|distancia)/i, text: 'grabacion de estudio seca y cercana al microfono' },
];

/**
 * El proposito no se inventa: se deriva de lo que el texto ya dice que va a
 * hacer la voz. Si no se reconoce ninguna pista, no se anade nada.
 */
const PURPOSE_HINTS = [
  { re: /audiolibro|narrar|novela|ficcion literaria|capitulo/i, text: 'pensada para audiolibro de ficcion' },
  { re: /documental|divulgacion|cientific/i, text: 'pensada para documental de divulgacion' },
  { re: /spot|comercial|publicidad|cu[nñ]a/i, text: 'pensada para locucion comercial' },
  { re: /boletin|noticias|informativ|periodis/i, text: 'pensada para boletin informativo' },
  { re: /podcast|episodio|entrevista/i, text: 'pensada para podcast conversacional' },
  { re: /videojuego|npc|mision/i, text: 'pensada para videojuego' },
  { re: /doblaje|animacion|caricatur/i, text: 'pensada para doblaje de animacion' },
  { re: /cuento|infantil|ni[nñ]os/i, text: 'pensada para cuentos infantiles' },
  { re: /telefon|ivr|atencion al cliente/i, text: 'pensada para telefonia e IVR' },
  { re: /meditacion|respiracion|descanso/i, text: 'pensada para meditacion guiada' },
  { re: /poesia|teatro|recital/i, text: 'pensada para poesia y teatro' },
  { re: /audiodescripcion/i, text: 'pensada para audiodescripcion' },
  { re: /deporte|futbol|retransmision/i, text: 'pensada para radio deportiva' },
  { re: /elearning|formacion|curso|corporativ/i, text: 'pensada para formacion corporativa' },
];

/**
 * Version mejorada de un prompt de VoiceDesign: conserva el texto original y
 * anade, al final, solo los atributos que faltan.
 */
export function improveVoiceDesignPrompt(text) {
  const original = String(text || '').trim();
  const faltantes = IMPROVE_ADDITIONS.filter((item) => item.re.test(original) === false && item.text).map((item) => item.text);
  // El proposito se toma de lo que el texto ya declara, nunca de un catalogo.
  if (!/\b(pensad[ao] para|para (un|una|el|la) )/.test(original)) {
    const pista = PURPOSE_HINTS.find((hint) => hint.re.test(original));
    if (pista) faltantes.push(pista.text);
  }
  if (!faltantes.length) return original;
  return `${original.replace(/\.$/, '')}, ${faltantes.join(', ')}.`;
}

/** La biblioteca con `improved` en cada entrada. Los instruct no cambian. */
export const PROMPT_LIBRARY_V2 = PROMPT_LIBRARY.map((item) => ({
  ...item,
  improved: item.mode === 'voice_design' ? improveVoiceDesignPrompt(item.text) : item.text,
  added:
    item.mode === 'voice_design'
      ? [
          ...IMPROVE_ADDITIONS.filter((a) => !a.re.test(item.text) && a.text).map((a) => a.check),
          ...(!/\b(pensad[ao] para|para (un|una|el|la) )/.test(item.text) && PURPOSE_HINTS.some((h) => h.re.test(item.text))
            ? ['purpose']
            : []),
        ]
      : [],
}));

/** Cuantos prompts cambiarian y cuantos caracteres se anaden de media. */
export const PROMPT_V2_STATS = (() => {
  const mejorados = PROMPT_LIBRARY_V2.filter((item) => item.improved !== item.text);
  const extra = mejorados.reduce((acc, item) => acc + (item.improved.length - item.text.length), 0);
  return {
    total: PROMPT_LIBRARY_V2.length,
    mejorados: mejorados.length,
    intactos: PROMPT_LIBRARY_V2.length - mejorados.length,
    mediaExtra: mejorados.length ? Math.round(extra / mejorados.length) : 0,
  };
})();

/** Busqueda sobre la version mejorada, con la misma firma que searchPrompts. */
export function searchPromptsV2(query, family, mode) {
  const q = (query || '').toLowerCase().trim();
  return PROMPT_LIBRARY_V2.filter((item) => {
    if (family !== 'todas' && item.family !== family) return false;
    if (mode !== 'todos' && item.mode !== mode) return false;
    if (!q) return true;
    return `${item.improved} ${item.text} ${item.familyLabel} ${item.accent}`.toLowerCase().includes(q);
  });
}
