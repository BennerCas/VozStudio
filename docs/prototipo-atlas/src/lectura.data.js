// VozStudio Atlas - modulo de lectura y narracion.
// Presets predisenados para convertir texto pegado o documento (PDF, EPUB, TXT)
// en audio. Los limites replican el backend real: 12.000 caracteres por peticion
// (SynthesizeRequest.text, max_length=12000) y 80-600 caracteres por bloque.

export const TEXT_LIMIT = 12000;
export const CHUNK_MIN = 80;
export const CHUNK_MAX = 600;

/** Presets de lectura. Cada uno fija motor, voz sugerida, prosodia y entregables. */
export const READ_PRESETS = [
  {
    id: 'audiolibro',
    name: 'Audiolibro literario',
    icon: 'book',
    tone: '#22d3ee',
    desc: 'Novela y ensayo: ritmo lento, pausas largas entre parrafos y M4B con capitulos.',
    engine: 'kokoro',
    voice: 'kokoro-em_alex',
    speed: 0.96,
    pitch: 0,
    chunk: 320,
    pause: 750,
    emotion: 'narrativo',
    lufs: '-19 LUFS',
    delivery: 'WAV · MP3 · M4B · SRT',
    note: 'Pasada 1 con Piper, pasada 2 con Kokoro: 8 h de audio en 24 min de borrador.',
  },
  {
    id: 'cuento',
    name: 'Cuento infantil',
    icon: 'sparkles',
    tone: '#a78bfa',
    desc: 'Modulacion expresiva, personajes diferenciados y pausas para respirar la escena.',
    engine: 'kokoro',
    voice: 'kokoro-ef_dora',
    speed: 0.92,
    pitch: 1,
    chunk: 240,
    pause: 1000,
    emotion: 'calido',
    lufs: '-18 LUFS',
    delivery: 'WAV · MP3',
    note: 'Sugiere elenco de narrador + 2 a 4 personajes con voice lock.',
  },
  {
    id: 'noticias',
    name: 'Boletin de noticias',
    icon: 'newspaper',
    tone: '#fb7185',
    desc: 'Ritmo agil y diccion periodistica; glosario obligatorio para siglas y cifras.',
    engine: 'piper',
    voice: 'piper-es_ES-miro-high',
    speed: 1.06,
    pitch: 0,
    chunk: 180,
    pause: 200,
    emotion: 'informativo',
    lufs: '-16 LUFS',
    delivery: 'WAV · MP3 · SRT',
    note: 'Avisa si un numero se leyo como cifra y no normalizado.',
  },
  {
    id: 'elearning',
    name: 'Leccion e-learning',
    icon: 'graduation',
    tone: '#34d399',
    desc: 'Claridad didactica, bloques cortos y subtitulos sincronizados por bloque.',
    engine: 'piper',
    voice: 'piper-es_MX-claude-high',
    speed: 1.02,
    pitch: 0,
    chunk: 260,
    pause: 350,
    emotion: 'explicativo',
    lufs: '-16 LUFS',
    delivery: 'WAV · MP3 · SRT · CSV',
    note: 'Cada bloque expone su duracion exacta para el SRT.',
  },
  {
    id: 'documental',
    name: 'Documental',
    icon: 'film',
    tone: '#38bdf8',
    desc: 'Autoridad serena, frases largas y silencios que sostienen la imagen.',
    engine: 'styletts2',
    voice: 'styletts2-styletts2_es_cronista',
    speed: 0.98,
    pitch: -0.5,
    chunk: 300,
    pause: 600,
    emotion: 'solemne',
    lufs: '-18 LUFS',
    delivery: 'WAV · MP3 · SRT',
    note: 'Prosodia expresiva de StyleTTS 2 para narracion de largo formato.',
  },
  {
    id: 'poesia',
    name: 'Poesia y recital',
    icon: 'heart',
    tone: '#c084fc',
    desc: 'Fraseo por verso, silencios largos y respiracion audible.',
    engine: 'kokoro',
    voice: 'kokoro-em_santa',
    speed: 0.88,
    pitch: -1,
    chunk: 160,
    pause: 1200,
    emotion: 'intimo',
    lufs: '-20 LUFS',
    delivery: 'WAV · MP3',
    note: 'Respeta el salto de verso como pausa, no como punto.',
  },
  {
    id: 'meditacion',
    name: 'Meditacion guiada',
    icon: 'heart',
    tone: '#34d399',
    desc: 'Volumen bajo, pausas de 2 a 4 segundos y sin clipping.',
    engine: 'cosyvoice',
    voice: 'cosy-cosy_instruct_tts',
    speed: 0.86,
    pitch: -1,
    chunk: 200,
    pause: 2500,
    emotion: 'susurro',
    lufs: '-21 LUFS',
    delivery: 'WAV · MP3 largo',
    note: 'Usa instruct prompt: susurro intimo con sibilantes largas.',
  },
  {
    id: 'conferencia',
    name: 'Conferencia y clase',
    icon: 'users',
    tone: '#fbbf24',
    desc: 'Ponencia en secciones, cifras normalizadas y subtitulos.',
    engine: 'kokoro',
    voice: 'qwen3-qwen3_es_clara',
    speed: 0.98,
    pitch: 0,
    chunk: 300,
    pause: 500,
    emotion: 'explicativo',
    lufs: '-18 LUFS',
    delivery: 'WAV · MP3 · SRT',
    note: 'Detecta bloques largos y cifras sin normalizar.',
  },
  {
    id: 'podcast',
    name: 'Podcast monologo',
    icon: 'podcast',
    tone: '#fb7185',
    desc: 'Conversacional, cercano al microfono y con turnos marcados.',
    engine: 'kokoro',
    voice: 'kokoro-ef_dora',
    speed: 1.04,
    pitch: 0,
    chunk: 220,
    pause: 250,
    emotion: 'conversacional',
    lufs: '-16 LUFS',
    delivery: 'WAV · MP3',
    note: 'Pistas separadas por rol listas para mezcla con ducking.',
  },
  {
    id: 'accesible',
    name: 'Lectura accesible',
    icon: 'list',
    tone: '#a78bfa',
    desc: 'Texto largo en voz clara, velocidad moderada y pausas generosas.',
    engine: 'piper',
    voice: 'piper-es_ES-davefx-medium',
    speed: 0.94,
    pitch: 0,
    chunk: 200,
    pause: 450,
    emotion: 'neutro',
    lufs: '-19 LUFS',
    delivery: 'WAV · MP3 · SRT',
    note: 'Pensado para fatiga auditiva baja y comprension alta.',
  },
  {
    id: 'radio',
    name: 'Locucion de radio',
    icon: 'radio',
    tone: '#f0b34a',
    desc: 'Duracion exacta con fit-to-duration dentro de mas o menos 12 por ciento.',
    engine: 'piper',
    voice: 'piper-es_AR-daniela-high',
    speed: 1.08,
    pitch: 0.5,
    chunk: 140,
    pause: 120,
    emotion: 'energico',
    lufs: '-16 LUFS · TP -1',
    delivery: 'WAV 48k · MP3 15/30/60 s',
    note: 'Si no cabe en el objetivo, propone recorte en lugar de forzar.',
  },
  {
    id: 'ivr',
    name: 'Telefonia e IVR',
    icon: 'phone',
    tone: '#38bdf8',
    desc: 'Frases cortas, diccion perfecta y salida mono a 16 kHz.',
    engine: 'piper',
    voice: 'piper-es_ES-carlfm-x_low',
    speed: 1.05,
    pitch: 0,
    chunk: 120,
    pause: 150,
    emotion: 'neutro',
    lufs: '-23 LUFS mono',
    delivery: 'WAV 8/16 kHz mono',
    note: 'Longitud de prompt acotada y verificada antes de exportar.',
  },
];

export const readPresetById = (id) => READ_PRESETS.find((preset) => preset.id === id) || READ_PRESETS[0];

/** Formatos de documento aceptados por el importador real. */
export const DOC_FORMATS = [
  { id: 'pdf', label: 'PDF', hint: 'extrae texto por capas; revisa las paginas escaneadas' },
  { id: 'epub', label: 'EPUB', hint: 'capitulos por spine, sin imagenes' },
  { id: 'txt', label: 'TXT', hint: 'plano UTF-8, respeta saltos de linea' },
  { id: 'docx', label: 'DOCX', hint: 'parrafos y estilos de titulo' },
  { id: 'md', label: 'Markdown', hint: 'encabezados como capitulos' },
  { id: 'srt', label: 'SRT', hint: 'cada cue es un bloque con timecode' },
];

/** Documentos simulados para la bandeja de importacion. */
export const DOC_EXAMPLES = [
  { id: 'doc-1', name: 'Patagonia_Capitulo_07.pdf', format: 'pdf', pages: 24, chars: 38420, status: 'listo' },
  { id: 'doc-2', name: 'Curso_Ventas_B2B.epub', format: 'epub', pages: 118, chars: 210900, status: 'listo' },
  { id: 'doc-3', name: 'notas_voz.txt', format: 'txt', pages: 0, chars: 8400, status: 'listo' },
  { id: 'doc-4', name: 'guion_spot_30s.docx', format: 'docx', pages: 1, chars: 410, status: 'listo' },
];

// ---------------------------------------------------------------------------
// Texto de ejemplo: se compone a partir de parrafos reales para llegar a 12.000
// caracteres sin arrastrar un literal gigante en el repositorio.
// ---------------------------------------------------------------------------
const PARAGRAPHS = [
  'El viento no traia nada aquella manana: ni olor a mar, ni polvo de camino. Solo un silencio ancho, como si el valle hubiera decidido contener la respiracion durante unas horas mas.',
  'Elena bajo del jeep y dejo la puerta abierta, porque sabia que volveria pronto. Llevaba once anos sin recorrer esa ruta y seis sin escuchar la advertencia que le habia hecho el viejo en el almacen.',
  'A lo lejos, el rio dibujaba una cicatriz de plata sobre la estepa. Los perros del puesto de gasolina ladraron una sola vez y se callaron, como si alguien les hubiera pedido discrecion.',
  'Hay lugares que recuerdan por nosotros, penso Elena mientras abria el cuaderno por la pagina marcada. Era su propia letra, pero no recordaba haber escrito aquella primera frase.',
  'En el kilometro treinta y ocho hay un desvio sin senal que nadie repara. La primera vez lo paso de noche y no lo vio; la segunda, lo estaba esperando, con la misma lata oxidada en la puerta.',
  'Dentro olia a cuero viejo y a gasolina, y sobre la mesa habia dos tazas. Una de ellas estaba todavia tibia. Elena se sento despacio, sin quitarse el abrigo, y espero sin mirar el reloj.',
  'Al otro lado de la ventana, el paisaje parecia no haber cambiado nunca. Pero los alambrados estaban nuevos, y eso significaba que alguien invertia, que alguien contaba con quedarse.',
  'A las once y cuarto llego un camion con las luces apagadas. El conductor no bajo: dejo un sobre en el umbral y se marcho en retroceso, con una paciencia que solo se tiene cuando se conoce el terreno.',
  'El sobre no tenia remitente, solo un sello de la provincia y una fecha borrada. Dentro habia un plano del valle dibujado a mano, con tres cruces rojas y una nota al margen escrita a lapiz.',
  'Cada cruz coincidia con un punto que su padre habia marcado en los anos setenta. Elena fotografia el plano y lo envio por satelite, aunque sabia que no habria cobertura hasta el amanecer.',
  'El sendero estaba cerrado por un alambre que alguien corto y volvio a atar. A mitad de camino encontro huellas de botas recientes, talla grande. No eran las suyas. No eran las de nadie que recordara.',
  'En la cima, la cruz roja resulto ser una antena de radio envuelta en tela. Alguien habia montado una red de escucha donde antes solo habia pasto, y el cable seguia caliente bajo sus dedos.',
  'Bajo la antena habia una caja de metal con un candado de combinacion. La combinacion era la fecha de nacimiento de su padre, y eso la hizo reir en voz alta, sola, contra el viento.',
  'Dentro, treinta y un cuadernos identicos al suyo, todos con la misma letra. Todos empezaban con la misma frase, y ninguno tenia firma. El ultimo estaba en blanco salvo por una linea: ahora te toca a ti.',
  'Elena cerro la caja, la entero de tierra y volvio a bajar sin mirar atras. En el almacen, la segunda taza ya estaba fria. Sobre el mantel, alguien habia dejado una llave pequena con una etiqueta.',
  'La etiqueta decia sur, con una letra que ella reconocio de inmediato porque era la suya, escrita muchos anos antes, cuando todavia creia que las palabras podian cambiarlo todo.',
  'El silencio del valle no era un vacio: era una forma de escuchar. Eso lo habia aprendido de nina, sentada en el umbral del almacen, mientras su padre anotaba en un cuaderno las horas del viento.',
  'Ahora las anotaba ella, con la misma calma y la misma letra, y por primera vez entendio que el cuaderno no era un diario sino una forma de medir el tiempo que uno decide quedarse.',
];

/** Devuelve un texto de ejemplo de `limit` caracteres aproximados, sin cortar palabras. */
export function sampleText(limit = TEXT_LIMIT) {
  const out = [];
  let length = 0;
  let index = 0;
  while (length < limit) {
    const paragraph = PARAGRAPHS[index % PARAGRAPHS.length];
    out.push(paragraph);
    length += paragraph.length + 2;
    index += 1;
  }
  let text = out.join('\n\n');
  if (text.length > limit) {
    const cut = text.lastIndexOf(' ', limit);
    text = `${text.slice(0, cut > 0 ? cut : limit)}...`;
  }
  return text;
}

/** Estimacion de tiempo de render con los RTF medidos, igual que el estimador real. */
export function estimateRead(chars, rtf, chunks) {
  const seconds = Math.max(1, Math.round((chars / 14.5) * rtf));
  const perChunk = chunks > 0 ? seconds / chunks : 0;
  return { seconds, perChunk };
}
