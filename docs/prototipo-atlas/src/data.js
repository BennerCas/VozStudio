// VozStudio Atlas - datos simulados del prototipo.
// Todo determinista: misma semilla, mismo estado en cada arranque.

export const ICONS = {
  wave: '<path d="M2 12h2.5l2-6 3 12 3-9 2.5 4H22"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  sparkles: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8zM19 3l.6 1.7L21 5.4l-1.4.6L19 8l-.6-1.9L17 5.4l1.4-.6z"/>',
  sliders: '<path d="M4 6h5m4 0h7M9 3v6M4 18h9m4 0h3M17 15v6M4 12h2m4 0h10M10 9v6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="2.4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v3h16v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 14l3-4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 4h-3a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z"/>',
  radio: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  graduation: '<path d="m3 9 9-4 9 4-9 4z"/><path d="M7 11v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5"/>',
  podcast: '<rect x="9" y="3" width="6" height="9" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M8 21h8M12 18v3"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6M18 14.6c2 .8 3.4 2.6 3.4 5.4"/>',
  heart: '<path d="M12 20s-7-4.3-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.5C19 15.7 12 20 12 20z"/>',
  phone: '<path d="M6 3h4l1.5 4-2.3 1.7a12 12 0 0 0 6.1 6.1L17 12.5 21 14v4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3z"/>',
  newspaper: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10M7 16h6M17 9v4"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="10" rx="4"/><path d="M7 10v4M5 12h4M15.5 11h.01M18 13h.01"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6M20 5v6h-6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  wand: '<path d="M15 4l1.2 3.3L19.5 8.5 16.2 9.7 15 13l-1.2-3.3L10.5 8.5 13.8 7.3z"/><path d="M4 20l7-7"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/>',
  waveSmall: '<path d="M4 12h3l2-5 3 10 3-7 2 3h3"/>',
};

/* --------------------------------- motores -------------------------------- */
export const ENGINES = [
  {
    id: 'piper',
    name: 'Piper VITS',
    role: 'Borrador y volumen',
    license: 'MIT',
    commercial: true,
    rtf: 0.05,
    sr: 22050,
    voices: 12,
    accent: 'ES · MX · AR',
    note: '25x mas rápido que Kokoro; prosodia plana',
    available: true,
  },
  {
    id: 'kokoro',
    name: 'Kokoro-82M',
    role: 'Locución final',
    license: 'Apache-2.0',
    commercial: true,
    rtf: 0.285,
    sr: 24000,
    voices: 5,
    accent: 'LATAM neutro',
    note: 'Calidad 24 kHz y mezclas vectoriales',
    available: true,
  },
  {
    id: 'mms',
    name: 'Meta MMS-TTS',
    role: 'Respaldo ligero',
    license: 'CC-BY-NC-4.0',
    commercial: false,
    rtf: 0.383,
    sr: 16000,
    voices: 1,
    accent: 'ES neutro',
    note: 'Siempre disponible; solo uso personal',
    available: true,
  },
  {
    id: 'styletts2',
    name: 'StyleTTS 2 BSC-LT',
    role: 'Narración expresiva',
    license: 'Apache-2.0',
    commercial: true,
    rtf: 0.22,
    sr: 24000,
    voices: 3,
    accent: 'ES',
    note: 'Prosodia expresiva para audiolibro',
    available: true,
  },
  {
    id: 'qwen3_tts',
    name: 'Qwen3 VoiceDesign',
    role: 'Casting por descripción',
    license: 'Apache-2.0',
    commercial: true,
    rtf: 0.9,
    sr: 24000,
    voices: 4,
    accent: 'ES · neutro',
    note: 'Crea voces inexistentes desde texto',
    available: true,
  },
  {
    id: 'cosyvoice',
    name: 'CosyVoice 3',
    role: 'Clonación + estilo',
    license: 'Apache-2.0',
    commercial: true,
    rtf: 0.7,
    sr: 24000,
    voices: 4,
    accent: 'ES · multi',
    note: 'Zero-shot con control de estilo',
    available: true,
  },
  {
    id: 'f5_spanish',
    name: 'F5-TTS Spanish',
    role: 'Clonación multiacento',
    license: 'MIT',
    commercial: true,
    rtf: 0.65,
    sr: 24000,
    voices: 3,
    accent: 'ES · MX · AR',
    note: '218 h de español multiacento',
    available: true,
  },
  {
    id: 'xtts_v2',
    name: 'Coqui XTTS-v2',
    role: 'Clonación de respaldo',
    license: 'CPML (personal)',
    commercial: false,
    rtf: 0.8,
    sr: 24000,
    voices: 1,
    accent: 'ES',
    note: 'Licencia restrictiva; no comercial',
    available: false,
  },
];

export const engineById = (id) => ENGINES.find((e) => e.id === id);

/* --------------------------------- recetas -------------------------------- */
export const RECIPES = [
  {
    id: 'audiolibro',
    name: 'Audiolibro',
    icon: 'book',
    tone: '#22d3ee',
    desc: 'Capitulos por parrafo, narrador estable y un M4B con marcas de capitulo.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 0.96,
    pause: '750 ms',
    lufs: '-19 LUFS',
    delivery: 'WAV · MP3 · M4B · SRT',
    qa: 'Cobertura y duración por bloque',
    structure: 'Capitulo / parrafo',
    cast: '1 narrador + personajes',
    commercial: true,
  },
  {
    id: 'cuentos',
    name: 'Narrador de cuentos',
    icon: 'sparkles',
    tone: '#a78bfa',
    desc: 'Escenas con varios personajes y consistencia de timbre entre escenas.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 0.92,
    pause: '1.000 ms',
    lufs: '-18 LUFS',
    delivery: 'WAV · MP3',
    qa: 'Consistencia de voz por personaje',
    structure: 'Escena',
    cast: 'Narrador + 2-4 personajes',
    commercial: true,
  },
  {
    id: 'elearning',
    name: 'E-learning',
    icon: 'graduation',
    tone: '#34d399',
    desc: 'Lecciones sincronizadas con vídeo: cues ajustados a su hueco real.',
    engine: 'piper',
    draft: 'piper',
    speed: 1.02,
    pause: '350 ms',
    lufs: '-16 LUFS',
    delivery: 'WAV · MP3 · SRT · CSV',
    qa: 'Duración por lección y glosario',
    structure: 'Lección / paso',
    cast: 'Instructor (+ alumno)',
    commercial: true,
  },
  {
    id: 'podcast',
    name: 'Podcast 2 voces',
    icon: 'podcast',
    tone: '#fb7185',
    desc: 'Diálogo por turnos con pistas separadas y mezcla final con ducking.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 1.04,
    pause: '250 ms',
    lufs: '-16 LUFS',
    delivery: 'WAV mezclado + pistas',
    qa: 'Solapamiento y cambios de turno',
    structure: 'Bloque de diálogo',
    cast: 'Host A + Host B',
    commercial: true,
  },
  {
    id: 'radio',
    name: 'Locución de radio',
    icon: 'radio',
    tone: '#fbbf24',
    desc: 'Spot con duración exacta: el sistema ajusta velocidad para que quepa.',
    engine: 'piper',
    draft: 'piper',
    speed: 1.08,
    pause: '120 ms',
    lufs: '-16 LUFS · TP -1',
    delivery: 'WAV 48k + MP3 15/30/60 s',
    qa: 'Duración exacta y fit-to-duration',
    structure: 'Frase / versión',
    cast: '1 locutor',
    commercial: true,
  },
  {
    id: 'conferencia',
    name: 'Conferencia',
    icon: 'users',
    tone: '#38bdf8',
    desc: 'Ponencia larga en secciones, con subtitulos y pausas amplias.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 0.98,
    pause: '500 ms',
    lufs: '-18 LUFS',
    delivery: 'WAV · MP3 · SRT',
    qa: 'Bloques largos y cifras normalizadas',
    structure: 'Sección',
    cast: '1 ponente',
    commercial: true,
  },
  {
    id: 'entrevista',
    name: 'Entrevista',
    icon: 'mic',
    tone: '#c084fc',
    desc: 'Preguntas y respuestas con pausas naturales y pistas separadas.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 1.0,
    pause: '400 ms',
    lufs: '-17 LUFS',
    delivery: 'WAV mezclado + pistas',
    qa: 'Turnos y silencios',
    structure: 'Pregunta / respuesta',
    cast: 'Entrevistador + invitado',
    commercial: true,
  },
  {
    id: 'publicidad',
    name: 'Publicidad multi-versión',
    icon: 'target',
    tone: '#f0b34a',
    desc: 'Tres versiones A/B/C con el mismo mensaje y control de duración.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 1.05,
    pause: '100 ms',
    lufs: '-16 LUFS',
    delivery: '3 versiones + informe',
    qa: 'Todas caben en el objetivo',
    structure: 'Versión',
    cast: '1-2 voces',
    commercial: true,
  },
  {
    id: 'audiodescripcion',
    name: 'Audiodescripción',
    icon: 'film',
    tone: '#22d3ee',
    desc: 'Descripción de escenas ajustada al hueco entre diálogos.',
    engine: 'kokoro',
    draft: 'piper',
    speed: 0.98,
    pause: 'variable',
    lufs: '-20 LUFS',
    delivery: 'WAV + SRT/VTT',
    qa: 'Ajuste al hueco disponible',
    structure: 'Escena con timecode',
    cast: '1 narrador',
    commercial: true,
  },
  {
    id: 'doblaje',
    name: 'Doblaje sobre SRT',
    icon: 'layers',
    tone: '#8b9dff',
    desc: 'Cada cue se ajusta a su duración original sin salirse del limite.',
    engine: 'f5_spanish',
    draft: 'piper',
    speed: 1.0,
    pause: '0 ms',
    lufs: '-20 LUFS',
    delivery: 'WAV por cue + SRT re-timing',
    qa: 'Fit-to-duration por cue',
    structure: 'Cue de subtitulo',
    cast: 'Elenco por personaje',
    commercial: true,
  },
  {
    id: 'ivr',
    name: 'IVR / telefonia',
    icon: 'phone',
    tone: '#94a3b8',
    desc: 'Prompts de menu en 8 kHz mono, listos para la centralita.',
    engine: 'piper',
    draft: 'piper',
    speed: 1.05,
    pause: '150 ms',
    lufs: '-23 LUFS mono',
    delivery: 'WAV 8 kHz mono',
    qa: 'Longitud de prompt y formato',
    structure: 'Prompt',
    cast: '1 voz clara',
    commercial: true,
  },
  {
    id: 'meditacion',
    name: 'Meditación y relax',
    icon: 'heart',
    tone: '#5eead4',
    desc: 'Frases cortas con pausas largas reales y voz susurrada.',
    engine: 'cosyvoice',
    draft: 'piper',
    speed: 0.88,
    pause: '2.500 ms',
    lufs: '-21 LUFS',
    delivery: 'WAV · MP3 largo',
    qa: 'Pausas largas y sin clipping',
    structure: 'Frase',
    cast: '1 voz',
    commercial: true,
  },
  {
    id: 'noticias',
    name: 'Noticias / boletin',
    icon: 'newspaper',
    tone: '#f87171',
    desc: 'Boletin con siglas y cifras controladas por glosario obligatorio.',
    engine: 'piper',
    draft: 'piper',
    speed: 1.06,
    pause: '200 ms',
    lufs: '-16 LUFS',
    delivery: 'WAV · MP3 · SRT',
    qa: 'Glosario y normalización',
    structure: 'Noticia',
    cast: '1-2 locutores',
    commercial: true,
  },
  {
    id: 'videojuego',
    name: 'Videojuego / NPC',
    icon: 'gamepad',
    tone: '#4ade80',
    desc: 'Miles de líneas cortas con un ID de archivo por línea.',
    engine: 'piper',
    draft: 'piper',
    speed: 1.0,
    pause: '100 ms',
    lufs: '-18 LUFS',
    delivery: 'WAV por línea con ID',
    qa: 'Nombre de archivo por ID',
    structure: 'Línea',
    cast: 'Elenco completo',
    commercial: true,
  },
];

export const recipeById = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];

/* --------------------------------- elenco --------------------------------- */
export const ROLES = [
  { id: 'narrador', label: 'Narrador', color: '#22d3ee' },
  { id: 'personaje_1', label: 'Personaje 1', color: '#a78bfa' },
  { id: 'personaje_2', label: 'Personaje 2', color: '#fbbf24' },
];

/* -------------------------------- proyectos -------------------------------- */
const blockTexts = {
  '07': [
    'El viento no traia nada aquella mañana: ni olor a mar, ni polvo de camino.',
    'Solo un silencio ancho, como si el valle hubiera decidido contener la respiración.',
    'Elena bajo del jeep y dejo la puerta abierta, porque sabia que volveria pronto.',
    '—No vuelvas por aquí —le habia dicho el viejo—. La ruta del sur se cierra en junio.',
    'Ella llevaba seis anos sin escuchar esa advertencia y once sin obedecerla.',
    'A lo lejos, el rio dibujaba una cicatriz de plata sobre la estepa.',
    'Los perros del puesto de gasolina ladraron una sola vez y se callaron.',
    'Elena abrio el cuaderno por la página marcada y leyo la primera frase.',
    'Era su propia letra, pero no recordaba haberla escrito.',
    '—Hay lugares que recuerdan por nosotros —dijo en voz alta.',
    'Y el viento, que no traia nada, se llevo sus palabras hacia el sur.',
    'En el kilometro treinta y ocho hay un desvio sin señal que nadie repara.',
    'La primera vez lo paso de noche y no lo vio; la segunda, lo estaba esperando.',
    'El almacen seguia en pie, con la misma lata oxidada en la puerta.',
    'Dentro olia a cuero viejo y a gasolina, y sobre la mesa habia dos tazas.',
    'Una de ellas estaba todavía tibia.',
    'Elena se sento despacio, sin quitarse el abrigo, y espero.',
    'Al otro lado de la ventana, el paisaje parecia no haber cambiado nunca.',
    'Pero los alambrados estaban nuevos, y eso significaba que alguien invertia.',
    'A las once y cuarto llego un camion con las luces apagadas.',
    'El conductor no bajo. Dejo un sobre en el umbral y se marcho en retroceso.',
    'Ella lo recogio con dos dedos, como se recoge algo que puede morder.',
  ],
  '08': [
    'El sobre no tenia remitente, solo un sello de la provincia y una fecha borrada.',
    'Dentro habia un plano del valle dibujado a mano, con tres cruces rojas.',
    'Cada cruz coincidia con un punto que su padre habia marcado en los anos setenta.',
    'Elena fotografia el plano y lo envio por satelite, aunque sabia que no habria cobertura.',
    'El mensaje se quedo en la bandeja de salida, esperando un cielo mas limpio.',
    'Mientras tanto, decidio caminar hasta la primera cruz: dos kilometros, cuesta arriba.',
    'El sendero estaba cerrado por un alambre que alguien corto y volvio a atar.',
    'A mitad de camino encontro huellas de botas recientes, talla grande.',
    'No eran las suyas. No eran las de nadie que recordara.',
    'En la cima, la cruz roja resulto ser una antena de radio envuelta en tela.',
    'Alguien habia montado una red de escucha donde antes solo habia pasto.',
    'Elena se agacho y toco el cable: seguia caliente.',
    'Bajo la antena habia una caja de metal con un candado de combinación.',
    'La combinación era la fecha de nacimiento de su padre, y eso la hizo reir.',
    'Dentro, treinta y un cuadernos identicos al suyo, todos con la misma letra.',
    'Todos empezaban con la misma frase, y ninguno tenia firma.',
    'El último estaba en blanco salvo por una línea: "ahora te toca a ti".',
    'Elena cerro la caja, la entero de tierra y volvio a bajar sin mirar atras.',
    'En el almacen, la segunda taza ya estaba fria.',
    'Sobre el mantel, alguien habia dejado una llave pequena con una etiqueta.',
    'La etiqueta decia: "sur".',
  ],
  '05': [
    'Todo relato sobre la Patagonia empieza con una advertencia y termina con una pregunta.',
    'La advertencia no es sobre el frio, aunque el frio sea real.',
    'Es sobre el tiempo, que alli no se mide igual: se acumula.',
    'Los primeros pobladores lo llamaban "el paisaje que espera".',
    'Espera que lo nombres para existir, y cuando lo nombras, te corrige.',
    'En 1912, una expedición cartografio el valle en once días y perdio tres hombres.',
    'El informe oficial dice que fueron victimas de una tormenta.',
    'El diario de uno de ellos dice otra cosa, y esa otra cosa es un silencio de seis palabras.',
    'Las seis palabras están tachadas, pero la tinta se lee por detras del papel.',
    'Los archivos de la provincia guardan el diario en una caja sin número.',
    'Nadie lo ha consultado desde 1974, y eso también es una forma de respuesta.',
    'Cuando llegue al valle, lo primero que me llamo la atención fue el ruido.',
    'No habia ruido: habia una ausencia muy precisa, como la de un cuarto insonorizado.',
    'Después entendi que el valle no esta vacio, simplemente no habla con quien no escucha.',
    'Aprendi a escuchar durante cuatro inviernos, y solo entonces empece a oir el rio.',
  ],
};

const takeMeta = [
  { engine: 'kokoro', voice: 'em_alex', speed: 0.96, qa: 1 },
  { engine: 'kokoro', voice: 'em_alex', speed: 0.97, qa: 1 },
  { engine: 'piper', voice: 'es_MX-claude-high', speed: 0.98, qa: 1 },
  { engine: 'piper', voice: 'es_AR-daniela-high', speed: 1.0, qa: 2 },
  { engine: 'kokoro', voice: 'ef_dora', speed: 0.94, qa: 1 },
  { engine: 'qwen3_tts', voice: 'qwen3_voice_design', speed: 0.9, qa: 3 },
];

// Generador determinista con mezcla previa: evita la correlacion de semillas
// consecutivas que dejaba todos los bloques en el mismo estado.
function seeded(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x21f0aaad) >>> 0;
  s = Math.imul(s ^ (s >>> 15), 0x735a2d97) >>> 0;
  s = (s ^ (s >>> 15)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const charsPerSecond = { piper: 15.4, kokoro: 14.6, mms: 12.6, styletts2: 14.2, qwen3_tts: 13.4, cosyvoice: 13.8, f5_spanish: 14.0 };

function buildTakes(block, seed) {
  const rand = seeded(seed);
  const count = rand() > 0.62 ? 2 : 1;
  const takes = [];
  for (let i = 0; i < count; i += 1) {
    const meta = takeMeta[Math.floor(rand() * takeMeta.length)];
    const sr = engineById(meta.engine).sr;
    const base = block.text.length / (charsPerSecond[meta.engine] || 14);
    const duration = Math.max(0.9, base * (0.94 + rand() * 0.12));
    takes.push({
      id: `${block.id}-t${i + 1}`,
      engine: meta.engine,
      voice: meta.voice,
      speed: meta.speed,
      duration: Math.round(duration * 100) / 100,
      sr,
      rtf: Math.round((engineById(meta.engine).rtf * (0.9 + rand() * 0.2)) * 1000) / 1000,
      createdAt: `${7 - i * 2} min`,
      qa: meta.qa,
    });
  }
  return takes;
}

function buildBlocks(docId, texts, rolePlan) {
  return texts.map((text, index) => {
    const id = `${docId}-${String(index + 1).padStart(3, '0')}`;
    const role = rolePlan(index);
    const rand = seeded(index * 977 + docId.charCodeAt(1) * 31 + 13);
    const roll = rand();
    let state = 'aprobado';
    if (roll > 0.88) state = 'revisar';
    else if (roll > 0.74) state = 'pendiente';
    const takes = buildTakes({ id, text }, index * 7919 + 41);
    const chosen = takes.length - 1;
    return {
      id,
      docId,
      role,
      text,
      state,
      takes,
      chosenTakeId: takes[chosen].id,
      target: null,
      qaIssue:
        state === 'revisar'
          ? roll > 0.94
            ? 'duracion'
            : 'cobertura'
          : null,
    };
  });
}

export const PROJECTS = [
  {
    id: 'patagonia',
    name: 'Patagonia',
    subtitle: 'Audiolibro · 3 capitulos',
    recipeId: 'audiolibro',
    license: 'comercial',
    updated: 'hace 12 min',
    tone: '#22d3ee',
    docs: [
      {
        id: '05',
        title: 'Capitulo 05 - El paisaje que espera',
        words: 3120,
        blocks: buildBlocks('05', blockTexts['05'], (i) => (i % 7 === 5 ? 'personaje_1' : 'narrador')),
      },
      {
        id: '07',
        title: 'Capitulo 07 - La ruta del sur',
        words: 4380,
        blocks: buildBlocks('07', blockTexts['07'], (i) => (i === 3 ? 'personaje_1' : i === 9 ? 'narrador' : 'narrador')),
      },
      {
        id: '08',
        title: 'Capitulo 08 - Treinta y un cuadernos',
        words: 4010,
        blocks: buildBlocks('08', blockTexts['08'], (i) => (i === 16 ? 'personaje_2' : 'narrador')),
      },
    ],
    cast: [
      { role: 'narrador', voiceId: 'kokoro-em_alex', locked: true, blocks: 58 },
      { role: 'personaje_1', voiceId: 'custom-f5-elena', locked: true, blocks: 3 },
      { role: 'personaje_2', voiceId: 'dna-qwen-abuelo', locked: false, blocks: 1 },
    ],
  },
  {
    id: 'curso',
    name: 'Curso Ventas B2B',
    subtitle: 'E-learning · 24 lecciones',
    recipeId: 'elearning',
    license: 'comercial',
    updated: 'ayer',
    tone: '#34d399',
    docs: [],
    cast: [
      { role: 'narrador', voiceId: 'piper-es_ES-miro-high', locked: true, blocks: 0 },
      { role: 'personaje_1', voiceId: null, locked: false, blocks: 0 },
    ],
  },
  {
    id: 'cafe',
    name: 'Café y Estrategia',
    subtitle: 'Podcast · episodio 42',
    recipeId: 'podcast',
    license: 'comercial',
    updated: 'hace 3 días',
    tone: '#fb7185',
    docs: [],
    cast: [
      { role: 'narrador', voiceId: 'kokoro-ef_dora', locked: true, blocks: 0 },
      { role: 'personaje_1', voiceId: 'kokoro-em_santa', locked: true, blocks: 0 },
    ],
  },
  {
    id: 'spot',
    name: 'Spot Lanzamiento',
    subtitle: 'Radio · 30 s · 3 versiones',
    recipeId: 'radio',
    license: 'comercial',
    updated: 'hace 5 días',
    tone: '#fbbf24',
    docs: [],
    cast: [{ role: 'narrador', voiceId: 'piper-es_MX-claude-high', locked: true, blocks: 0 }],
  },
  {
    id: 'cuentos',
    name: 'Cuentos del Sur',
    subtitle: 'Cuentos · 9 escenas',
    recipeId: 'cuentos',
    license: 'personal',
    updated: 'hace 1 semana',
    tone: '#a78bfa',
    docs: [],
    cast: [
      { role: 'narrador', voiceId: 'kokoro-ef_dora', locked: true, blocks: 0 },
      { role: 'personaje_1', voiceId: 'dna-qwen-abuelo', locked: false, blocks: 0 },
    ],
  },
];

export const projectById = (id) => PROJECTS.find((p) => p.id === id) || PROJECTS[0];

/* ---------------------------------- voces --------------------------------- */
export const VOICES = [
  { id: 'kokoro-em_alex', name: 'Alex Neural', engine: 'kokoro', origin: 'nativa', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['narracion', 'documental'], consent: null, uses: 61 },
  { id: 'kokoro-ef_dora', name: 'Dora Neural', engine: 'kokoro', origin: 'nativa', region: 'LATAM', gender: 'FEM', sr: 24000, quality: 'Studio', tags: ['calida', 'conversacional'], consent: null, uses: 43 },
  { id: 'kokoro-em_santa', name: 'Santa Neural', engine: 'kokoro', origin: 'nativa', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'Studio', tags: ['grave', 'teatro'], consent: null, uses: 12 },
  { id: 'kokoro-blend-editorial', name: 'Mezcla Editorial', engine: 'kokoro', origin: 'mezcla', region: 'LATAM', gender: 'MIX', sr: 24000, quality: 'Studio', tags: ['70% Dora', '30% Alex'], consent: null, uses: 8 },
  { id: 'piper-es_MX-claude-high', name: 'Claude MX', engine: 'piper', origin: 'nativa', region: 'MX', gender: 'MASC', sr: 22050, quality: 'Alta', tags: ['rapida', 'borrador'], consent: null, uses: 96 },
  { id: 'piper-es_AR-daniela-high', name: 'Daniela AR', engine: 'piper', origin: 'nativa', region: 'AR', gender: 'FEM', sr: 22050, quality: 'Alta', tags: ['rioplatense'], consent: null, uses: 21 },
  { id: 'piper-es_ES-miro-high', name: 'Miro ES', engine: 'piper', origin: 'nativa', region: 'ES', gender: 'MASC', sr: 22050, quality: 'Alta', tags: ['castellano'], consent: null, uses: 17 },
  { id: 'custom-f5-elena', name: 'Elena (voz del autor)', engine: 'f5_spanish', origin: 'clonada', region: 'AR', gender: 'FEM', sr: 24000, quality: 'Clon', tags: ['referencia 9.2 s', 'MIT'], consent: { holder: 'Elena R.', kind: 'consentimiento firmado', date: '2026-10-14', scope: 'comercial' }, uses: 3 },
  { id: 'dna-qwen-abuelo', name: 'Abuelo del sur', engine: 'qwen3_tts', origin: 'disenada', region: 'LATAM', gender: 'MASC', sr: 24000, quality: 'DNA', tags: ['gravedad serena', 'pausado'], consent: { holder: 'Voz sintetica', kind: 'diseno propio', date: '2026-10-29', scope: 'comercial' }, uses: 1 },
  { id: 'cosy-instruct-nova', name: 'Nova Instruct', engine: 'cosyvoice', origin: 'disenada', region: 'ES', gender: 'FEM', sr: 24000, quality: 'DNA', tags: ['susurro', 'intimo'], consent: { holder: 'Voz sintetica', kind: 'diseno propio', date: '2026-09-02', scope: 'personal' }, uses: 0 },
  { id: 'mms-esp', name: 'MMS ES', engine: 'mms', origin: 'nativa', region: 'ES', gender: 'MIX', sr: 16000, quality: 'Ligera', tags: ['respaldo', 'no comercial'], consent: null, uses: 4 },
];

export const voiceById = (id) => VOICES.find((v) => v.id === id);

/* ------------------------------ presets cliente --------------------------- */
export const CLIENT_PRESETS = [
  { id: 'cp-aurea', client: 'Aurea Seguros', recipe: 'elearning', voice: 'piper-es_ES-miro-high', tone: 'institucional', owner: 'Marta (cliente)', updated: '2026-10-30' },
  { id: 'cp-norte', client: 'Norte Mineria', recipe: 'noticias', voice: 'piper-es_MX-claude-high', tone: 'boletin', owner: 'RRPP Norte', updated: '2026-10-21' },
  { id: 'cp-pampa', client: 'Editorial Pampa', recipe: 'audiolibro', voice: 'kokoro-em_alex', tone: 'literario', owner: 'Elena R.', updated: '2026-10-14' },
  { id: 'cp-radio', client: 'Radio Sur 99.3', recipe: 'radio', voice: 'piper-es_AR-daniela-high', tone: 'energico', owner: 'Producción', updated: '2026-09-28' },
];

/* --------------------------------- glosario -------------------------------- */
export const GLOSSARY = [
  { term: 'IA', speak: 'inteligencia artificial', scope: 'todos' },
  { term: 'API', speak: 'a pe i', scope: 'todos' },
  { term: 'B2B', speak: 'be a be', scope: 'Curso Ventas B2B' },
  { term: 'LATAM', speak: 'latinoamerica', scope: 'todos' },
  { term: '2026', speak: 'dos mil veintiseis', scope: 'todos' },
  { term: 'SaaS', speak: 'saas', scope: 'Curso Ventas B2B' },
];

/* ---------------------------------- lotes --------------------------------- */
export const BATCH_JOB = {
  name: 'Curso Ventas B2B · lote 1',
  recipe: 'elearning',
  engine: 'piper',
  rows: [
    { id: 'l01', title: '01 - Bienvenida', state: 'ok', duration: '2:14', note: 'SRT generado' },
    { id: 'l02', title: '02 - Que es B2B', state: 'ok', duration: '3:41', note: 'SRT generado' },
    { id: 'l03', title: '03 - El cliente', state: 'ok', duration: '4:08', note: 'SRT generado' },
    { id: 'l04', title: '04 - Descubrimiento', state: 'revisar', duration: '5:02', note: 'cobertura 91 % - 2 terminos' },
    { id: 'l05', title: '05 - Objeciones', state: 'ejecutando', duration: '—', note: 'bloque 12 de 38' },
    { id: 'l06', title: '06 - Cierre', state: 'pendiente', duration: '—', note: 'en cola' },
    { id: 'l07', title: '07 - Seguimiento', state: 'pendiente', duration: '—', note: 'en cola' },
    { id: 'l08', title: '08 - KPIs', state: 'error', duration: '—', note: 'falta runtime .runtimes/f5-tts' },
  ],
};

/* ---------------------------------- cola ---------------------------------- */
export const INITIAL_JOBS = [
  {
    id: 'job-1',
    kind: 'render',
    title: 'Capitulo 07 · 66 bloques',
    detail: 'Piper · borrador',
    state: 'pendiente',
    progress: 0,
    total: 66,
    eta: '2 min 11 s',
    steps: 0,
  },
];
