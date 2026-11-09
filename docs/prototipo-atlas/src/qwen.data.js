// VozStudio Atlas - Qwen Voice Studio (modulo de diseno de voz con Qwen3-TTS).
//
// Este modulo reproduce el contrato del backend compartido (qwen3vd.txt,
// "Qwen Voice Studio Pro v2") dentro del prototipo, sin red y sin Python:
//
//   1. DESCRIPCION LIBRE -> perfil acustico estructurado (VoiceProfileParser v2).
//      Catorce campos, `null` cuando el atributo no se especifica, y un bloque
//      de analisis con confianza, ambiguedades y conflictos.
//   2. PERFIL -> instruccion en lenguaje natural para Qwen3-TTS VoiceDesign.
//      La compilacion es determinista: mismas piezas, misma frase.
//   3. INSTRUCCION -> payload real de `generate_voice_design`:
//      { text, language: "Spanish", instruct } dentro del contrato de SynthesizeRequest.
//
// La diferencia con el archivo original: aqui no se inventa nada. El parser es
// lexico y determinista (no hay Phi-3.5 en el prototipo), y declara su confianza
// y sus ambiguedades en vez de fingir una llamada a un modelo.

/** Los catorce campos, en el orden del contrato. */
export const VOICE_FIELDS = [
  { id: 'gender', label: 'Genero', kind: 'enum', options: ['masculino', 'femenino', 'androgino'] },
  { id: 'age', label: 'Edad aparente', kind: 'number', min: 5, max: 100 },
  { id: 'accent', label: 'Acento', kind: 'text', max: 120 },
  { id: 'texture', label: 'Textura', kind: 'text', max: 160 },
  { id: 'emotion', label: 'Emocion', kind: 'text', max: 100 },
  { id: 'purpose', label: 'Proposito', kind: 'text', max: 160 },
  { id: 'pitch', label: 'Tono (pitch)', kind: 'enum', options: ['grave', 'medio', 'agudo'] },
  { id: 'pacing', label: 'Ritmo', kind: 'enum', options: ['lento', 'conversacional', 'rapido'] },
  { id: 'energy', label: 'Energia', kind: 'enum', options: ['letargica', 'contenida', 'conversacional', 'proyectada', 'euforica'] },
  { id: 'f0Curve', label: 'Entonacion F0', kind: 'enum', options: ['plana', 'estable', 'dinamica', 'expresiva', 'erratica'] },
  { id: 'micProximity', label: 'Proximidad', kind: 'enum', options: ['cercana', 'estudio', 'media', 'lejana'] },
  { id: 'breathiness', label: 'Aire', kind: 'enum', options: ['nula', 'ligera', 'natural', 'fuerte'] },
  { id: 'formants', label: 'Resonancia', kind: 'enum', options: ['calidos', 'neutros', 'brillantes'] },
  { id: 'articulation', label: 'Articulacion', kind: 'enum', options: ['relajada', 'normal', 'precisa'] },
];

/** Perfil vacio: todos los atributos en null, como exige el contrato. */
export function emptyProfile() {
  return VOICE_FIELDS.reduce((acc, item) => ({ ...acc, [item.id]: null }), {});
}

/**
 * Lexico del parser. Cada entrada tiene patron, valor y peso (cuanto de fiable
 * es la pista). Se recorren de mas especifico a mas general para que
 * "latinoamericano neutro" gane a "neutro".
 */
const LEXICON = [
  // Genero
  { field: 'gender', value: 'femenino', weight: 0.9, re: /\b(mujer|femenin[ao]s?|narradora|locutora|actriz|chica|senora|dama)\b/ },
  { field: 'gender', value: 'masculino', weight: 0.9, re: /\b(hombre|masculin[ao]s?|narrador|locutor|actor|chico|caballero|senor)\b/ },
  { field: 'gender', value: 'androgino', weight: 0.85, re: /\b(androg[ií]n[ao]s?|neutr[ao] en genero|sin genero)\b/ },

  // Edad
  { field: 'age', value: 22, weight: 0.8, re: /\b(18|19|2[0-4])\s*(anos|años)\b/ },
  { field: 'age', value: 28, weight: 0.75, re: /\bjoven\b/ },
  { field: 'age', value: 55, weight: 0.75, re: /\b(madur[ao]|mediana edad)\b/ },
  { field: 'age', value: 68, weight: 0.8, re: /\b(senior|mayor|abuel[oa])\b/ },
  { field: 'age', value: 78, weight: 0.8, re: /\b(ancian[oa]|viejo|viejecita|setenton)\b/ },

  // Acento
  { field: 'accent', value: 'peruano urbano', weight: 0.95, re: /\b(peru|lime[nñ]o)/ },
  { field: 'accent', value: 'espanol latinoamericano neutro', weight: 0.9, re: /\b(latinoamerican[ao] neutro|neutro latino|espanol neutro)\b/ },
  { field: 'accent', value: 'castellano neutro de Espana', weight: 0.9, re: /\b(castellano|espanol de espana|peninsular|madrilen[oa])\b/ },
  { field: 'accent', value: 'mexicano del centro', weight: 0.9, re: /\b(mexic|chilang)/ },
  { field: 'accent', value: 'rioplatense argentino', weight: 0.9, re: /\b(argentin|rioplatense|bonaerense|porte[nñ])/ },
  { field: 'accent', value: 'colombiano andino', weight: 0.9, re: /\b(colombian|bogotan|paisa)\b/ },
  { field: 'accent', value: 'chileno santiaguino', weight: 0.9, re: /\b(chilen|santiaguin)/ },
  { field: 'accent', value: 'caribeno cubano', weight: 0.9, re: /\b(cuban|caribe[nñ]|habaner)/ },
  { field: 'accent', value: 'venezolano central', weight: 0.9, re: /\b(venezolan|carague[nñ])/ },
  { field: 'accent', value: 'andaluz suave', weight: 0.9, re: /\b(andaluz|sevillan|malague[nñ])/ },

  // Textura (timbre)
  { field: 'texture', value: 'profunda y resonante', weight: 0.85, re: /\b(profund[ao]s?|resonante|pectoral|de pecho)\b/ },
  { field: 'texture', value: 'calida y aterciopelada', weight: 0.8, re: /\b(calid[ao]|aterciopelad[ao]|sedos[ao])/ },
  { field: 'texture', value: 'aspera y gastada', weight: 0.8, re: /\b(asper[ao]s?|rasp[ao]s?|gastad[ao]|ronc[ao]|quebrad[ao])\b/ },
  { field: 'texture', value: 'brillante y limpia', weight: 0.8, re: /\b(brillante|limpia|luminos[ao]|cristalin[ao])\b/ },
  { field: 'texture', value: 'nasal y caracteristica', weight: 0.8, re: /\b(nasal|gangos[ao])\b/ },
  { field: 'texture', value: 'aerea y ligera', weight: 0.8, re: /\b(aere[ao]|ligera|etere[ao]|vaporos[ao])\b/ },
  { field: 'texture', value: 'metalica y cortante', weight: 0.8, re: /\b(metalic[ao]|cortante|filos[ao])\b/ },

  // Emocion
  { field: 'emotion', value: 'solemnidad', weight: 0.8, re: /\b(solemne|solemnidad|ceremonios[ao]|epic[ao])\b/ },
  { field: 'emotion', value: 'tension contenida', weight: 0.85, re: /\b(tension|suspense|amenaza|thriller|misterio)\b/ },
  { field: 'emotion', value: 'alegria', weight: 0.8, re: /\b(alegria|alegre|feliz|optimis|entusiasmo|divertid[ao])\b/ },
  { field: 'emotion', value: 'tristeza', weight: 0.8, re: /\b(triste|melancol|nostalgi|duelo)\b/ },
  { field: 'emotion', value: 'serenidad', weight: 0.8, re: /\b(seren[ao]|calma|tranquil[ao]|relajad[ao])\b/ },
  { field: 'emotion', value: 'urgencia', weight: 0.85, re: /\b(urgencia|urgente|apuro|emergencia)\b/ },
  { field: 'emotion', value: 'empatia', weight: 0.8, re: /\b(empatia|comprension|cercania emocional)\b/ },
  { field: 'emotion', value: 'autoridad', weight: 0.8, re: /\b(autoridad|autoritari[ao]|mando|jefe|rey|reina)\b/ },
  { field: 'emotion', value: 'vulnerabilidad', weight: 0.85, re: /\b(vulnerab|confesion|intim[ao]|fragilidad)\b/ },
  { field: 'emotion', value: 'ironia', weight: 0.8, re: /\b(ironic[ao]|sarcas|burlon|guino)\b/ },

  // Proposito
  { field: 'purpose', value: 'audiolibro de ficcion', weight: 0.85, re: /\b(audiolibro|novela|ficcion literaria|capitulo)\b/ },
  { field: 'purpose', value: 'documental', weight: 0.85, re: /\b(documental|divulgacion|naturaleza|cientific)/ },
  { field: 'purpose', value: 'locucion comercial', weight: 0.85, re: /\b(comercial|spot|anuncio|publicidad|cu[nñ]a)\b/ },
  { field: 'purpose', value: 'noticias', weight: 0.85, re: /\b(noticias|boletin|informativ|periodis)/ },
  { field: 'purpose', value: 'podcast', weight: 0.85, re: /\b(podcast|episodio|entrevista)\b/ },
  { field: 'purpose', value: 'videojuego', weight: 0.85, re: /\b(videojuego|npc|mision)\b/ },
  { field: 'purpose', value: 'doblaje de animacion', weight: 0.85, re: /\b(doblaje|animacion|caricatur)/ },
  { field: 'purpose', value: 'cuento infantil', weight: 0.85, re: /\b(cuento|infantil|ni[nñ]os|dormir)\b/ },
  { field: 'purpose', value: 'asistente de voz', weight: 0.85, re: /\b(asistente|ivr|telefon|atencion al cliente|recepcion)/ },
  { field: 'purpose', value: 'meditacion guiada', weight: 0.85, re: /\b(meditacion|respiracion|mindfulness|descanso)\b/ },
  { field: 'purpose', value: 'mensaje personal', weight: 0.8, re: /\b(mensaje personal|nota de voz)\b/ },

  // Pitch
  { field: 'pitch', value: 'grave', weight: 0.8, re: /\b(grave|registro bajo|de bajo)\b/ },
  { field: 'pitch', value: 'agudo', weight: 0.8, re: /\b(agud[ao]|registro alto|tesitura alta|chillon)\b/ },
  { field: 'pitch', value: 'medio', weight: 0.7, re: /\b(tono medio|registro medio|intermedio)\b/ },

  // Pacing
  { field: 'pacing', value: 'lento', weight: 0.8, re: /\b(lento|pausad[ao]|contemplativ|sin prisa)\b/ },
  { field: 'pacing', value: 'rapido', weight: 0.8, re: /\b(rapid[ao]|agil|acelerad[ao]|dinamic|vertiginos)/ },
  { field: 'pacing', value: 'conversacional', weight: 0.8, re: /\b(conversacional|coloquial)\b/ },

  // Energy
  { field: 'energy', value: 'proyectada', weight: 0.8, re: /\b(proyectad[ao]|proyeccion|escenario|potente)\b/ },
  { field: 'energy', value: 'euforica', weight: 0.85, re: /\b(eufori|euforic|exaltad[ao]|a gritos)\b/ },
  { field: 'energy', value: 'contenida', weight: 0.8, re: /\b(contenid[ao]|reservad[ao]|discret[ao])\b/ },
  { field: 'energy', value: 'letargica', weight: 0.85, re: /\b(letargic|sin energia|apagad[ao])\b/ },

  // F0
  { field: 'f0Curve', value: 'expresiva', weight: 0.8, re: /\b(expresiv[ao]|melodic[ao]|modulad[ao]|teatral)\b/ },
  { field: 'f0Curve', value: 'estable', weight: 0.8, re: /\b(estable|controlad[ao]|uniforme)\b/ },
  { field: 'f0Curve', value: 'plana', weight: 0.85, re: /\b(plana|monoton[ao]|sin variacion)\b/ },
  { field: 'f0Curve', value: 'dinamica', weight: 0.8, re: /\b(dinamic[ao]|variad[ao]|ondulante)\b/ },
  { field: 'f0Curve', value: 'erratica', weight: 0.85, re: /\b(erratic|inestable|impredecible|nervios[ao])\b/ },

  // Proximidad de microfono
  { field: 'micProximity', value: 'cercana', weight: 0.85, re: /\b(cercan[ao] al microfono|intim[ao]|al oido)\b/ },
  { field: 'micProximity', value: 'estudio', weight: 0.85, re: /\b(estudio|seca|cabina)\b/ },
  { field: 'micProximity', value: 'lejana', weight: 0.85, re: /\b(lejan[ao]|distante|sala grande)\b/ },
  { field: 'micProximity', value: 'media', weight: 0.7, re: /\b(sala peque[nñ]a|de habitacion)\b/ },

  // Aire
  { field: 'breathiness', value: 'fuerte', weight: 0.85, re: /\b(mucho aire|aspirad[ao]|respirad[ao]|aire fuerte)\b/ },
  { field: 'breathiness', value: 'ligera', weight: 0.85, re: /\b(ligero aire|aire tenue|airead[ao]|respiracion audible|sopl[oa])\b/ },
  { field: 'breathiness', value: 'nula', weight: 0.85, re: /\b(sin aire|limpia de aire)\b/ },
  { field: 'breathiness', value: 'natural', weight: 0.7, re: /\b(aire natural|respiracion natural)\b/ },

  // Resonancia
  { field: 'formants', value: 'calidos', weight: 0.8, re: /\b(resonancia calid|formantes calid|redond[ao])\b/ },
  { field: 'formants', value: 'brillantes', weight: 0.8, re: /\b(resonancia brillante|formantes brillante)\b/ },
  { field: 'formants', value: 'neutros', weight: 0.7, re: /\b(resonancia neutr|formantes neutr|equilibrad[ao])\b/ },

  // Articulacion
  { field: 'articulation', value: 'precisa', weight: 0.8, re: /\b(precis[ao]|impecable|diccion|articulad[ao]|muy clar[ao])\b/ },
  { field: 'articulation', value: 'relajada', weight: 0.8, re: /\b(relajad[ao]|suelta|despreocupad[ao])\b/ },
  { field: 'articulation', value: 'normal', weight: 0.6, re: /\b(articulacion normal)\b/ },
];

/** Conflictos conocidos: pares que el contrato prohibe ir juntos. */
const CONFLICTS = [
  {
    test: (p) => p.breathiness === 'fuerte' && p.articulation === 'precisa',
    text: 'Aire fuerte con articulacion precisa: las sibilancias se comen las consonantes. Baja el aire o relaja la articulacion.',
  },
  {
    test: (p) => p.energy === 'euforica' && p.pacing === 'lento',
    text: 'Energia euforica con ritmo lento: el motor recibe dos ordenes opuestas y suele resolver a media. Elige una.',
  },
  {
    test: (p) => p.pitch === 'agudo' && p.texture === 'profunda y resonante',
    text: 'Tono agudo con textura profunda: un tono agudo no tiene graves solidos. Se contradicen.',
  },
  {
    test: (p) => p.micProximity === 'lejana' && p.energy === 'contenida',
    text: 'Voz lejana y contenida: el resultado suena ininteligible. Si es lejana, sube la energia.',
  },
  {
    test: (p) => p.f0Curve === 'plana' && p.emotion === 'alegria',
    text: 'Entonacion plana con emocion alegre: la alegria vive en la curva de F0.',
  },
];

/**
 * Parser lexico de la descripcion libre. Mismo formato de salida que
 * POST /api/translate: { profile, analysis: { confidence, ambiguities, conflicts } }.
 */
export function parseDescription(description) {
  const text = String(description || '').toLowerCase();
  const profile = emptyProfile();
  const hits = [];
  const ambiguities = [];

  if (!text.trim()) {
    return {
      profile,
      analysis: { confidence: 0, ambiguities: ['No hay descripcion que analizar.'], conflicts: [] },
      matched: 0,
    };
  }

  LEXICON.forEach((entry) => {
    if (!entry.re.test(text)) return;
    if (profile[entry.field] === null) {
      profile[entry.field] = entry.value;
      hits.push(entry);
      return;
    }
    if (profile[entry.field] === entry.value) return;

    // Segundo valor distinto para el mismo campo: gana el de mas peso.
    const previo = hits.filter((c) => c.field === entry.field).sort((a, b) => b.weight - a.weight)[0];
    if (previo && entry.weight > previo.weight) {
      ambiguities.push(`«${entry.field}»: el texto sugiere «${entry.value}» y «${previo.value}»; se aplico el de mas peso.`);
      profile[entry.field] = entry.value;
      hits.push(entry);
    } else if (previo) {
      ambiguities.push(`«${entry.field}» podria ser «${entry.value}», pero el texto lo describe como «${previo.value}».`);
    }
  });

  // La edad en cifras gana al adjetivo.
  const edadExplicita = text.match(/\b(?:de|con|tiene|unos|aparenta)\s+(\d{1,3})\s*(?:anos|años)\b/);
  if (edadExplicita) {
    const edad = Number(edadExplicita[1]);
    if (edad >= 5 && edad <= 100) {
      if (profile.age !== null && profile.age !== edad) {
        ambiguities.push(`Hay dos edades en el texto: se aplica la cifra explicita (${edad} anos).`);
      }
      profile.age = edad;
    }
  }

  const conflicts = CONFLICTS.filter((item) => item.test(profile)).map((item) => item.text);

  const cubiertos = VOICE_FIELDS.filter((f) => profile[f.id] !== null).length / VOICE_FIELDS.length;
  const pesoMedio = hits.length ? hits.reduce((acc, h) => acc + h.weight, 0) / hits.length : 0;
  let confidence = cubiertos * 0.7 + pesoMedio * 0.3;
  if (conflicts.length) confidence *= 0.85;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  if (!hits.length) {
    ambiguities.push('No se reconocio ningun atributo: describe genero, edad, timbre, emocion o acento.');
  } else if (cubiertos < 0.35) {
    ambiguities.push('El texto cubre pocos atributos: el prompt compilado sera generico.');
  }

  return { profile, analysis: { confidence, ambiguities, conflicts }, matched: hits.length };
}

/* ------------------------- compilador semantico ------------------------- */
/*
  Traducciones cerradas del contrato. Arma identidad, timbre, interpretacion y
  grabacion, y las une en la instruccion que viaja tal cual en `instruct`.
*/
const GENDER = {
  masculino: 'A masculine-sounding voice',
  femenino: 'A feminine-sounding voice',
  androgino: 'An androgynous-sounding voice',
};
const PITCH = { grave: 'low-pitched', medio: 'mid-pitched', agudo: 'high-pitched' };
const PACING = {
  lento: 'slow and measured pacing',
  conversacional: 'natural conversational pacing',
  rapido: 'brisk but intelligible pacing',
};
const ENERGY = {
  letargica: 'very low vocal energy',
  contenida: 'restrained vocal energy',
  conversacional: 'natural conversational energy',
  proyectada: 'confident projected delivery',
  euforica: 'highly energetic delivery',
};
const F0 = {
  plana: 'minimal pitch variation',
  estable: 'controlled natural intonation',
  dinamica: 'naturally varied intonation',
  expresiva: 'expressive melodic intonation',
  erratica: 'deliberately unstable intonation',
};
const BREATH = {
  nula: 'clean, minimally breathy phonation',
  ligera: 'subtly airy phonation',
  natural: 'natural breathiness',
  fuerte: 'noticeably breathy phonation',
};
const ARTICULATION = {
  relajada: 'relaxed articulation',
  normal: 'natural clear articulation',
  precisa: 'crisp and precise articulation',
};
const RECORDING = {
  cercana: 'an intimate, close-recorded impression',
  estudio: 'a clean, dry studio-recorded impression',
  media: 'a natural conversational recording impression',
  lejana: 'a slightly distant vocal impression',
};
const FORMANTS = {
  calidos: 'warm and rounded vocal resonance',
  neutros: 'balanced vocal resonance',
  brillantes: 'bright vocal resonance',
};

const joinParts = (parts) => parts.filter(Boolean).join('; ') || 'Natural voice';

/** Plantilla maestra: texto literal de MASTER_PROMPT del backend compartido. */
export const MASTER_TEMPLATE = `You are preparing a natural-language voice design instruction for Qwen3-TTS VoiceDesign.

The target spoken language is Spanish.

Describe one coherent voice identity and one coherent delivery style. Preserve the intended accent, timbre and emotional tone.

VOICE IDENTITY:
{{identity}}

VOICE TIMBRE:
{{timbre}}

VOICE DELIVERY:
{{delivery}}

PERCEPTUAL RECORDING STYLE:
{{recording}}

GENERAL REQUIREMENTS:
Natural human speech, clear Spanish pronunciation, coherent prosody, stable vocal identity and intelligible articulation.

Avoid contradictory instructions and excessive exaggeration. Do not generate stage directions or sound effects as speech.`;

/** Las cuatro piezas del prompt, para poder ensenarlas por separado. */
export function profileParts(profile) {
  const p = { ...emptyProfile(), ...profile };
  const tieneEdad = p.age !== null && p.age !== undefined && p.age !== '';
  return {
    identity: joinParts([
      GENDER[p.gender],
      tieneEdad ? `with the perceived maturity of a ${p.age}-year-old` : null,
      p.accent ? `speaking with a ${p.accent} accent` : null,
    ]),
    timbre: joinParts([
      p.texture ? `A ${p.texture} vocal texture` : null,
      PITCH[p.pitch],
      FORMANTS[p.formants],
      BREATH[p.breathiness],
    ]),
    delivery: joinParts([
      p.emotion ? `Convey ${p.emotion}` : null,
      p.purpose ? `Suitable for ${p.purpose}` : null,
      PACING[p.pacing],
      ENERGY[p.energy],
      F0[p.f0Curve],
      ARTICULATION[p.articulation],
    ]),
    recording: joinParts([RECORDING[p.micProximity]]),
  };
}

/**
 * Compila el perfil a la instruccion final. Determinista y sin variables sin
 * resolver: si quedara alguna, se lanza en vez de mandar un prompt roto.
 */
export function compileProfile(profile, template = MASTER_TEMPLATE) {
  const parts = profileParts(profile);
  let out = template;
  Object.entries(parts).forEach(([key, value]) => {
    out = out.replaceAll(`{{${key}}}`, value);
  });
  const pendientes = out.match(/\{\{[^{}]+\}\}/g);
  if (pendientes) throw new Error(`Variables sin resolver: ${pendientes.join(', ')}`);
  return out.trim();
}

/** Cuantos de los catorce campos estan cubiertos y su porcentaje. */
export function profileCoverage(profile) {
  const p = profile || {};
  const done = VOICE_FIELDS.filter((f) => p[f.id] !== null && p[f.id] !== undefined && p[f.id] !== '').length;
  return { done, total: VOICE_FIELDS.length, pct: Math.round((done / VOICE_FIELDS.length) * 100) };
}

/** El payload que viaja al motor, igual que el contrato del backend. */
export function buildPayload({ text, instruction, profile, language = 'Spanish' }) {
  return {
    schema_version: '2.0',
    model: 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',
    task: 'voice_design',
    input: { text, language, instruct: instruction },
    output: { format: 'wav' },
    profile: profile || null,
  };
}

/* ---------------------------- biblioteca ---------------------------- */
/*
  Las quince voces semilla del backend compartido, con sus mismos atributos.
  Son perfiles completos: sirven de ejemplo y de punto de partida.
*/
export const SEED_VOICES = [
  {
    title: 'Narrador epico',
    category: 'Audiolibros',
    profile: { gender: 'masculino', age: 50, accent: 'espanol latinoamericano neutro', texture: 'profunda y resonante', emotion: 'solemnidad', pitch: 'grave', pacing: 'lento', energy: 'proyectada', f0Curve: 'expresiva' },
  },
  {
    title: 'Cuentacuentos infantil',
    category: 'Audiolibros',
    profile: { gender: 'femenino', age: 60, texture: 'calida y aterciopelada', emotion: 'alegria', pacing: 'conversacional', f0Curve: 'expresiva', articulation: 'precisa' },
  },
  {
    title: 'Thriller psicologico',
    category: 'Audiolibros',
    profile: { gender: 'androgino', age: 35, texture: 'aspera y gastada', emotion: 'tension contenida', energy: 'contenida', pacing: 'lento' },
  },
  {
    title: 'Narradora documental',
    category: 'Audiolibros',
    profile: { gender: 'femenino', age: 42, accent: 'peruano urbano', texture: 'calida y aterciopelada', emotion: 'serenidad', energy: 'conversacional', articulation: 'precisa' },
  },
  {
    title: 'Villano calculador',
    category: 'Videojuegos',
    profile: { gender: 'masculino', age: 45, texture: 'aspera y gastada', emotion: 'tension contenida', pitch: 'grave', pacing: 'lento', energy: 'contenida' },
  },
  {
    title: 'Heroina tactica',
    category: 'Videojuegos',
    profile: { gender: 'femenino', age: 28, emotion: 'urgencia', energy: 'proyectada', articulation: 'precisa', pacing: 'rapido' },
  },
  {
    title: 'Mago anciano',
    category: 'Videojuegos',
    profile: { gender: 'masculino', age: 80, texture: 'aspera y gastada', pitch: 'grave', pacing: 'lento' },
  },
  {
    title: 'IA de nave',
    category: 'Videojuegos',
    profile: { gender: 'femenino', age: 30, texture: 'brillante y limpia', emotion: 'serenidad', f0Curve: 'estable', articulation: 'precisa' },
  },
  {
    title: 'Asistente ejecutivo',
    category: 'Asistentes AI',
    profile: { gender: 'masculino', age: 40, texture: 'calida y aterciopelada', emotion: 'autoridad', articulation: 'precisa' },
  },
  {
    title: 'Recepcionista clinica',
    category: 'Asistentes AI',
    profile: { gender: 'femenino', age: 35, texture: 'calida y aterciopelada', emotion: 'empatia', energy: 'contenida', pacing: 'conversacional' },
  },
  {
    title: 'Guia de meditacion',
    category: 'Asistentes AI',
    profile: { gender: 'femenino', age: 40, texture: 'calida y aterciopelada', emotion: 'serenidad', pacing: 'lento', breathiness: 'ligera' },
  },
  {
    title: 'Locutor juvenil',
    category: 'Publicidad',
    profile: { gender: 'masculino', age: 22, texture: 'brillante y limpia', emotion: 'alegria', energy: 'euforica', pacing: 'rapido' },
  },
  {
    title: 'Automoviles de lujo',
    category: 'Publicidad',
    profile: { gender: 'masculino', age: 50, texture: 'profunda y resonante', emotion: 'autoridad', pitch: 'grave', pacing: 'lento' },
  },
  {
    title: 'Confesion intima',
    category: 'Doblaje',
    profile: { gender: 'femenino', age: 28, emotion: 'vulnerabilidad', energy: 'contenida', breathiness: 'ligera', micProximity: 'cercana' },
  },
  {
    title: 'Rey medieval',
    category: 'Doblaje',
    profile: { gender: 'masculino', age: 60, texture: 'profunda y resonante', emotion: 'solemnidad', energy: 'proyectada', articulation: 'precisa' },
  },
];

export const SEED_CATEGORIES = [...new Set(SEED_VOICES.map((v) => v.category))];

/** Texto de prueba por defecto del laboratorio. */
export const DEFAULT_SPEECH =
  'Hola. Esta es una prueba de voz generada localmente con Qwen tres. Estoy evaluando la naturalidad, la entonacion y la claridad.';

/** Limites del contrato (MAX_TEXT y MAX_PROMPT del backend). */
export const QWEN_MAX_TEXT = 2000;
export const MAX_INSTRUCTION = 3000;

/**
 * Diagnostico de un prompt de la biblioteca de 1.110.
 *
 * Regla de oro del modulo: no se reescribe ningun texto existente. Se dice que
 * le falta, que se puede anadir sin inventar, y se ofrece una version mejorada
 * que el usuario decide aplicar.
 *
 * Cada hallazgo tiene id estable, gravedad y una pista concreta.
 */
export const PROMPT_CHECKS = [
  {
    id: 'gender',
    label: 'Genero explicito',
    gravedad: 'alta',
    test: (text) => /\b(voz (femenina|masculina|androgina)|femenin|masculin|androg)/i.test(text),
    fix: 'Di el genero percibido: el motor lo usa como ancla de identidad.',
  },
  {
    id: 'age',
    label: 'Edad aparente',
    gravedad: 'alta',
    test: (text) => /\b(anos|años|joven|adult[ao]|madur[ao]|senior|ancian)\b/i.test(text),
    fix: 'Añade la madurez percibida ("de unos 35 anos"): mueve el peso de los formantes.',
  },
  {
    id: 'accent',
    label: 'Acento',
    gravedad: 'media',
    test: (text) => /\b(acento|castellano|mexican|rioplatense|colombian|chilen|peruan|caribe|venezolan|andaluz|latinoamerican|neutro)\b/i.test(text),
    fix: 'Concreta el acento: es lo que mas cambia la inteligibilidad percibida.',
  },
  {
    id: 'timbre',
    label: 'Timbre',
    gravedad: 'alta',
    test: (text) => /\b(timbre|grave|agudo|calid|brillante|nasal|ronc|asper|sedos|aterciopelad|metalic|profund)/i.test(text),
    fix: 'Anade el timbre ("calido y aterciopelado"): sin el, el motor elige uno al azar.',
  },
  {
    id: 'cadence',
    label: 'Cadencia',
    gravedad: 'media',
    test: (text) => /\b(cadencia|ritmo|pausad|lento|rapid|agil|conversacional|contemplativ)\b/i.test(text),
    fix: 'Di la cadencia ("pausada y reflexiva" o "agil y ritmica").',
  },
  {
    id: 'emotion',
    label: 'Emocion',
    gravedad: 'media',
    test: (text) => /\b(emocion|tono (alegre|serio|triste|solemne|ironic|epic)|alegre|solemne|triste|serio|ironic|misterios|urgente|tierno|epico|complice|divertid|melancol|seductor|autoritari|calmad|sarcast|nervios|entusiast)/i.test(text),
    fix: 'Declara la emocion dominante: es el eje de la interpretacion.',
  },
  {
    id: 'purpose',
    label: 'Proposito',
    gravedad: 'baja',
    test: (text) => /\b(audiolibro|documental|comercial|spot|noticias|podcast|videojuego|doblaje|cuento|elearning|telefonia|ivr|poesia|meditacion|audiodescripcion|narracion|locucion)/i.test(text),
    fix: 'Anade el uso ("para audiolibro", "para spot de radio"): fija la intensidad.',
  },
  {
    id: 'recording',
    label: 'Grabacion',
    gravedad: 'baja',
    test: (text) => /\b(estudio|microfono|microfon|cercan|grabacion|reverberacion|sala peque|seca|distancia)/i.test(text),
    fix: 'Describe la grabacion percibida ("de estudio", "cercano al microfono").',
  },
  {
    id: 'length',
    label: 'Longitud util',
    gravedad: 'alta',
    test: (text) => text.length >= 120 && text.length <= 700,
    fix: 'El prompt util va de 120 a 700 caracteres: menos deja huecos, mas diluye la instruccion.',
  },
  {
    id: 'clean',
    label: 'Sin contradicciones',
    gravedad: 'alta',
    test: (text) => !/\b(a la vez|y a la vez|tan\b.*\bcomo\b)/i.test(text),
    fix: 'Evita "X y a la vez lo contrario": son ordenes que el motor no puede cumplir juntas.',
  },
];

/** Analiza un prompt y devuelve sus hallazgos ordenados por gravedad. */
export function auditPrompt(text, mode = 'voice_design') {
  const original = String(text || '');
  // La instruccion de CosyVoice no lleva genero, edad ni timbre: pide entrega.
  if (mode === 'instruct_tts') {
    const checks = ['style', 'context', 'accent', 'length', 'clean'];
    const hallazgos = PROMPT_CHECKS.filter((c) => checks.includes(c.id) && !c.test(original)).map((c) => ({
      id: c.id,
      label: c.label,
      gravedad: c.gravedad,
      fix: c.fix,
    }));
    const orden = { alta: 0, media: 1, baja: 2 };
    hallazgos.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
    return {
      hallazgos,
      puntos: Math.round(((checks.length - hallazgos.length) / checks.length) * 100),
      completo: hallazgos.length === 0,
    };
  }
  // Solo los controles de VoiceDesign: style y context son de la instruccion.
  const checksVD = PROMPT_CHECKS.filter((check) => !['style', 'context'].includes(check.id));
  const hallazgos = checksVD.filter((check) => !check.test(original)).map((check) => ({
    id: check.id,
    label: check.label,
    gravedad: check.gravedad,
    fix: check.fix,
  }));
  const orden = { alta: 0, media: 1, baja: 2 };
  hallazgos.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
  const puntos = Math.round(((checksVD.length - hallazgos.length) / checksVD.length) * 100);
  return { hallazgos, puntos, completo: hallazgos.length === 0 };
}

/* Controles propios del prompt de instruccion (CosyVoice Instruct-TTS). */
PROMPT_CHECKS.push(
  {
    id: 'style',
    label: 'Estilo explicito',
    gravedad: 'alta',
    test: (text) => /^habla\b/i.test(text.trim()),
    fix: 'La instruccion empieza por "Habla ...": es el contrato de CosyVoice.',
  },
  {
    id: 'context',
    label: 'Contexto de habla',
    gravedad: 'media',
    test: (text) => /\b(corresponde a|en una|en un|durante|mientras)\b/i.test(text),
    fix: 'Di en que situacion se habla: da la intencion al motor.',
  },
);

/**
 * Mejora un prompt respetando lo que ya dice: no borra texto, anade por detras
 * solo lo que falta, con frases fijas del compilador. Si esta completo, se
 * devuelve tal cual y se dice.
 */
export function improvePrompt(text, { accent = 'castellano neutro de Espana', purpose = '', mode = 'voice_design' } = {}) {
  const original = String(text || '').trim();
  const { hallazgos } = auditPrompt(original, mode);

  if (mode === 'instruct_tts') {
    const falta = new Set(hallazgos.map((h) => h.id));
    const partes = [];
    if (falta.has('style')) partes.push('Habla con tono sereno y cercano, modulando la intensidad en cada frase');
    if (falta.has('context')) partes.push('El texto corresponde a una lectura natural en voz alta');
    if (falta.has('accent')) partes.push(`y debe sonar con acento ${accent}`);
    return {
      text: partes.length ? `${original.replace(/\.$/, '')}. ${partes.join(', ')}.` : original,
      added: [...falta],
      changed: partes.length > 0,
    };
  }
  const falta = new Set(hallazgos.map((h) => h.id));
  if (!falta.size) return { text: original, added: [], changed: false };

  const frases = [];
  const added = [];
  const add = (id, frase) => {
    if (!falta.has(id)) return;
    frases.push(frase);
    added.push(id);
  };

  // Si el prompt no empieza por "Voz", se le da el encabezado del compilador.
  const encabezado = /^(voz|voz de)\b/i.test(original) ? '' : 'Voz ';
  // El genero lo aporta el encabezado o el propio texto, nunca una frase suelta.
  add('age', 'adulta de unos 35 a 45 anos');
  add('timbre', 'timbre calido y aterciopelado');
  add('cadence', 'cadencia pausada y reflexiva');
  add('emotion', 'emocion serena y contenida');
  add('accent', `acento ${accent}`);
  add('recording', 'grabacion de estudio seca y cercana al microfono');
  if (purpose) add('purpose', `pensada para ${purpose}`);

  // Se limpian los huecos de las frases vacias (el genero ya lo trae el texto).
  const limpio = frases.filter(Boolean);
  const texto = [encabezado + original.replace(/\.$/, ''), ...limpio].join(', ');
  return {
    text: texto.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/,\s*\./g, '.') + '.',
    added,
    changed: true,
  };
}
