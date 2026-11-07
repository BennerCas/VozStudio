import { useEffect, useMemo, useRef, useState } from "react"
import { studioApi } from "./services/api"
import { FALLBACK_ENGINES, FALLBACK_VOICES_BY_ENGINE } from "./data/fallbackCatalog"
import {
  LAST_PRESET_STORAGE_KEY,
  PENDING_PRESET_STORAGE_KEY,
  PRESET_COLLECTIONS,
  STUDIO_PRESETS,
  type PresetCategory,
  type PresetCollection,
  type StudioPreset,
} from "./data/presetCatalog"
import type { EngineInfo, LibraryItem, VoiceInfo } from "./types/tts"

type IconName = "wave" | "home" | "folder" | "mic" | "layers" | "sparkles" | "sliders" | "search" | "plus" | "play" | "pause" | "arrow" | "clock" | "more" | "check" | "upload" | "settings" | "bell" | "chevron" | "wand" | "copy" | "trash" | "volume" | "refresh"

const paths: Record<IconName, React.ReactNode> = {
  wave: (
    <>
      <path d="M4 12h2m2-5v10m4-13v16m4-12v8m4-6v4" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6h7l2 2h9v11H3z" />
    </>
  ),
  mic: (
    <>
      <rect x="8" y="3" width="8" height="13" rx="4" />
      <path d="M5 12a7 7 0 0 0 14 0M12 19v3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9zM5 16l.7 2.3L8 19l-2.3.7L5 22l-.7-2.3L2 19l2.3-.7zM19 3l.7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h5m4 0h7M9 3v6M4 18h9m4 0h3M17 15v6M4 12h2m4 0h10M10 9v6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  play: (
    <>
      <path d="m8 5 11 7-11 7z" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M10 20h4" />
    </>
  ),
  chevron: (
    <>
      <path d="m8 10 4 4 4-4" />
    </>
  ),
  wand: (
    <>
      <path d="m4 20 11-11m-2-3 2-3 1.2 2.8L19 7l-2.8 1.2L15 11zM6 3v3M4.5 4.5h3M19 15v4M17 17h4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </>
  ),
  volume: (
    <>
      <path d="M5 10v4h3l4 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 8A7 7 0 0 1 18.4 6L20 8M4 16l1.6 2A7 7 0 0 0 17.9 16" />
    </>
  ),
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const nav = [
  { label: "Inicio", icon: "home" as IconName },
  { label: "Estudio neural", icon: "wave" as IconName },
  { label: "DNA Design", icon: "sparkles" as IconName },
  { label: "Proyectos", icon: "folder" as IconName },
  { label: "Mis voces", icon: "mic" as IconName, count: 31 },
  { label: "Clonación en lote", icon: "layers" as IconName },
  { label: "Diseño de voz", icon: "sparkles" as IconName },
  { label: "Presets", icon: "sliders" as IconName, count: 40 },
]

const voices = [
  {
    name: "Dora Neural",
    meta: "Cálida · Narrativa",
    color: "#ffb547",
    initials: "DN",
  },
  {
    name: "Alex Studio",
    meta: "Claro · Comercial",
    color: "#8b7cff",
    initials: "AS",
  },
  {
    name: "Santa Épica",
    meta: "Profunda · Cine",
    color: "#f57878",
    initials: "SE",
  },
  {
    name: "Sofía Editorial",
    meta: "Precisa · Audiolibro",
    color: "#37cfa2",
    initials: "SO",
  },
]

const engineCatalog = [
  {
    id: "kokoro",
    short: "KOKORO",
    name: "Kokoro-82M v1.0",
    type: "NEURAL ESTUDIO",
    size: "326 MB",
    license: "Apache-2.0",
    provider: "CPU / DML fallback",
    color: "#24c7d5",
  },
  {
    id: "piper",
    short: "PIPER",
    name: "Piper VITS Regional",
    type: "MULTIDIALECTO",
    size: "77 MB",
    license: "Mixta OSS",
    provider: "CPU 12 hilos",
    color: "#37cfa2",
  },
  {
    id: "mms",
    short: "MMS",
    name: "Meta MMS-TTS Spa",
    type: "ULTRALIGERO",
    size: "58 MB",
    license: "CC-BY-NC-4.0",
    provider: "DirectML / CPU",
    color: "#8b7cff",
  },
  {
    id: "styletts2",
    short: "STYLE",
    name: "StyleTTS 2 BSC-LT",
    type: "NARRACIÓN",
    size: "780 MB",
    license: "Apache-2.0",
    provider: "CPU adaptado",
    color: "#f57878",
  },
  {
    id: "f5_spanish",
    short: "F5",
    name: "F5-TTS Spanish",
    type: "CLONACIÓN CON REFERENCIA",
    size: "1.35 GB",
    license: "CC-BY-NC-4.0",
    provider: "Python 3.11 · CPU nativo",
    color: "#ffb547",
  },
  {
    id: "cosyvoice",
    short: "COSY",
    name: "CosyVoice 3 ONNX",
    type: "ZERO-SHOT LLM",
    size: "2.4 GB",
    license: "Apache-2.0",
    provider: "DirectML aislado",
    color: "#40b7ff",
  },
  {
    id: "xtts_v2",
    short: "XTTS",
    name: "Coqui XTTS-v2",
    type: "CLONACIÓN",
    size: "1.87 GB",
    license: "CPML personal",
    provider: "CPU / PyTorch",
    color: "#d97cff",
  },
  {
    id: "qwen3_tts",
    short: "QWEN",
    name: "Qwen3-TTS 12Hz",
    type: "VOICE DESIGN",
    size: "1.83 GB",
    license: "Apache-2.0",
    provider: "Python 3.12 · CPU nativo",
    color: "#5ad4a5",
  },
]

type StudioVoice = {
  id?: string
  name: string
  region: string
  gender: string
  rate: string
  detail: string
  clone?: boolean
}

const studioVoices: Record<string, StudioVoice[]> = {
  kokoro: [
    {
      name: "Dora Neural",
      region: "LATAM",
      gender: "FEM",
      rate: "24 kHz",
      detail: "Clara, cálida y equilibrada",
    },
    {
      name: "Alex Neural",
      region: "LATAM",
      gender: "MASC",
      rate: "24 kHz",
      detail: "Documental y prensa",
    },
    {
      name: "Santa Neural",
      region: "LATAM",
      gender: "MASC",
      rate: "24 kHz",
      detail: "Grave, teatral y pausada",
    },
    {
      name: "Sofía Editorial",
      region: "LATAM",
      gender: "FEM",
      rate: "24 kHz",
      detail: "Lectura técnica prolongada",
    },
    {
      name: "Mateo Documental",
      region: "LATAM",
      gender: "MASC",
      rate: "24 kHz",
      detail: "Mezcla documental estable",
    },
  ],
  piper: [
    {
      name: "Claude",
      region: "MX",
      gender: "MASC",
      rate: "22 kHz",
      detail: "Mexicana natural de alta nitidez",
    },
    {
      name: "Daniela",
      region: "AR",
      gender: "FEM",
      rate: "22 kHz",
      detail: "Argentina, expresiva y natural",
    },
    {
      name: "David",
      region: "ES",
      gender: "MASC",
      rate: "22 kHz",
      detail: "Peninsular nítida",
    },
    {
      name: "Elena Sharvard",
      region: "ES",
      gender: "FEM",
      rate: "22 kHz",
      detail: "Corpus acústico balanceado",
    },
    {
      name: "Aldo",
      region: "MX",
      gender: "MASC",
      rate: "22 kHz",
      detail: "Lectura informativa",
    },
    {
      name: "Carlos Ligero",
      region: "ES",
      gender: "MASC",
      rate: "16 kHz",
      detail: "Respuesta instantánea",
    },
    {
      name: "Álvaro Sharvard",
      region: "ES",
      gender: "MASC",
      rate: "22 kHz",
      detail: "Corpus acústico balanceado",
    },
    {
      name: "Miro",
      region: "ES",
      gender: "MASC",
      rate: "22 kHz",
      detail: "Estudio peninsular",
    },
    {
      name: "Marcos MLS",
      region: "ES",
      gender: "MASC",
      rate: "16 kHz",
      detail: "Lectura MLS ligera",
    },
    {
      name: "Carmen MLS",
      region: "ES",
      gender: "FEM",
      rate: "16 kHz",
      detail: "Lectura MLS ligera",
    },
  ],
  mms: [
    {
      name: "Meta MMS Español",
      region: "LATAM",
      gender: "MASC",
      rate: "16 kHz",
      detail: "VITS ligero de emergencia",
    },
  ],
  styletts2: [
    {
      name: "Clara Narrativa BSC",
      region: "ES",
      gender: "FEM",
      rate: "24 kHz",
      detail: "Cadencia literaria",
    },
    {
      name: "Javier Cronista BSC",
      region: "ES",
      gender: "MASC",
      rate: "24 kHz",
      detail: "Divulgación y audiolibros",
    },
    {
      name: "Irene Estudio BSC",
      region: "ES",
      gender: "FEM",
      rate: "24 kHz",
      detail: "Locución de estudio",
    },
  ],
  f5_spanish: [
    {
      name: "F5 Clonación Hispana Neutra",
      region: "LATAM",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Flow-Matching nativo",
      clone: true,
    },
    {
      name: "F5 Clonación Cono Sur",
      region: "AR",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Referencia peninsular",
      clone: true,
    },
    {
      name: "F5 Clonación Ibérica",
      region: "ES",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Referencia mexicana",
      clone: true,
    },
  ],
  cosyvoice: [
    {
      name: "Nova Cross-Lingual",
      region: "MULTI",
      gender: "FEM",
      rate: "24 kHz",
      detail: "Zero-shot multilingüe",
      clone: true,
    },
    {
      name: "Onyx Cross-Lingual",
      region: "MULTI",
      gender: "MASC",
      rate: "24 kHz",
      detail: "Vocoder HiFT FP32",
      clone: true,
    },
    {
      name: "Clonación Zero-Shot Usuario",
      region: "MULTI",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Prosodia por instrucciones",
      clone: true,
    },
    {
      name: "CosyVoice Instruct-TTS",
      region: "MULTI",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Control semántico de estilo",
      clone: true,
    },
  ],
  xtts_v2: [
    {
      name: "XTTS Clonación Zero-Shot",
      region: "MULTI",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Referencia mínima de 6 s",
      clone: true,
    },
  ],
  qwen3_tts: [
    {
      name: "Clara Qwen3 Narrativa",
      region: "ES",
      gender: "FEM",
      rate: "24 kHz",
      detail: "Articulación castellana",
    },
    {
      name: "Mateo Qwen3 Documental",
      region: "ES",
      gender: "MASC",
      rate: "24 kHz",
      detail: "Cadencia editorial",
    },
    {
      name: "Qwen3 Clonación Zero-Shot",
      region: "MULTI",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Referencia de 3–5 s",
      clone: true,
    },
    {
      name: "Qwen3 1.7B VoiceDesign",
      region: "MULTI",
      gender: "MIX",
      rate: "24 kHz",
      detail: "Diseño de voz sin semilla WAV",
    },
  ],
}

const engineColors = [
  "#24c7d5",
  "#37cfa2",
  "#8b7cff",
  "#f57878",
  "#ffb547",
  "#5ad4a5",
  "#f093fb",
  "#44a3ff",
]

type VisualEngine = (typeof engineCatalog)[number]

function toVisualEngine(engine: EngineInfo, index: number): VisualEngine {
  const fallback = engineCatalog.find((item) => item.id === engine.id)
  return {
    id: engine.id,
    short: fallback?.short ?? engine.id.replaceAll("_", " ").slice(0, 10).toUpperCase(),
    name: engine.name,
    type: engine.category,
    size: `${Math.max(1, Math.round(engine.estimated_mb))} MB`,
    license: engine.license,
    provider: engine.availability_note || "Runtime local",
    color: fallback?.color ?? engineColors[index % engineColors.length],
  }
}

function toStudioVoice(voice: VoiceInfo): StudioVoice {
  return {
    id: voice.id,
    name: voice.name,
    region: voice.region || "MULTI",
    gender: voice.gender || "MIX",
    rate: `${Math.round(voice.sample_rate / 1000) || 24} kHz`,
    detail: voice.description || voice.quality || "Timbre disponible en local",
    clone: Boolean(voice.is_custom || voice.supports_cloning),
  }
}

function libraryDuration(item?: LibraryItem | null) {
  const value = item?.metricas?.duracion_audio_seg
  return typeof value === "number" ? `${value.toFixed(2)} s` : "--"
}

type VoiceCard = {
  id?: string
  name: string
  meta: string
  color: string
  initials: string
  isCustom?: boolean
  engine?: string
}

function toVoiceCard(voice: VoiceInfo, index: number): VoiceCard {
  const initials = voice.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return {
    id: voice.id,
    name: voice.name,
    meta: `${voice.region || "MULTI"} · ${voice.description || voice.quality || "Timbre local"}`,
    color: engineColors[index % engineColors.length],
    initials: initials || "VS",
    isCustom: Boolean(voice.is_custom),
    engine: voice.engine,
  }
}

const projects = [
  {
    name: "Documental Patagonia",
    type: "Documental",
    progress: 72,
    time: "Hace 12 min",
    color: "#00c2d7",
  },
  {
    name: "Campaña Horizonte",
    type: "Publicidad",
    progress: 45,
    time: "Ayer, 18:42",
    color: "#ffb547",
  },
  {
    name: "Audiolibro · Cap. 04",
    type: "Narración",
    progress: 91,
    time: "Ayer, 09:15",
    color: "#8b7cff",
  },
]

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function Waveform({ compact = false }: { compact?: boolean }) {
  const bars = [
    12, 28, 18, 36, 52, 31, 67, 42, 24, 48, 75, 38, 58, 25, 45, 71, 34, 54, 30,
    62, 44, 19, 40, 65, 33, 50, 26, 57, 39, 69, 29, 46, 22, 41, 61, 34, 53, 27,
    44, 32,
  ]
  return (
    <div className={`waveform ${compact ? "compact" : ""}`}>
      {bars.map((height, index) => (
        <span
          key={index}
          style={{
            height: `${compact ? Math.max(7, height * 0.44) : height}%`,
            animationDelay: `${index * 24}ms`,
          }}
        />
      ))}
    </div>
  )
}

function Avatar({
  voice,
  small = false,
}: {
  voice: Pick<VoiceCard, "color" | "initials">
  small?: boolean
}) {
  return (
    <div
      className={`voice-avatar ${small ? "small" : ""}`}
      style={{ "--voice": voice.color } as React.CSSProperties}
    >
      <span>{voice.initials}</span>
      <i />
    </div>
  )
}

function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [playing, setPlaying] = useState(false)
  const [activeVoice, setActiveVoice] = useState(0)
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">ESTUDIO DE PRODUCCIÓN</p>
          <h1>Buenos días, Benner</h1>
          <p className="subtitle">
            Tu espacio de voz está listo. ¿Qué vamos a crear hoy?
          </p>
        </div>
        <button className="primary-btn" onClick={() => onNavigate("Proyectos")}>
          <span className="icon-bubble">
            <Icon name="plus" size={18} />
          </span>
          Nuevo proyecto
        </button>
      </header>

      <section className="quick-grid">
        <button
          className="quick-card cyan"
          onClick={() => onNavigate("Clonación en lote")}
        >
          <span className="quick-icon">
            <Icon name="layers" size={26} />
          </span>
          <span>
            <strong>Clonar voces en lote</strong>
            <small>Procesa hasta 20 muestras a la vez</small>
          </span>
          <Icon name="arrow" />
        </button>
        <button
          className="quick-card violet"
          onClick={() => onNavigate("Diseño de voz")}
        >
          <span className="quick-icon">
            <Icon name="sparkles" size={26} />
          </span>
          <span>
            <strong>Diseñar una voz</strong>
            <small>Crea voces únicas desde una descripción</small>
          </span>
          <Icon name="arrow" />
        </button>
        <button
          className="quick-card amber"
          onClick={() => onNavigate("Presets")}
        >
          <span className="quick-icon">
            <Icon name="sliders" size={26} />
          </span>
          <span>
            <strong>Explorar presets</strong>
            <small>20 configuraciones profesionales</small>
          </span>
          <Icon name="arrow" />
        </button>
      </section>

      <div className="dashboard-grid">
        <section className="panel recent-projects">
          <div className="panel-head">
            <div>
              <p className="eyebrow">TRABAJO RECIENTE</p>
              <h2>Proyectos</h2>
            </div>
            <button
              className="text-btn"
              onClick={() => onNavigate("Proyectos")}
            >
              Ver todos <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="project-list">
            {projects.map((project, index) => (
              <button className="project-row" key={project.name}>
                <div
                  className="project-art"
                  style={{ "--project": project.color } as React.CSSProperties}
                >
                  <Icon name={index === 2 ? "wave" : "folder"} />
                </div>
                <div className="project-info">
                  <strong>{project.name}</strong>
                  <span>
                    {project.type} · {project.time}
                  </span>
                </div>
                <div className="progress-wrap">
                  <span>{project.progress}%</span>
                  <div className="progress">
                    <i
                      style={{
                        width: `${project.progress}%`,
                        background: project.color,
                      }}
                    />
                  </div>
                </div>
                <Icon name="more" />
              </button>
            ))}
          </div>
        </section>

        <section className="panel voice-library">
          <div className="panel-head">
            <div>
              <p className="eyebrow">TU COLECCIÓN</p>
              <h2>Voces guardadas</h2>
            </div>
            <button
              className="icon-btn"
              aria-label="Añadir voz"
              onClick={() => onNavigate("Mis voces")}
            >
              <Icon name="plus" />
            </button>
          </div>
          <div className="voice-stack">
            {voices.map((voice, index) => (
              <div
                className={`voice-row ${
                  activeVoice === index ? "selected" : ""
                }`}
                role="button"
                tabIndex={0}
                key={voice.name}
                onClick={() => setActiveVoice(index)}
                onKeyDown={(event) =>
                  event.key === "Enter" && setActiveVoice(index)
                }
              >
                <Avatar voice={voice} small />
                <span>
                  <strong>{voice.name}</strong>
                  <small>{voice.meta}</small>
                </span>
                <button
                  className="mini-play"
                  onClick={(event) => {
                    event.stopPropagation()
                    setPlaying(!playing)
                  }}
                  aria-label={`Reproducir ${voice.name}`}
                >
                  <Icon
                    name={playing && activeVoice === index ? "pause" : "play"}
                    size={15}
                  />
                </button>
              </div>
            ))}
          </div>
          <button
            className="library-link"
            onClick={() => onNavigate("Mis voces")}
          >
            Abrir biblioteca de voces <Icon name="arrow" size={16} />
          </button>
        </section>
      </div>

      <section className="panel now-playing">
        <div className="now-title">
          <button
            className={`big-play ${playing ? "playing" : ""}`}
            onClick={() => setPlaying(!playing)}
          >
            <Icon name={playing ? "pause" : "play"} size={22} />
          </button>
          <div>
            <span>REPRODUCIENDO AHORA</span>
            <strong>Documental Patagonia · Escena 08</strong>
          </div>
        </div>
        <div className="wave-area">
          <Waveform />
          <div
            className="play-line"
            style={{ left: playing ? "42%" : "18%" }}
          />
        </div>
        <span className="timecode">{playing ? "01:18" : "00:34"} / 03:12</span>
        <div className="playing-voice">
          <Avatar voice={voices[0]} small />
          <span>
            <small>VOZ</small>
            <strong>Dora Neural</strong>
          </span>
        </div>
      </section>
    </>
  )
}

function ProjectsPage() {
  const [items, setItems] = useState(() =>
    loadLocal("vozstudio-projects", projects),
  )
  useEffect(
    () =>
      window.localStorage.setItem("vozstudio-projects", JSON.stringify(items)),
    [items],
  )
  const add = () =>
    setItems([
      ...items,
      {
        name: `Proyecto sin título ${items.length + 1}`,
        type: "Nuevo proyecto",
        progress: 0,
        time: "Ahora",
        color: "#37cfa2",
      },
    ])
  return (
    <Page
      title="Proyectos"
      description="Organiza guiones, voces, versiones y exportaciones en un solo lugar."
      action={
        <button className="primary-btn" onClick={add}>
          <Icon name="plus" size={18} />
          Crear proyecto
        </button>
      }
    >
      <div className="filter-row">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Buscar proyectos..." />
        </div>
        <button className="filter active">Todos</button>
        <button className="filter">Activos</button>
        <button className="filter">Completados</button>
      </div>
      <div className="project-cards">
        {items.map((p, i) => (
          <article className="project-card" key={`${p.name}-${i}`}>
            <div
              className="project-card-top"
              style={{ "--project": p.color } as React.CSSProperties}
            >
              <Icon name="wave" size={30} />
              <span>{p.type}</span>
              <button>
                <Icon name="more" />
              </button>
            </div>
            <div className="project-card-body">
              <h3>{p.name}</h3>
              <p>
                {p.time} · {i % 2 ? "3 voces" : "8 archivos"}
              </p>
              <div className="progress">
                <i style={{ width: `${p.progress}%`, background: p.color }} />
              </div>
              <footer>
                <span>{p.progress}% completado</span>
                <button>
                  <Icon name="arrow" size={17} />
                </button>
              </footer>
            </div>
          </article>
        ))}
      </div>
    </Page>
  )
}

function VoicesPage({
  onNavigate,
  notify,
}: {
  onNavigate: (page: string) => void
  notify: (message: string) => void
}) {
  const [saved, setSaved] = useState<VoiceCard[]>(() =>
    loadLocal("vozstudio-voices", voices),
  )
  const [playingVoice, setPlayingVoice] = useState<number | null>(null)
  const [editingVoice, setEditingVoice] = useState<number | null>(null)
  useEffect(
    () =>
      window.localStorage.setItem("vozstudio-voices", JSON.stringify(saved)),
    [saved],
  )
  useEffect(() => {
    let active = true
    const loadVoices = async () => {
      try {
        const engines = await studioApi.getEngines()
        const groups = await Promise.all(
          engines.map((engine) => studioApi.getVoices(engine.id).catch(() => [])),
        )
        if (active) {
          setSaved(groups.flat().map(toVoiceCard))
        }
      } catch (error) {
        if (active) {
          notify(`No se pudieron cargar las voces locales: ${error instanceof Error ? error.message : "sin conexión"}`)
        }
      }
    }
    void loadVoices()
    return () => {
      active = false
    }
  }, [])

  const removeVoice = async (voice: VoiceCard, index: number) => {
    if (!voice.id || !voice.isCustom) {
      notify("Los timbres nativos se administran desde el motor; solo se eliminan voces personalizadas")
      return
    }
    try {
      await studioApi.deleteCustomVoice(voice.id)
      setSaved((items) => items.filter((_, itemIndex) => itemIndex !== index))
      notify("Voz personalizada eliminada")
    } catch (error) {
      notify(`No se pudo eliminar la voz: ${error instanceof Error ? error.message : "error local"}`)
    }
  }

  const saveVoice = async (voice: VoiceCard, index: number) => {
    if (!voice.id || !voice.isCustom) {
      notify("Los metadatos editables pertenecen a voces clonadas o diseñadas")
      setEditingVoice(null)
      return
    }
    try {
      const [region, description = ""] = voice.meta.split(" · ")
      const updated = await studioApi.updateCustomVoice(voice.id, {
        name: voice.name,
        region,
        description,
      })
      setSaved((items) =>
        items.map((item, itemIndex) =>
          itemIndex === index ? toVoiceCard(updated, index) : item,
        ),
      )
      setEditingVoice(null)
      notify("Metadatos de voz guardados")
    } catch (error) {
      notify(`No se pudieron guardar los metadatos: ${error instanceof Error ? error.message : "error local"}`)
    }
  }
  return (
    <Page
      title="Mis voces"
      description={`${saved.length} voces clonadas y diseñadas, listas para usar en cualquier proyecto.`}
      action={
        <button className="primary-btn" onClick={() => onNavigate("Estudio neural")}>
          <Icon name="plus" size={18} />
          Guardar nueva voz
        </button>
      }
    >
      <div className="filter-row">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Buscar por nombre, idioma o estilo..." />
        </div>
        <button className="filter active">Todas</button>
        <button className="filter">Clonadas</button>
        <button className="filter">Diseñadas</button>
      </div>
      <div className="voice-cards">
        {saved.map((voice, i) => (
          <article className="voice-card" key={`${voice.name}-${i}`}>
            <div className="voice-card-head">
              <Avatar voice={voice} />
              <span className="status-dot">LISTA</span>
              <button
                aria-label={`Eliminar ${voice.name}`}
                onClick={() => void removeVoice(voice, i)}
              >
                <Icon name="trash" />
              </button>
            </div>
            {editingVoice === i ? (
              <div className="voice-edit-form">
                <input
                  value={voice.name}
                  onChange={(event) =>
                    setSaved((items) =>
                      items.map((item, index) =>
                        index === i
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  value={voice.meta}
                  onChange={(event) =>
                    setSaved((items) =>
                      items.map((item, index) =>
                        index === i
                          ? { ...item, meta: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            ) : (
              <>
                <h3>{voice.name}</h3>
                <p>{voice.meta}</p>
              </>
            )}
            <Waveform compact />
            <div className="tag-row">
              <span>ES-LATAM</span>
              <span>24 kHz</span>
            </div>
            <footer>
              <button
                className="outline-btn"
                onClick={() => {
                  setPlayingVoice(playingVoice === i ? null : i)
                  notify("Selecciona este timbre en Estudio neural para generar una muestra real")
                }}
              >
                <Icon name={playingVoice === i ? "pause" : "play"} size={16} />
                {playingVoice === i ? "Pausar" : "Escuchar"}
              </button>
              <button
                className="round-btn"
                aria-label={`Editar ${voice.name}`}
                onClick={() =>
                  editingVoice === i
                    ? void saveVoice(voice, i)
                    : setEditingVoice(i)
                }
              >
                <Icon
                  name={editingVoice === i ? "check" : "settings"}
                  size={17}
                />
              </button>
            </footer>
          </article>
        ))}
      </div>
    </Page>
  )
}

function BatchPage({
  design = false,
  notify,
}: {
  design?: boolean
  notify: (message: string) => void
}) {
  const [running, setRunning] = useState(false)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [completed, setCompleted] = useState(0)
  const [failed, setFailed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const files = batchFiles.length

  const runBatch = async () => {
    if (!files) {
      notify(design ? "Importa un TXT o CSV con una descripción por línea" : "Carga una o más muestras de audio")
      inputRef.current?.click()
      return
    }
    const targetText = window.prompt("Texto objetivo que generará cada voz del lote:")?.trim()
    if (!targetText) {
      notify("El lote necesita un texto objetivo; no se generó ningún audio")
      return
    }
    const referenceText = design
      ? ""
      : window.prompt("Transcripción de las muestras (opcional, mejora la clonación):")?.trim() ?? ""
    setRunning(true)
    setCompleted(0)
    setFailed(0)
    try {
      if (design) {
        const descriptions = (
          await Promise.all(batchFiles.map((file) => file.text()))
        )
          .flatMap((contents) => contents.split(/\r?\n|,/))
          .map((item) => item.trim())
          .filter(Boolean)
        if (!descriptions.length) {
          notify("No se encontraron descripciones utilizables en los archivos importados")
          return
        }
        for (const [index, description] of descriptions.entries()) {
          try {
            await studioApi.synthesizeDna({
              text: targetText,
              engine_id: "qwen3_tts",
              mode: "voice_design",
              voice_design_prompt: description,
              speed: 1,
              temperature: 0.7,
              save_as_custom: true,
              custom_voice_name: `Lote DNA ${index + 1}`,
              custom_voice_region: "ES",
            })
            setCompleted(index + 1)
          } catch {
            setFailed((count) => count + 1)
          }
        }
      } else {
        for (const [index, file] of batchFiles.entries()) {
          try {
            await studioApi.cloneVoice({
              text: targetText,
              engine_id: "f5_spanish",
              voice_id: null,
              reference_text: referenceText,
              speed: 1,
              emotion: null,
              reference_audio: file,
            })
            setCompleted(index + 1)
          } catch {
            setFailed((count) => count + 1)
          }
        }
      }
      notify("Lote finalizado; revisa los resultados en la biblioteca auditada")
    } finally {
      setRunning(false)
    }
  }
  return (
    <Page
      title={design ? "Diseño de voz en lote" : "Clonación en lote"}
      description={
        design
          ? "Genera múltiples variaciones de voz desde descripciones y presets."
          : "Convierte múltiples muestras en voces consistentes y listas para producción."
      }
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={design ? ".txt,.csv,text/plain,text/csv" : "audio/wav,audio/x-wav,audio/mpeg,audio/flac,audio/*"}
        onChange={(event) => {
          const imported = Array.from(event.target.files ?? [])
          setBatchFiles(imported)
          setCompleted(0)
          setFailed(0)
          if (imported.length) notify(`${imported.length} elemento(s) preparado(s) para el lote`)
        }}
      />
      <div className="batch-layout">
        <section className="panel batch-builder">
          <div className="step-head">
            <span>01</span>
            <div>
              <h2>{design ? "Describe las voces" : "Carga tus muestras"}</h2>
              <p>
                {design
                  ? "Una descripción por línea o importa un archivo CSV."
                  : "WAV, MP3 o FLAC · mínimo 15 segundos por voz."}
              </p>
            </div>
          </div>
          <button className="dropzone" onClick={() => inputRef.current?.click()}>
            <span className="drop-icon">
              <Icon name="upload" size={26} />
            </span>
            <strong>
              {design ? "Importar descripciones" : "Arrastra tus archivos aquí"}
            </strong>
            <small>
              o haz clic para explorar · {files} elementos preparados
            </small>
          </button>
          <div className="step-head second">
            <span>02</span>
            <div>
              <h2>Configuración del lote</h2>
              <p>Aplica los mismos estándares de salida a todo el proceso.</p>
            </div>
          </div>
          <div className="settings-grid">
            <label>
              Idioma
              <select>
                <option>Español · LATAM</option>
                <option>Español · España</option>
              </select>
            </label>
            <label>
              Calidad
              <select>
                <option>Estudio · 48 kHz</option>
                <option>Alta · 24 kHz</option>
              </select>
            </label>
            <label>
              Normalización
              <select>
                <option>-16 LUFS · Streaming</option>
                <option>-24 LUFS · Broadcast</option>
              </select>
            </label>
            <label>
              Formato
              <select>
                <option>WAV · 24 bit</option>
                <option>MP3 · 320 kbps</option>
              </select>
            </label>
          </div>
          <button
            className={`run-btn ${running ? "running" : ""}`}
            onClick={() => void runBatch()}
            disabled={running}
          >
            <Icon name={running ? "pause" : design ? "sparkles" : "layers"} />
            {running
              ? `Procesando ${completed}/${files}`
              : `${design ? "Diseñar" : "Clonar"} ${files} voces`}
            <span>{running ? `${completed}/${files}` : "Ejecución local"}</span>
          </button>
        </section>
        <aside className="panel batch-queue">
          <div className="panel-head">
            <div>
              <p className="eyebrow">COLA ACTIVA</p>
              <h2>{files} voces</h2>
            </div>
            <span className="queue-badge">
              {running ? "PROCESANDO" : "PREPARADA"}
            </span>
          </div>
          {batchFiles.slice(0, 6).map((file, i) => (
            <div className="queue-row" key={i}>
              <span
                className={`queue-state ${
                  i < completed ? "done" : i === completed && running ? "active" : ""
                }`}
              >
                {i < completed ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <div>
                <strong>
                  {design ? `Diseño · ${file.name}` : file.name}
                </strong>
                <small>
                  {i < completed ? "Completada" : i === completed && running ? "Procesando…" : "En espera"}
                </small>
              </div>
              <Icon name="more" size={18} />
            </div>
          ))}
          <div className="queue-summary">
            <span>Tiempo estimado</span>
            <strong>{running ? `${completed}/${files} completados` : failed ? `${failed} con error` : "Pendiente"}</strong>
          </div>
        </aside>
      </div>
    </Page>
  )
}

function PresetsPage({
  onNavigate,
  notify,
}: {
  onNavigate: (page: string) => void
  notify: (message: string) => void
}) {
  const categories: Array<"Todos" | PresetCategory> = [
    "Todos",
    "Narración",
    "Comercial",
    "Personajes",
    "Corporativo",
  ]
  const [category, setCategory] = useState<"Todos" | PresetCategory>("Todos")
  const [collection, setCollection] = useState<PresetCollection>("Fundamentos")
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [customPresets, setCustomPresets] = useState<StudioPreset[]>(() =>
    loadLocal<StudioPreset[]>("vozstudio-custom-presets", []),
  )
  const [lastAppliedId, setLastAppliedId] = useState(() =>
    loadLocal<string>(LAST_PRESET_STORAGE_KEY, ""),
  )
  const [selectedPresetId, setSelectedPresetId] = useState(STUDIO_PRESETS[0].id)
  const [draft, setDraft] = useState<StudioPreset>(STUDIO_PRESETS[0])
  const [draftText, setDraftText] = useState(STUDIO_PRESETS[0].script)
  const [draftInstruction, setDraftInstruction] = useState(STUDIO_PRESETS[0].designInstruction)
  const [lastGeneration, setLastGeneration] = useState<LibraryItem | null>(null)
  const [presetVoices, setPresetVoices] = useState<Record<string, VoiceInfo[]>>({})
  const previewAudio = useRef<HTMLAudioElement | null>(null)
  const allPresets = useMemo(() => [...STUDIO_PRESETS, ...customPresets], [customPresets])
  const selectedPreset = allPresets.find((preset) => preset.id === selectedPresetId) ?? allPresets[0]
  const collections = useMemo<PresetCollection[]>(
    () => (customPresets.length ? [...PRESET_COLLECTIONS, "Mis variantes"] : [...PRESET_COLLECTIONS]),
    [customPresets.length],
  )
  const collectionPresets = allPresets.filter((preset) => preset.collection === collection)
  const visiblePresets =
    category === "Todos"
      ? collectionPresets
      : collectionPresets.filter((preset) => preset.category === category)
  const voiceOptions = presetVoices[draft.engineId] ?? []
  const modelOptions = [
    { id: "kokoro", label: "Kokoro ONNX", note: "nativo verificado · 5 voces" },
    { id: "cosyvoice", label: "CosyVoice3 ONNX", note: "nativo verificado · 2 perfiles" },
    { id: "qwen3_tts", label: "Qwen3 VoiceDesign", note: "nativo verificado · diseño por instrucción" },
    { id: "f5_spanish", label: "F5-Spanish", note: "nativo · requiere referencia en Clonación", disabled: true },
  ]

  useEffect(() => () => previewAudio.current?.pause(), [])

  useEffect(() => {
    if (!selectedPreset) return
    setDraft(selectedPreset)
    setDraftText(selectedPreset.script)
    setDraftInstruction(selectedPreset.designInstruction)
  }, [selectedPreset])

  useEffect(() => {
    let active = true
    void studioApi
      .getVoices(draft.engineId)
      .then((voices) => {
        if (active) setPresetVoices((current) => ({ ...current, [draft.engineId]: voices }))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [draft.engineId])

  const persistCustomPresets = (next: StudioPreset[]) => {
    setCustomPresets(next)
    window.localStorage.setItem("vozstudio-custom-presets", JSON.stringify(next))
  }

  const makePresetFromDraft = (): StudioPreset => ({
    ...draft,
    script: draftText.trim() || draft.script,
    designInstruction: draftInstruction.trim() || draft.designInstruction,
  })

  const isFallbackGeneration = (item: LibraryItem) =>
    /fallback| via /i.test(`${item.modelo_origen} ${String(item.contexto?.backend ?? "")}`)

  const playGeneratedAudio = async (item: LibraryItem) => {
    previewAudio.current?.pause()
    const audio = new Audio(item.audio_url)
    audio.volume = 0.86
    previewAudio.current = audio
    try {
      await audio.play()
    } catch {
      // La síntesis se guardó aunque el navegador no autorice la reproducción automática.
    }
  }

  const synthesizeRecipe = async (preset: StudioPreset, text: string, instruction: string) => {
    const item = await studioApi.synthesize({
      text,
      engine_id: preset.engineId,
      voice_id: preset.voiceId,
      speed: preset.speed,
      pitch_semitones: preset.pitch,
      emotion: preset.emotion === "NEUTRO" ? null : preset.emotion.toLowerCase(),
      max_chunk_chars: 520,
      voice_design_prompt: preset.engineId === "qwen3_tts" ? instruction : null,
      instruct_prompt: instruction,
      temperature: 0.7,
    })
    setLastGeneration(item)
    await playGeneratedAudio(item)
    if (isFallbackGeneration(item)) {
      notify(`Audio generado con reserva detectada · revisa procedencia antes de usarlo`)
    } else {
      notify(`WAV nativo generado · ${item.motor} · ${preset.voiceName}`)
    }
    return item
  }

  const applyPreset = (preset: StudioPreset) => {
    window.localStorage.setItem(PENDING_PRESET_STORAGE_KEY, JSON.stringify(preset))
    window.localStorage.setItem(LAST_PRESET_STORAGE_KEY, JSON.stringify(preset.id))
    setLastAppliedId(preset.id)
    onNavigate("Estudio neural")
  }

  const previewPreset = async (preset: StudioPreset) => {
    setPreviewingId(preset.id)
    try {
      await synthesizeRecipe(preset, preset.script, preset.designInstruction)
    } catch (error) {
      notify(
        `No se pudo generar la muestra de ${preset.name}: ${
          error instanceof Error ? error.message : "error local"
        }`,
      )
    } finally {
      setPreviewingId(null)
    }
  }

  const generateFromLab = async () => {
    const recipe = makePresetFromDraft()
    if (!recipe.script.trim()) {
      notify("Escribe el texto que quieres sintetizar")
      return
    }
    setPreviewingId("preset-lab")
    try {
      await synthesizeRecipe(recipe, recipe.script, recipe.designInstruction)
    } catch (error) {
      notify(`No se pudo generar el audio: ${error instanceof Error ? error.message : "error local"}`)
    } finally {
      setPreviewingId(null)
    }
  }

  const duplicateDraft = () => {
    if (customPresets.length >= 20) {
      notify("Mis variantes admite hasta 20 tarjetas para mantener la cuadrícula 5 × 4")
      return
    }
    const base = makePresetFromDraft()
    const id = `custom-${Date.now().toString(36)}`
    const copy: StudioPreset = {
      ...base,
      id,
      name: `${base.name} · variante`,
      collection: "Mis variantes",
    }
    persistCustomPresets([...customPresets, copy])
    setCollection("Mis variantes")
    setCategory("Todos")
    setSelectedPresetId(id)
    notify("Tarjeta duplicada en Mis variantes")
  }

  const atomizeDraft = () => {
    const remaining = 20 - customPresets.length
    if (remaining < 1) {
      notify("Mis variantes ya alcanzó el límite de 20 tarjetas")
      return
    }
    const base = makePresetFromDraft()
    const variants = [
      { name: "Femenina", voiceId: "ef_dora", voiceName: "Dora Neural", speed: Math.max(0.75, base.speed - 0.05), pitch: base.pitch + 0.5, emotion: "CÁLIDO" as const, extra: "Variante femenina adulta: conserva cercanía y brillo moderado." },
      { name: "Masculina", voiceId: "em_alex", voiceName: "Alex Neural", speed: base.speed, pitch: base.pitch - 0.5, emotion: "NARRATIVO" as const, extra: "Variante masculina adulta: conserva peso medio y articulación precisa." },
      { name: "Madura", voiceId: "em_santa", voiceName: "Santa Neural", speed: Math.max(0.75, base.speed - 0.08), pitch: Math.min(base.pitch, -0.5), emotion: "NARRATIVO" as const, extra: "Variante madura: añade gravedad serena sin efectos de eco." },
    ]
      .slice(0, remaining)
      .map((variant, index): StudioPreset => ({
        ...base,
        id: `custom-${Date.now().toString(36)}-${index}`,
        name: `${base.name} · ${variant.name}`,
        collection: "Mis variantes",
        engineId: "kokoro",
        voiceId: variant.voiceId,
        voiceName: variant.voiceName,
        speed: variant.speed,
        pitch: variant.pitch,
        emotion: variant.emotion,
        designInstruction: `${base.designInstruction} ${variant.extra}`,
      }))
    persistCustomPresets([...customPresets, ...variants])
    setCollection("Mis variantes")
    setCategory("Todos")
    setSelectedPresetId(variants[0].id)
    notify(`${variants.length} variantes reales listas para ajustar o sintetizar`)
  }

  const deleteSelectedVariant = () => {
    if (selectedPreset?.collection !== "Mis variantes") return
    const next = customPresets.filter((preset) => preset.id !== selectedPreset.id)
    persistCustomPresets(next)
    setSelectedPresetId(STUDIO_PRESETS[0].id)
    setCollection("Fundamentos")
    notify("Variante eliminada de este equipo")
  }

  return (
    <Page
      title="Presets profesionales"
      description="40 recetas con modelo, voz e instrucción auditables; crea y conserva variantes locales sin perder la vista 16:9."
      action={<span className="preset-ready">40 OPERATIVOS</span>}
    >
      <section className="presets-workspace" aria-label="Catálogo de presets">
        <div className="preset-catalog">
          <div className="preset-toolbar">
            <div className="preset-collection-switch" aria-label="Colecciones de presets">
              {collections.map((item) => {
                const testId = item === "Fundamentos" ? "Fundamentos" : item === "Latino neural" ? "Latino-neural" : "Mis-variantes"
                const count = allPresets.filter((preset) => preset.collection === item).length
                return (
                  <button
                    key={item}
                    data-testid={`preset-collection-${testId}`}
                    className={collection === item ? "active" : ""}
                    onClick={() => {
                      setCollection(item)
                      setCategory("Todos")
                      setSelectedPresetId(
                        allPresets.find((preset) => preset.collection === item)?.id ?? selectedPresetId,
                      )
                    }}
                  >
                    {item} <small>{count}</small>
                  </button>
                )
              })}
            </div>
            <div className="filter-row" aria-label="Filtrar presets">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`filter ${category === item ? "active" : ""}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p>
              <b>{collection} · configuración audible</b>
              <span>Selecciona una tarjeta para editar texto e instrucción.</span>
            </p>
          </div>
          <div className="preset-grid">
            {visiblePresets.map((preset, index) => {
              const pitch = `${preset.pitch > 0 ? "+" : ""}${preset.pitch.toFixed(1)} st`
              const isApplied = lastAppliedId === preset.id
              const icon: IconName =
                preset.category === "Comercial"
                  ? "wave"
                  : preset.category === "Personajes"
                    ? "sparkles"
                    : preset.category === "Corporativo"
                      ? "sliders"
                      : "mic"
              return (
                <article
                  className={`preset-card ${isApplied ? "applied" : ""} ${selectedPresetId === preset.id ? "selected" : ""}`}
                  data-testid={`preset-card-${preset.id}`}
                  data-preset-id={preset.id}
                  key={preset.id}
                  style={{ "--preset": preset.color } as React.CSSProperties}
                  tabIndex={0}
                  onClick={() => setSelectedPresetId(preset.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedPresetId(preset.id)
                  }}
                >
                  <header>
                    <span className="preset-icon">
                      <Icon name={icon} size={18} />
                    </span>
                    {isApplied ? (
                      <span className="preset-applied-mark" title="Último preset aplicado">
                        <Icon name="check" size={15} />
                      </span>
                    ) : (
                      <span>#{String(index + 1).padStart(2, "0")}</span>
                    )}
                  </header>
                  <p>{preset.category.toUpperCase()}</p>
                  <h3>{preset.name}</h3>
                  <span className="preset-meta">{preset.voiceName} · {preset.engineId === "cosyvoice" ? "COSY NATIVE" : preset.engineId === "qwen3_tts" ? "QWEN NATIVE" : "KOKORO NATIVE"}</span>
                  <div className="preset-config" aria-label={`Configuración de ${preset.name}`}>
                    <span>{preset.speed.toFixed(2)}×</span>
                    <span>{pitch}</span>
                    <span>{preset.emotion}</span>
                  </div>
                  <footer>
                    <button
                      aria-label={`Generar muestra real de ${preset.name}`}
                      data-testid={`preview-preset-${preset.id}`}
                      disabled={previewingId !== null}
                      onClick={(event) => {
                        event.stopPropagation()
                        void previewPreset(preset)
                      }}
                    >
                      <Icon name={previewingId === preset.id ? "refresh" : "play"} size={14} />
                      {previewingId === preset.id ? "Generando" : "Escuchar"}
                    </button>
                    <button
                      className="use-preset"
                      data-testid={`apply-preset-${preset.id}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        applyPreset(preset)
                      }}
                    >
                      {isApplied ? "Aplicado" : "Aplicar"} <Icon name="arrow" size={14} />
                    </button>
                  </footer>
                </article>
              )
            })}
          </div>
        </div>
        <aside className="preset-lab" aria-label="Laboratorio del preset seleccionado">
          <header className="preset-lab-head">
            <span><Icon name="wand" size={15} /> LABORATORIO DE PRESET</span>
            <b>{draft.designFamily.toUpperCase()}</b>
          </header>
          <div className="preset-lab-title">
            <strong>{draft.name}</strong>
            <small>{draft.voiceName} · {draft.engineId}</small>
          </div>
          <div className="preset-lab-selects">
            <label>
              MODELO
              <select
                value={draft.engineId}
                onChange={(event) => {
                  const engineId = event.target.value
                  const firstVoice = presetVoices[engineId]?.[0]
                  setDraft((current) => ({
                    ...current,
                    engineId,
                    voiceId: firstVoice?.id ?? current.voiceId,
                    voiceName: firstVoice?.name ?? current.voiceName,
                  }))
                }}
              >
                {modelOptions.map((model) => <option value={model.id} key={model.id} disabled={model.disabled}>{model.label}</option>)}
              </select>
              <small>{modelOptions.find((model) => model.id === draft.engineId)?.note}</small>
            </label>
            <label>
              VOZ
              <select
                value={draft.voiceId}
                onChange={(event) => {
                  const nextVoice = voiceOptions.find((voice) => voice.id === event.target.value)
                  setDraft((current) => ({ ...current, voiceId: event.target.value, voiceName: nextVoice?.name ?? current.voiceName }))
                }}
              >
                {!voiceOptions.some((voice) => voice.id === draft.voiceId) && <option value={draft.voiceId}>{draft.voiceName}</option>}
                {voiceOptions.map((voice) => <option value={voice.id} key={voice.id}>{voice.name}</option>)}
              </select>
            </label>
          </div>
          <div className="preset-lab-controls">
            <label>VEL.
              <input type="number" min="0.5" max="2" step="0.05" value={draft.speed} onChange={(event) => setDraft((current) => ({ ...current, speed: Number(event.target.value) }))} />
            </label>
            <label>TONO
              <input type="number" min="-6" max="6" step="0.5" value={draft.pitch} onChange={(event) => setDraft((current) => ({ ...current, pitch: Number(event.target.value) }))} />
            </label>
            <label>MATIZ
              <select value={draft.emotion} onChange={(event) => setDraft((current) => ({ ...current, emotion: event.target.value as StudioPreset["emotion"] }))}>
                <option>NEUTRO</option><option>NARRATIVO</option><option>CÁLIDO</option><option>INFORMATIVO</option><option>EXPRESIVO</option>
              </select>
            </label>
          </div>
          <label className="preset-lab-editor instruction-editor">
            <span>INSTRUCCIÓN DE DISEÑO <small>{draftInstruction.length}/1500</small></span>
            <textarea value={draftInstruction} maxLength={1500} onChange={(event) => setDraftInstruction(event.target.value)} />
          </label>
          <label className="preset-lab-editor text-editor">
            <span>TEXTO A GENERAR <small>{draftText.length}/6000</small></span>
            <textarea value={draftText} maxLength={6000} onChange={(event) => setDraftText(event.target.value)} placeholder="Pega aquí hasta 6.000 caracteres en español…" />
          </label>
          <div className="preset-lab-actions">
            <button className="preset-lab-generate" data-testid="generate-preset-lab" onClick={() => void generateFromLab()} disabled={previewingId !== null}>
              <Icon name={previewingId === "preset-lab" ? "refresh" : "play"} size={15} />
              {previewingId === "preset-lab" ? "Generando WAV" : "Generar WAV real"}
            </button>
            <button onClick={duplicateDraft}><Icon name="copy" size={14} /> Duplicar</button>
            <button onClick={atomizeDraft}><Icon name="sparkles" size={14} /> 3 variantes</button>
            {selectedPreset?.collection === "Mis variantes" && <button className="danger" onClick={deleteSelectedVariant}><Icon name="trash" size={14} /> Eliminar</button>}
          </div>
          <div className="preset-lab-audit" data-testid="preset-lab-audit">
            <b>{lastGeneration ? (isFallbackGeneration(lastGeneration) ? "RESERVA DETECTADA" : "AUDIO NATIVO AUDITADO") : "PROCEDENCIA ANTES DE GENERAR"}</b>
            <span>{lastGeneration ? `${lastGeneration.motor} · ${lastGeneration.modelo_origen}` : "Qwen3 VoiceDesign está listo para instrucciones; F5 nativo se usa desde Clonación con una referencia."}</span>
          </div>
        </aside>
      </section>
    </Page>
  )
}

function StudioPage({ notify }: { notify: (message: string) => void }) {
  const concept: string = "A"
  const [engineId, setEngineId] = useState("kokoro")
  const [voiceIndex, setVoiceIndex] = useState(0)
  const [mode, setMode] = useState<"direct" | "clone" | "dna">("direct")
  const [region, setRegion] = useState("TODOS")
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(0)
  const [emotion, setEmotion] = useState("NEUTRO")
  const [script, setScript] = useState(
    "VozStudio Omni ejecuta síntesis neural en español completamente en local, con privacidad absoluta y control profesional de cada parámetro.",
  )
  const [dnaMode, setDnaMode] = useState<"qwen" | "cosy">("qwen")
  const [dsp, setDsp] = useState({ noise: true, nasal: true, deesser: true })
  const [inspector, setInspector] = useState<"motor" | "audit" | "voz">("motor")
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(82)
  const [libraryQuery, setLibraryQuery] = useState("")
  const [filterLibrary, setFilterLibrary] = useState(false)
  const [activeLibrary, setActiveLibrary] = useState<string | null>(null)
  const [engines, setEngines] = useState<EngineInfo[]>(FALLBACK_ENGINES)
  const [voicesByEngine, setVoicesByEngine] = useState<Record<string, VoiceInfo[]>>(
    FALLBACK_VOICES_BY_ENGINE,
  )
  const [libraryFiles, setLibraryFiles] = useState<LibraryItem[]>([])
  const [lastItem, setLastItem] = useState<LibraryItem | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [activePreset, setActivePreset] = useState<StudioPreset | null>(null)
  const [pendingPreset, setPendingPreset] = useState<StudioPreset | null>(() =>
    loadLocal<StudioPreset | null>(PENDING_PRESET_STORAGE_KEY, null),
  )
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null)
  const [referenceText, setReferenceText] = useState(
    "El veloz murciélago hindú comía feliz cardillo y kiwi; la cigüeña tocaba el saxofón detrás del palenque.",
  )
  const [cloneText, setCloneText] = useState(
    "Esta clonación conserva el timbre, la resonancia y la intención de la voz de referencia.",
  )
  const [cloneName, setCloneName] = useState("Mi voz clonada")
  const [cloneRegion, setCloneRegion] = useState("ES")
  const [dnaPrompt, setDnaPrompt] = useState(
    "Voz femenina de unos 32 años, timbre cálido y envolvente, cadencia pausada, acento castellano neutro y dicción impecable.",
  )
  const [dnaText, setDnaText] = useState(
    "Bienvenidos a VozStudio Omni. Esta voz ha sido diseñada mediante parámetros acústicos descritos en lenguaje natural.",
  )
  const [dnaName, setDnaName] = useState("Mi Timbre DNA")
  const [dnaRegion, setDnaRegion] = useState("ES")
  const [voicePrompt, setVoicePrompt] = useState("")
  const referenceInput = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const visualEngines = useMemo(
    () => engines.map((item, index) => toVisualEngine(item, index)),
    [engines],
  )
  const visualVoices = useMemo(() => {
    const live = Object.fromEntries(
      Object.entries(voicesByEngine).map(([id, list]) => [
        id,
        list.map(toStudioVoice),
      ]),
    ) as Record<string, StudioVoice[]>
    return Object.keys(live).length ? live : studioVoices
  }, [voicesByEngine])
  const engine =
    visualEngines.find((item) => item.id === engineId) ?? visualEngines[0]
  const engineVoices = visualVoices[engineId] ?? []
  const filteredVoices =
    region === "TODOS"
      ? engineVoices
      : engineVoices.filter((voice) => voice.region === region)
  const selectedVoice =
    engineVoices[Math.min(voiceIndex, Math.max(0, engineVoices.length - 1))]
  const selectedVoiceInfo = voicesByEngine[engineId]?.find(
    (voice) => voice.id === selectedVoice?.id,
  )
  const activePresetIsExact = Boolean(
    activePreset &&
      engineId === activePreset.engineId &&
      selectedVoice?.id === activePreset.voiceId &&
      speed === activePreset.speed &&
      pitch === activePreset.pitch &&
      emotion === activePreset.emotion &&
      script === activePreset.script,
  )
  const visibleLibrary = libraryFiles.filter((file) => {
    const queryMatch = `${file.archivo} ${file.prompt_original}`
      .toLowerCase()
      .includes(libraryQuery.toLowerCase())
    const engineMatch = !filterLibrary || file.motor === engineId
    return queryMatch && engineMatch
  })

  const selectedLibrary =
    libraryFiles.find((item) => item.id === activeLibrary) ?? lastItem ?? null

  const refreshLibrary = async () => {
    try {
      const items = await studioApi.getLibrary()
      setLibraryFiles(items)
      if (!activeLibrary && items[0]) setActiveLibrary(items[0].id)
    } catch (error) {
      notify(`No se pudo leer la biblioteca: ${error instanceof Error ? error.message : "error local"}`)
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const remoteEngines = await studioApi.getEngines()
        const usableEngines = remoteEngines.length ? remoteEngines : FALLBACK_ENGINES
        const voiceEntries = await Promise.all(
          usableEngines.map(async (item) => {
            try {
              return [item.id, await studioApi.getVoices(item.id)] as const
            } catch {
              return [item.id, FALLBACK_VOICES_BY_ENGINE[item.id] ?? []] as const
            }
          }),
        )
        const library = await studioApi.getLibrary()
        if (!active) return
        setEngines(usableEngines)
        setVoicesByEngine(Object.fromEntries(voiceEntries))
        setLibraryFiles(library)
        setActiveLibrary(library[0]?.id ?? null)
        if (!usableEngines.some((item) => item.id === engineId)) {
          setEngineId(usableEngines[0]?.id ?? "kokoro")
        }
      } catch (error) {
        if (active) {
          notify(
            `Motor local no disponible: ${error instanceof Error ? error.message : "sin conexión"}`,
          )
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = muted ? 0 : volume / 100
  }, [muted, volume])

  useEffect(() => {
    setVoicePrompt(
      selectedVoiceInfo?.prompt_utilizado ??
        selectedVoiceInfo?.description ??
        "",
    )
  }, [selectedVoiceInfo?.id])

  useEffect(() => {
    if (!pendingPreset) return
    const presetEngine = engines.find(
      (item) => item.id === pendingPreset.engineId && item.available,
    )
    const presetVoices = voicesByEngine[pendingPreset.engineId] ?? []
    const presetVoiceIndex = presetVoices.findIndex(
      (voice) => voice.id === pendingPreset.voiceId,
    )

    // El catálogo de respaldo se pinta antes de que termine de llegar el inventario real.
    // Conservar la receta pendiente evita descartarla por una carrera de carga de voces.
    if (!presetEngine || presetVoiceIndex < 0) return

    setEngineId(pendingPreset.engineId)
    setVoiceIndex(presetVoiceIndex)
    setRegion("TODOS")
    setSpeed(pendingPreset.speed)
    setPitch(pendingPreset.pitch)
    setEmotion(pendingPreset.emotion)
    setScript(pendingPreset.script)
    setMode("direct")
    setActivePreset(pendingPreset)
    window.localStorage.removeItem(PENDING_PRESET_STORAGE_KEY)
    window.localStorage.setItem(LAST_PRESET_STORAGE_KEY, JSON.stringify(pendingPreset.id))
    setPendingPreset(null)
    notify(`Preset activo: ${pendingPreset.name}`)
  }, [engines, notify, pendingPreset, voicesByEngine])

  const adoptOutput = (item: LibraryItem, message: string) => {
    setLastItem(item)
    setLibraryFiles((items) => [item, ...items.filter((existing) => existing.id !== item.id)])
    setActiveLibrary(item.id)
    setInspector("audit")
    notify(message)
  }

  const playItem = async (item: LibraryItem | null) => {
    if (!item) {
      notify("Selecciona un audio real de la biblioteca")
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (playing && audio.src.endsWith(item.audio_url)) {
      audio.pause()
      setPlaying(false)
      return
    }
    audio.src = item.audio_url
    audio.volume = muted ? 0 : volume / 100
    try {
      await audio.play()
      setPlaying(true)
    } catch (error) {
      notify(`No se pudo reproducir el WAV: ${error instanceof Error ? error.message : "error"}`)
    }
  }

  const downloadItem = (item: LibraryItem | null) => {
    if (!item) {
      notify("Aún no hay un WAV generado para descargar")
      return
    }
    const link = document.createElement("a")
    link.href = item.audio_url
    link.download = item.archivo
    link.click()
  }

  const runDirect = async () => {
    if (!script.trim()) {
      notify("Escribe un guión antes de sintetizar")
      return
    }
    if (!engine || !selectedVoice?.id) {
      notify("Selecciona un motor y un timbre disponibles")
      return
    }
    setIsBusy(true)
    try {
      const item = await studioApi.synthesize({
        text: script.trim(),
        engine_id: engine.id,
        voice_id: selectedVoice.id,
        speed,
        pitch_semitones: pitch,
        emotion: emotion === "NEUTRO" ? null : emotion.toLowerCase(),
      })
      adoptOutput(item, `Síntesis real completada · ${item.archivo}`)
    } catch (error) {
      notify(`La síntesis no se completó: ${error instanceof Error ? error.message : "error local"}`)
    } finally {
      setIsBusy(false)
    }
  }

  const runClone = async () => {
    if (!cloneText.trim() || !referenceText.trim()) {
      notify("Completa el texto objetivo y la transcripción de la semilla")
      return
    }
    if (!referenceAudio) {
      notify("Carga una referencia WAV, MP3 o FLAC para la clonación")
      referenceInput.current?.click()
      return
    }
    const cloneEngine = visualEngines.find((item) =>
      ["f5_spanish", "cosyvoice", "xtts_v2", "qwen3_tts"].includes(item.id),
    ) ?? engine
    if (!cloneEngine) return
    setIsBusy(true)
    try {
      const item = await studioApi.cloneVoice({
        text: cloneText.trim(),
        engine_id: cloneEngine.id,
        voice_id: null,
        reference_text: referenceText.trim(),
        speed,
        emotion: emotion === "NEUTRO" ? null : emotion.toLowerCase(),
        reference_audio: referenceAudio,
      })
      adoptOutput(item, `Clonación real completada · ${item.archivo}`)
    } catch (error) {
      notify(`La clonación no se completó: ${error instanceof Error ? error.message : "error local"}`)
    } finally {
      setIsBusy(false)
    }
  }

  const saveClone = async () => {
    if (!referenceAudio) {
      notify("Carga una semilla de voz antes de guardarla")
      referenceInput.current?.click()
      return
    }
    setIsBusy(true)
    try {
      await studioApi.saveCustomVoice({
        engineId: engine?.id ?? "f5_spanish",
        name: cloneName.trim() || "Voz clonada",
        region: cloneRegion,
        description: "Timbre guardado desde Laboratorio Zero-Shot",
        referenceText: referenceText.trim(),
        referenceAudio,
      })
      notify("Timbre persistido en Mis voces")
    } catch (error) {
      notify(`No se pudo guardar el timbre: ${error instanceof Error ? error.message : "error local"}`)
    } finally {
      setIsBusy(false)
    }
  }

  const runDna = async () => {
    if (!dnaText.trim() || !dnaPrompt.trim()) {
      notify("Completa la descripción de voz y el guión")
      return
    }
    const dnaEngine =
      visualEngines.find((item) =>
        dnaMode === "qwen" ? item.id === "qwen3_tts" : item.id === "cosyvoice",
      ) ?? engine
    if (!dnaEngine) return
    setIsBusy(true)
    try {
      const result = await studioApi.synthesizeDna({
        text: dnaText.trim(),
        engine_id: dnaEngine.id,
        mode: dnaMode === "qwen" ? "voice_design" : "instruct_tts",
        voice_design_prompt: dnaMode === "qwen" ? dnaPrompt.trim() : undefined,
        instruct_prompt: dnaMode === "cosy" ? dnaPrompt.trim() : undefined,
        speed,
        temperature: 0.7,
        save_as_custom: true,
        custom_voice_name: dnaName.trim() || "Timbre DNA",
        custom_voice_region: dnaRegion,
      })
      adoptOutput(result.item, `Diseño DNA real completado · ${result.item.archivo}`)
    } catch (error) {
      notify(`El diseño DNA no se completó: ${error instanceof Error ? error.message : "error local"}`)
    } finally {
      setIsBusy(false)
    }
  }

  const selectEngine = (id: string) => {
    setEngineId(id)
    setVoiceIndex(0)
    if (id === "f5_spanish" || id === "cosyvoice" || id === "xtts_v2")
      setMode("clone")
    if (id === "qwen3_tts") setMode("dna")
  }

  const run = () => {
    if (mode === "direct") void runDirect()
    if (mode === "clone") void runClone()
    if (mode === "dna") void runDna()
  }

  const unloadEngines = async () => {
    try {
      await studioApi.unloadEngines()
      notify("Sesiones ONNX desalojadas y memoria liberada")
    } catch (error) {
      notify(`No se pudieron liberar los motores: ${error instanceof Error ? error.message : "error local"}`)
    }
  }

  const removeLibraryItem = async (item: LibraryItem) => {
    try {
      await studioApi.deleteLibraryItem(item.id)
      setLibraryFiles((items) => items.filter((entry) => entry.id !== item.id))
      if (activeLibrary === item.id) setActiveLibrary(null)
      notify("Audio y metadatos JSON eliminados")
    } catch (error) {
      notify(`No se pudo eliminar el audio: ${error instanceof Error ? error.message : "error local"}`)
    }
  }

  const saveVoiceMetadata = async () => {
    if (!selectedVoiceInfo?.id || !selectedVoiceInfo.is_custom) {
      notify("Los metadatos editables pertenecen a un timbre clonado o diseñado")
      return
    }
    try {
      const updated = await studioApi.updateCustomVoice(selectedVoiceInfo.id, {
        description: voicePrompt,
        prompt_utilizado: voicePrompt,
      })
      setVoicesByEngine((groups) => ({
        ...groups,
        [engineId]: (groups[engineId] ?? []).map((voice) =>
          voice.id === updated.id ? updated : voice,
        ),
      }))
      notify("Metadatos del timbre actualizados")
    } catch (error) {
      notify(`No se pudieron guardar los metadatos: ${error instanceof Error ? error.message : "error local"}`)
    }
  }

  return (
    <Page
      title="Estudio neural"
      description="Control completo de motores, timbres, clonación, VoiceDesign y salida auditada."
      action={
        <div className="studio-head-actions">
          <div className="live-concept">
            <span>
              {concept === "A" ? "DISEÑO PRINCIPAL" : "VISTA TEMPORAL"}
            </span>
            <strong>
              {concept === "A" ? "4 columnas" : `Concepto ${concept}`}
            </strong>
          </div>
          <button
            className="memory-btn"
            onClick={() => void unloadEngines()}
          >
            <Icon name="settings" size={17} />
            Liberar VRAM <span>1.8 GB</span>
          </button>
        </div>
      }
    >
      <input
        ref={referenceInput}
        type="file"
        accept="audio/wav,audio/x-wav,audio/mpeg,audio/flac,audio/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          if (file) {
            setReferenceAudio(file)
            notify(`Semilla real cargada: ${file.name}`)
          }
        }}
      />
      <audio ref={audioRef} onEnded={() => setPlaying(false)} hidden />
      <div
        className={`studio-console studio-variant-${concept.toLowerCase()} ${
          concept === "A" ? "studio-layout-four" : ""
        }`}
      >
        {concept === "C" && (
          <div className="real-flow-steps">
            {[
              ["01", "Fuente", "Guion o semilla"],
              ["02", "Timbre", selectedVoice?.name ?? "Seleccionar voz"],
              ["03", "Dirección", `${speed.toFixed(2)}x · ${emotion}`],
              ["04", "Proceso", engine.name],
              ["05", "Salida", "WAV auditado"],
            ].map(([number, label, detail], index) => (
              <button
                className={
                  index === (mode === "direct" ? 2 : mode === "clone" ? 1 : 3)
                    ? "active"
                    : ""
                }
                key={label}
              >
                <i>{number}</i>
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                {index < 4 && <Icon name="arrow" size={14} />}
              </button>
            ))}
          </div>
        )}
        <aside className="studio-column engine-column">
          <div className="console-title">
            <span>MOTORES NEURALES</span>
            <b>8 ARQUITECTURAS</b>
          </div>
          <div className="engine-matrix">
            {visualEngines.map((item) => (
              <button
                key={item.id}
                className={engineId === item.id ? "active" : ""}
                onClick={() => selectEngine(item.id)}
                style={{ "--engine": item.color } as React.CSSProperties}
              >
                <div>
                  <Icon
                    name={
                      item.id === "qwen3_tts"
                        ? "sparkles"
                        : item.id.includes("f5") || item.id.includes("xtts")
                          ? "mic"
                          : "wave"
                    }
                    size={17}
                  />
                  <em>{item.size}</em>
                </div>
                <strong>{item.name}</strong>
                <small>{item.type}</small>
              </button>
            ))}
          </div>
          <div className="console-title voices-title">
            <span>TIMBRES EN ESPAÑOL</span>
            <b>{engine.short}</b>
          </div>
          <div className="region-tabs">
            {["TODOS", "ES", "MX", "AR", "LATAM", "MULTI"].map((item) => (
              <button
                key={item}
                className={region === item ? "active" : ""}
                onClick={() => setRegion(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="studio-voice-list">
            {filteredVoices.map((voice) => {
              const originalIndex = engineVoices.indexOf(voice)
              return (
                <button
                  key={voice.name}
                  className={voiceIndex === originalIndex ? "active" : ""}
                  onClick={() => setVoiceIndex(originalIndex)}
                >
                  <div>
                    <strong>{voice.name}</strong>
                    {voice.clone && <em>CLON</em>}
                  </div>
                  <span>{voice.detail}</span>
                  <footer>
                    <b>{voice.region}</b>
                    <b>{voice.gender}</b>
                    <small>{voice.rate}</small>
                  </footer>
                </button>
              )
            })}
            {filteredVoices.length === 0 && (
              <div className="empty-voices">Sin timbres para esta región</div>
            )}
          </div>
        </aside>

        {concept === "A" && (
          <>
            <section className="four-studio-column direct-column">
              <header className="four-column-head cyan-head">
                <span className="four-column-icon">
                  <Icon name="wave" size={20} />
                </span>
                <div>
                  <small>COLUMNA 02</small>
                  <h2>Síntesis directa</h2>
                </div>
                <b>{selectedVoice?.name ?? "Sin voz"}</b>
              </header>
              <div className="four-presets">
                {["Calibración", "Crónica", "Literario"].map((item) => (
                  <button
                    key={item}
                    onClick={() =>
                      setScript(
                        `${item}. La voz seleccionada conserva una dicción clara, cadencia natural y resonancia de estudio en español.`,
                      )
                    }
                  >
                    {item}
                  </button>
                ))}
                <button onClick={() => setScript("")}>Limpiar</button>
              </div>
              <div className="four-segments">
                <span>
                  <Icon name="layers" size={15} />
                  Segmentos
                </span>
                <button className="active">1/3</button>
                <button>2/3</button>
                <button>3/3</button>
                <b>{script.length} car.</b>
              </div>
              <label className="four-editor direct-editor">
                <span>GUIÓN EN ESPAÑOL</span>
                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                />
              </label>
              <div className="four-control-stack">
                <Range
                  label="VELOCIDAD"
                  value={speed}
                  min={0.5}
                  max={2}
                  step={0.05}
                  display={`${speed.toFixed(2)}x`}
                  onChange={setSpeed}
                />
                <Range
                  label="TONO"
                  value={pitch}
                  min={-6}
                  max={6}
                  step={0.5}
                  display={`${pitch > 0 ? "+" : ""}${pitch.toFixed(1)} st`}
                  onChange={setPitch}
                />
                <label className="four-select">
                  MATIZ
                  <select
                    value={emotion}
                    onChange={(event) => setEmotion(event.target.value)}
                  >
                    <option>NEUTRO</option>
                    <option>NARRATIVO</option>
                    <option>CÁLIDO</option>
                    <option>INFORMATIVO</option>
                    <option>EXPRESIVO</option>
                  </select>
                </label>
              </div>
              <div className="four-actions">
                <button className="secondary-action" onClick={() => void runDirect()} disabled={isBusy}>
                  Sintetizar bloque
                </button>
                <button className="synth-action" onClick={() => void runDirect()} disabled={isBusy}>
                  <Icon name="wave" size={17} />
                  Sintetizar todo
                </button>
              </div>
            </section>

            <section className="four-studio-column clone-column">
              <header className="four-column-head amber-head">
                <span className="four-column-icon">
                  <Icon name="mic" size={20} />
                </span>
                <div>
                  <small>COLUMNA 03</small>
                  <h2>Laboratorio Zero‑Shot</h2>
                </div>
                <b>F5 · COSY</b>
              </header>
              <div className="clone-engine-inline">
                <span>
                  <i />
                  Motor recomendado
                </span>
                <strong>
                  {engine.id === "kokoro" ? "F5-Spanish" : engine.short}
                </strong>
              </div>
              <div className="four-presets clone-presets">
                {["Fonético", "Narrativa", "Natural", "Comercial"].map(
                  (item, index) => (
                    <button className={index === 0 ? "active" : ""} key={item}>
                      {item}
                    </button>
                  ),
                )}
              </div>
              <div className="four-source-grid">
                <button
                  onClick={() => referenceInput.current?.click()}
                >
                  <Icon name="mic" size={20} />
                  <span>
                    <strong>Grabar en vivo</strong>
                    <small>15 s · nivel monitorizado</small>
                  </span>
                </button>
                <button
                  onClick={() => referenceInput.current?.click()}
                >
                  <Icon name="upload" size={20} />
                  <span>
                    <strong>Cargar WAV</strong>
                    <small>3–15 s · voz limpia</small>
                  </span>
                </button>
              </div>
              <label className="four-editor seed-editor">
                <span>TRANSCRIPCIÓN DE LA SEMILLA</span>
                <textarea value={referenceText} onChange={(event) => setReferenceText(event.target.value)} />
              </label>
              <div className="four-dsp">
                <span>DSP</span>
                {([
                  ["noise", "Ruido"],
                  ["nasal", "Nasal"],
                  ["deesser", "De-Esser"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={dsp[key] ? "active" : ""}
                    onClick={() => setDsp({ ...dsp, [key]: !dsp[key] })}
                  >
                    <Icon name={dsp[key] ? "check" : "plus"} size={12} />
                    {label}
                  </button>
                ))}
              </div>
              <label className="four-editor clone-target-editor">
                <span>TEXTO OBJETIVO</span>
                <textarea value={cloneText} onChange={(event) => setCloneText(event.target.value)} />
              </label>
              <div className="save-clone-inline">
                <input value={cloneName} onChange={(event) => setCloneName(event.target.value)} />
                <select value={cloneRegion} onChange={(event) => setCloneRegion(event.target.value)}>
                  <option>ES</option>
                  <option>MX</option>
                  <option>AR</option>
                  <option>LATAM</option>
                </select>
                <button onClick={() => void saveClone()} disabled={isBusy}>
                  Guardar
                </button>
              </div>
              <button className="execute-clone" onClick={() => void runClone()} disabled={isBusy}>
                <Icon name="mic" size={18} />
                Ejecutar clonación Zero‑Shot
              </button>
            </section>

            <aside className="four-studio-column output-column">
              <section className="output-wave-section">
                <header>
                  <span>
                    <Icon name="wave" size={16} />
                    GRÁFICA DE VOZ
                  </span>
                  <b>24 kHz · PCM</b>
                </header>
                <div className="output-waveform">
                  <Waveform />
                </div>
                <footer>
                  <button onClick={() => void playItem(selectedLibrary)}>
                    <Icon name={playing ? "pause" : "play"} size={14} />
                  </button>
                  <span>{playing ? "Reproduciendo" : "00:00.0"} / {libraryDuration(selectedLibrary)}</span>
                  <button onClick={() => setMuted(!muted)}>
                    <Icon name="volume" size={14} />
                  </button>
                  <button onClick={() => downloadItem(selectedLibrary)}>
                    <Icon name="upload" size={14} />
                  </button>
                </footer>
              </section>

              <section className="output-library-section">
                <header>
                  <span>
                    <Icon name="folder" size={15} />
                    BIBLIOTECA AUDITADA
                  </span>
                  <b>{libraryFiles.length} WAV</b>
                </header>
                <div className="output-search">
                  <Icon name="search" size={14} />
                  <input
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="Buscar audio..."
                  />
                </div>
                <div className="output-library-list">
                  {visibleLibrary.map((file) => (
                    <button
                      className={activeLibrary === file.id ? "active" : ""}
                      key={file.id}
                      onClick={() => {
                        setActiveLibrary(file.id)
                        setInspector("audit")
                      }}
                    >
                      <strong>{file.archivo}</strong>
                      <span>
                        {file.motor.toUpperCase()}
                        <b>{libraryDuration(file)}</b>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="output-metadata-section">
                <div className="output-tabs">
                  <button
                    className={inspector === "motor" ? "active" : ""}
                    onClick={() => setInspector("motor")}
                  >
                    Motor
                  </button>
                  <button
                    className={inspector === "audit" ? "active" : ""}
                    onClick={() => setInspector("audit")}
                  >
                    Metadatos
                  </button>
                  <button
                    className={inspector === "voz" ? "active" : ""}
                    onClick={() => setInspector("voz")}
                  >
                    Timbre
                  </button>
                </div>
                <div className="output-meta-grid">
                  {(inspector === "motor"
                    ? [
                        ["MOTOR", engine.name],
                        ["RUNTIME", engine.provider],
                        ["TIMBRE", selectedVoice?.name ?? "--"],
                        ["LICENCIA", engine.license],
                      ]
                    : inspector === "audit"
                      ? [
                          ["DURACIÓN", libraryDuration(selectedLibrary)],
                          ["RTF", String(selectedLibrary?.metricas?.rtf ?? "--")],
                          ["LATENCIA", `${selectedLibrary?.metricas?.tiempo_inferencia_ms ?? "--"} ms`],
                          ["MEMORIA", `${selectedLibrary?.metricas?.pico_memoria_mb ?? "--"} MB`],
                        ]
                      : [
                          ["REGIÓN", selectedVoice?.region ?? "--"],
                          ["GÉNERO", selectedVoice?.gender ?? "--"],
                          ["SAMPLE RATE", selectedVoice?.rate ?? "--"],
                          ["CALIDAD", "STUDIO"],
                        ]
                  ).map(([key, value]) => (
                    <div key={key}>
                      <span>{key}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </>
        )}

        <section className="studio-center">
          <div className="mode-tabs">
            <div>
              <button
                className={mode === "direct" ? "active" : ""}
                onClick={() => setMode("direct")}
              >
                <Icon name="wave" size={17} />
                Síntesis directa
              </button>
              <button
                className={mode === "clone" ? "active amber" : ""}
                onClick={() => setMode("clone")}
              >
                <Icon name="mic" size={17} />
                Laboratorio Zero-Shot
              </button>
              <button
                className={mode === "dna" ? "active" : ""}
                onClick={() => setMode("dna")}
              >
                <Icon name="sparkles" size={17} />
                DNA Design
              </button>
            </div>
            <span>
              {selectedVoice?.name ?? "Sin voz"} · {selectedVoice?.region}
            </span>
          </div>

          {mode === "direct" && (
            <div className="work-module">
              {activePreset && (
                <div
                  className={`active-preset-status ${activePresetIsExact ? "exact" : "edited"}`}
                  data-testid="active-preset-status"
                  data-preset-id={activePreset.id}
                >
                  <span>
                    <Icon name={activePresetIsExact ? "check" : "sliders"} size={14} />
                    {activePresetIsExact ? "RECETA ACTIVA" : "RECETA EDITADA"}
                  </span>
                  <strong>{activePreset.name}</strong>
                  <small>
                    {activePreset.voiceName} · {activePreset.speed.toFixed(2)}× · {activePreset.emotion}
                  </small>
                </div>
              )}
              <div className="preset-strip">
                <span>GUIÓN</span>
                {[
                  "Calibración acústica",
                  "Crónica económica",
                  "Relato literario",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() =>
                      setScript(
                        `${item}. La voz seleccionada conserva una dicción clara, cadencia natural y resonancia de estudio en español.`,
                      )
                    }
                  >
                    {item}
                  </button>
                ))}
                <button onClick={() => setScript("")}>Limpiar</button>
              </div>
              <div className="segment-bar">
                <span>
                  <Icon name="layers" size={16} />
                  Segmentos
                </span>
                <button className="active">Bloque 1/3</button>
                <button>Bloque 2/3</button>
                <button>Bloque 3/3</button>
                <em>{script.length} caracteres</em>
              </div>
              <label className="studio-editor">
                <span>DOCUMENTO DE SÍNTESIS</span>
                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                />
              </label>
              <div className="pro-controls">
                <Range
                  label="VELOCIDAD"
                  value={speed}
                  min={0.5}
                  max={2}
                  step={0.05}
                  display={`${speed.toFixed(2)}x`}
                  onChange={setSpeed}
                />
                <Range
                  label="TONO"
                  value={pitch}
                  min={-6}
                  max={6}
                  step={0.5}
                  display={`${pitch > 0 ? "+" : ""}${pitch.toFixed(1)} st`}
                  onChange={setPitch}
                />
                <label>
                  MATIZ
                  <select
                    value={emotion}
                    onChange={(event) => setEmotion(event.target.value)}
                  >
                    <option>NEUTRO</option>
                    <option>NARRATIVO</option>
                    <option>CÁLIDO</option>
                    <option>INFORMATIVO</option>
                    <option>EXPRESIVO</option>
                  </select>
                </label>
                <button className="secondary-action" onClick={run}>
                  Sintetizar bloque
                </button>
                <button className="synth-action" onClick={run}>
                  <Icon name="wave" />
                  Sintetizar todo
                </button>
              </div>
            </div>
          )}

          {mode === "clone" && (
            <div className="work-module clone-module">
              <div className="clone-engine-notice">
                <Icon name="mic" />
                <span>
                  <strong>Arquitectura de clonación recomendada</strong>
                  <small>F5-Spanish nativo · CosyVoice · XTTS · Qwen3</small>
                </span>
                <b>{engine.short}</b>
              </div>
              <div className="calibration-strip">
                {[
                  "Pangrama fonético",
                  "Narrativa cálida",
                  "Conversacional",
                  "Comercial",
                  "Corporativo",
                  "Íntimo",
                ].map((item, index) => (
                  <button className={index === 0 ? "active" : ""} key={item}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="clone-source">
                <div className="record-card">
                  <span className="record-orb">
                    <Icon name="mic" />
                  </span>
                  <div>
                    <strong>Grabar voz en vivo</strong>
                    <small>15 segundos · nivel y ruido monitorizados</small>
                  </div>
                  <button
                    onClick={() => referenceInput.current?.click()}
                  >
                    Grabar
                  </button>
                </div>
                <div className="source-divider">O</div>
                <button
                  className="upload-seed"
                  onClick={() => referenceInput.current?.click()}
                >
                  <Icon name="upload" />
                  <span>
                    <strong>Cargar semilla WAV</strong>
                    <small>3–15 s · voz limpia</small>
                  </span>
                </button>
              </div>
              <label className="studio-editor compact-editor">
                <span>TRANSCRIPCIÓN EXACTA DE LA SEMILLA</span>
                <textarea value={referenceText} onChange={(event) => setReferenceText(event.target.value)} />
              </label>
              <div className="dsp-bar">
                <span>TRATAMIENTO DSP</span>
                {([
                  ["noise", "Anti-ruido"],
                  ["nasal", "Anti-nasal"],
                  ["deesser", "De-Esser"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={dsp[key] ? "active" : ""}
                    onClick={() => setDsp({ ...dsp, [key]: !dsp[key] })}
                  >
                    <Icon name={dsp[key] ? "check" : "plus"} size={13} />
                    {label}
                  </button>
                ))}
                <button
                  className="clean-btn"
                  onClick={async () => {
                    if (!referenceAudio) {
                      notify("Carga una semilla antes de aplicar DSP")
                      referenceInput.current?.click()
                      return
                    }
                    try {
                      const cleaned = await studioApi.cleanVocalAudio(referenceAudio, {
                        removeNoise: dsp.noise,
                        antiNasal: dsp.nasal,
                        deEsser: dsp.deesser,
                      })
                      const response = await fetch(cleaned.audio_url)
                      const blob = await response.blob()
                      setReferenceAudio(new File([blob], "semilla_limpia.wav", { type: "audio/wav" }))
                      notify("Limpieza DSP aplicada a la semilla")
                    } catch (error) {
                      notify(`No se pudo limpiar la semilla: ${error instanceof Error ? error.message : "error local"}`)
                    }
                  }}
                >
                  <Icon name="wand" size={15} />
                  Limpiar audio
                </button>
              </div>
              <div className="save-seed">
                <input value={cloneName} onChange={(event) => setCloneName(event.target.value)} />
                <select value={cloneRegion} onChange={(event) => setCloneRegion(event.target.value)}>
                  <option>ES</option>
                  <option>MX</option>
                  <option>AR</option>
                  <option>LATAM</option>
                </select>
                <button onClick={() => void saveClone()} disabled={isBusy}>
                  <Icon name="plus" size={15} />
                  Guardar timbre en {engine.short}
                </button>
              </div>
              <button className="synth-action full-action" onClick={() => void runClone()} disabled={isBusy}>
                <Icon name="mic" />
                Ejecutar clonación Zero-Shot <span>≈ 42 s</span>
              </button>
            </div>
          )}

          {mode === "dna" && (
            <div className="work-module dna-module">
              <div className="dna-switch">
                <span>
                  <Icon name="sparkles" />
                  ARQUITECTURA DE DISEÑO TÍMBRICO
                </span>
                <div>
                  <button
                    className={dnaMode === "qwen" ? "active" : ""}
                    onClick={() => setDnaMode("qwen")}
                  >
                    Qwen3 VoiceDesign
                  </button>
                  <button
                    className={dnaMode === "cosy" ? "active" : ""}
                    onClick={() => setDnaMode("cosy")}
                  >
                    CosyVoice Instruct
                  </button>
                </div>
              </div>
              <div className="preset-strip">
                <span>PRESETS</span>
                {[
                  "Locutora Radio 32a",
                  "Documental Épico 50a",
                  "Podcast Tech 28a",
                  "Audiolibro Fantasía",
                ].map((item) => (
                  <button key={item}>{item}</button>
                ))}
              </div>
              <label className="studio-editor">
                <span>
                  {dnaMode === "qwen"
                    ? "DESCRIPCIÓN FENOTÍPICA Y TÍMBRICA"
                    : "INSTRUCCIÓN DE ESTILO, EMOCIÓN Y MODULACIÓN"}
                </span>
                <button
                  className="enhance-btn"
                  onClick={async () => {
                    try {
                      const result = await studioApi.enhancePrompt(
                        dnaPrompt,
                        dnaMode === "qwen" ? "voice_design" : "instruct_tts",
                      )
                      setDnaPrompt(result.enhanced_prompt)
                      notify(`Descripción mejorada con ${result.engine_used}`)
                    } catch (error) {
                      notify(`No se pudo mejorar la descripción: ${error instanceof Error ? error.message : "error local"}`)
                    }
                  }}
                >
                  <Icon name="wand" size={15} />
                  Mejorar con AI · Phi local
                </button>
                <textarea value={dnaPrompt} onChange={(event) => setDnaPrompt(event.target.value)} />
              </label>
              {dnaMode === "cosy" && (
                <div className="tag-strip">
                  <span>ETIQUETAS</span>
                  {["Risa", "Respiración", "Susurro", "Suspiro"].map((tag) => (
                    <button key={tag}>+ {tag}</button>
                  ))}
                </div>
              )}
              <label className="studio-editor compact-editor">
                <span>GUIÓN A SINTETIZAR</span>
                <textarea value={dnaText} onChange={(event) => setDnaText(event.target.value)} />
              </label>
              <div className="dna-options">
                <label>
                  <input type="checkbox" defaultChecked /> Guardar timbre en Mis
                  voces
                </label>
                <input value={dnaName} onChange={(event) => setDnaName(event.target.value)} />
                <select value={dnaRegion} onChange={(event) => setDnaRegion(event.target.value)}>
                  <option>ES</option>
                  <option>MX</option>
                  <option>AR</option>
                  <option>LATAM</option>
                </select>
                <span>Temp. 0.70</span>
              </div>
              <button className="synth-action full-action" onClick={() => void runDna()} disabled={isBusy}>
                <Icon name="sparkles" />
                {dnaMode === "qwen"
                  ? "Generar voz con Qwen3 12Hz"
                  : "Sintetizar con CosyVoice Instruct"}
              </button>
            </div>
          )}

          <div className="studio-wave">
            <div className="wave-meta">
              <span>
                <Icon name="wave" size={16} />
                SALIDA AUDITADA · {selectedLibrary?.archivo ?? "sin WAV generado"}
              </span>
              <div>
                <b>24.0 kHz</b>
                <b>PCM 16-bit</b>
              </div>
            </div>
            <Waveform />
            <footer>
              <button onClick={() => void playItem(selectedLibrary)}>
                <Icon name={playing ? "pause" : "play"} size={15} />
                {playing ? "Pausar" : "Reproducir"}
              </button>
              <span>{playing ? "Reproduciendo" : "00:00.0"} / {libraryDuration(selectedLibrary)}</span>
              <span>RTF {selectedLibrary?.metricas?.rtf ?? "--"} · INF {selectedLibrary?.metricas?.tiempo_inferencia_ms ?? "--"} ms</span>
              <button
                className={muted ? "muted" : ""}
                onClick={() => setMuted(!muted)}
                aria-label={muted ? "Activar sonido" : "Silenciar"}
              >
                <Icon name="volume" size={15} />
              </button>
              <input
                className="volume-slider"
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={(event) => {
                  setVolume(Number(event.target.value))
                  setMuted(false)
                }}
                aria-label="Volumen"
              />
              <button onClick={() => downloadItem(selectedLibrary)}>
                <Icon name="upload" size={15} />
                Descargar WAV
              </button>
            </footer>
          </div>
        </section>

        <aside className="studio-column audit-column">
          <div className="console-title">
            <span>BIBLIOTECA AUDITADA</span>
            <div className="audit-tools">
              <button
                className={filterLibrary ? "active" : ""}
                onClick={() => setFilterLibrary(!filterLibrary)}
              >
                {filterLibrary ? engine.short : "TODOS"}
              </button>
              <button
                aria-label="Actualizar biblioteca"
                onClick={() => void refreshLibrary()}
              >
                <Icon name="refresh" size={13} />
              </button>
            </div>
          </div>
          <div className="audit-search">
            <Icon name="search" size={15} />
            <input
              placeholder="Filtrar archivo o prompt..."
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
            />
          </div>
          <div className="audit-list">
            {visibleLibrary.map((file) => (
              <div
                className={activeLibrary === file.id ? "active" : ""}
                key={file.id}
              >
                <button onClick={() => setActiveLibrary(file.id)}>
                  <strong>{file.archivo}</strong>
                  <span>
                    {`${file.motor.toUpperCase()} / ${file.voz_id}`}
                    <b>{libraryDuration(file)}</b>
                  </span>
                </button>
                <button
                  className="delete-audio"
                  aria-label={`Eliminar ${file.archivo}`}
                  onClick={() => void removeLibraryItem(file)}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
            {visibleLibrary.length === 0 && (
              <div className="audit-empty">
                No hay archivos con este filtro.
              </div>
            )}
          </div>
          <div className="inspector-tabs">
            <button
              className={inspector === "motor" ? "active" : ""}
              onClick={() => setInspector("motor")}
            >
              Ficha motor
            </button>
            <button
              className={inspector === "audit" ? "active amber" : ""}
              onClick={() => setInspector("audit")}
            >
              JSON audit
            </button>
            <button
              className={inspector === "voz" ? "active" : ""}
              onClick={() => setInspector("voz")}
            >
              Metadatos
            </button>
          </div>
          {inspector === "motor" && (
            <div className="spec-grid">
              {[
                ["MOTOR ACTIVO", engine.name],
                ["LICENCIA", engine.license],
                ["RUNTIME", engine.provider],
                ["MEMORIA", engine.size],
                ["TIMBRE", selectedVoice?.name ?? "--"],
                [
                  "REGIÓN / GÉNERO",
                  `${selectedVoice?.region} / ${selectedVoice?.gender}`,
                ],
                ["SAMPLE RATE", selectedVoice?.rate ?? "24 kHz"],
                [
                  "CAPACIDADES",
                  selectedVoice?.clone
                    ? "Clonación + Prosodia"
                    : "Síntesis + Emoción",
                ],
              ].map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          {inspector === "audit" && (
            <div className="spec-grid">
              {[
                ["ARCHIVO", selectedLibrary?.archivo ?? "--"],
                ["MODELO ORIGEN", selectedLibrary?.modelo_origen ?? engine?.name ?? "--"],
                ["DURACIÓN / RTF", `${libraryDuration(selectedLibrary)} / ${selectedLibrary?.metricas?.rtf ?? "--"}`],
                ["LATENCIA / RAM", `${selectedLibrary?.metricas?.tiempo_inferencia_ms ?? "--"} ms / ${selectedLibrary?.metricas?.pico_memoria_mb ?? "--"} MB`],
                ["ENTRADA", `${selectedLibrary?.metricas?.caracteres_entrada ?? "--"} car.`],
                ["PARÁMETROS", `${speed.toFixed(2)}x · ${emotion}`],
                ["PROVEEDOR", engine?.provider ?? "--"],
                ["HUELLA", selectedLibrary?.id ?? "--"],
              ].map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          {inspector === "voz" && (
            <div className="voice-meta-form">
              <label>
                NOMBRE
                <input value={selectedVoice?.name ?? ""} readOnly />
              </label>
              <div>
                <label>
                  REGIÓN
                  <select value={selectedVoice?.region ?? "ES"} aria-readonly="true">
                    <option>{selectedVoice?.region}</option>
                  </select>
                </label>
                <label>
                  GÉNERO
                  <select value={selectedVoice?.gender ?? "MIX"} aria-readonly="true">
                    <option>{selectedVoice?.gender}</option>
                  </select>
                </label>
              </div>
              <label>
                HUELLA / PROMPT
                <textarea
                  value={voicePrompt}
                  onChange={(event) => setVoicePrompt(event.target.value)}
                />
              </label>
              <button
                onClick={() => void saveVoiceMetadata()}
              >
                Guardar cambios
              </button>
            </div>
          )}
        </aside>
      </div>
    </Page>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <b>{display}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function DnaDesignPage({ notify }: { notify: (message: string) => void }) {
  const [architecture, setArchitecture] = useState<"qwen" | "cosy">("qwen")
  const [prompt, setPrompt] = useState(
    "Voz femenina de unos 32 años, timbre cálido y envolvente, cadencia pausada, acento castellano neutro, resonancia de estudio y dicción impecable.",
  )
  const [text, setText] = useState(
    "Bienvenidos a VozStudio Omni. Esta voz ha sido diseñada mediante parámetros fenotípicos descritos en lenguaje natural.",
  )
  const [speed, setSpeed] = useState(1)
  const [temperature, setTemperature] = useState(0.7)
  const [saveVoice, setSaveVoice] = useState(true)
  const [lastItem, setLastItem] = useState<LibraryItem | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const improvePrompt = async () => {
    if (!prompt.trim()) {
      notify("Escribe una descripción antes de mejorarla")
      return
    }
    try {
      const result = await studioApi.enhancePrompt(
        prompt,
        architecture === "qwen" ? "voice_design" : "instruct_tts",
      )
      setPrompt(result.enhanced_prompt)
      notify(`Prompt mejorado con ${result.engine_used}`)
    } catch (error) {
      notify(`No se pudo mejorar el prompt: ${error instanceof Error ? error.message : "error local"}`)
    }
  }

  const generate = async () => {
    if (!prompt.trim() || !text.trim()) {
      notify("Completa la descripción de voz y el guión")
      return
    }
    setIsBusy(true)
    try {
      const result = await studioApi.synthesizeDna({
        text: text.trim(),
        engine_id: architecture === "qwen" ? "qwen3_tts" : "cosyvoice",
        mode: architecture === "qwen" ? "voice_design" : "instruct_tts",
        voice_design_prompt: architecture === "qwen" ? prompt.trim() : undefined,
        instruct_prompt: architecture === "cosy" ? prompt.trim() : undefined,
        speed,
        temperature,
        save_as_custom: saveVoice,
        custom_voice_name: "Mi Timbre DNA",
        custom_voice_region: "ES",
      })
      setLastItem(result.item)
      notify(
        result.saved_voice
          ? `Voz diseñada y guardada: ${result.saved_voice.name}`
          : `Voz diseñada: ${result.item.archivo}`,
      )
    } catch (error) {
      notify(`El diseño DNA no se completó: ${error instanceof Error ? error.message : "error local"}`)
    } finally {
      setIsBusy(false)
    }
  }

  const preview = async () => {
    if (!lastItem || !audioRef.current) {
      notify("Genera una voz real para escuchar la muestra")
      return
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }
    audioRef.current.src = lastItem.audio_url
    try {
      await audioRef.current.play()
      setPlaying(true)
    } catch (error) {
      notify(`No se pudo reproducir el WAV: ${error instanceof Error ? error.message : "error"}`)
    }
  }

  return (
    <Page
      title="DNA Design"
      description="Diseño tímbrico con Qwen3 VoiceDesign y control semántico CosyVoice Instruct."
      action={
        <span className="dna-local-badge">
          <i />
          PHI · DIRECTML LOCAL
        </span>
      }
    >
      <audio ref={audioRef} hidden onEnded={() => setPlaying(false)} />
      <div className="dna-page-layout">
        <section className="panel dna-creation-panel">
          <div className="dna-architecture-switch">
            <div>
              <Icon name="sparkles" size={21} />
              <span>
                <small>ARQUITECTURA ACTIVA</small>
                <strong>Diseño tímbrico y control semántico</strong>
              </span>
            </div>
            <nav>
              <button
                className={architecture === "qwen" ? "active" : ""}
                onClick={() => setArchitecture("qwen")}
              >
                Qwen3 VoiceDesign
              </button>
              <button
                className={architecture === "cosy" ? "active" : ""}
                onClick={() => setArchitecture("cosy")}
              >
                CosyVoice Instruct
              </button>
            </nav>
          </div>
          <div className="dna-pro-presets">
            <span>PRESETS PROFESIONALES</span>
            {[
              "Locutora Radio 32a",
              "Documental Épico",
              "Podcast Tech",
              "Audiolibro Fantasía",
            ].map((item) => (
              <button
                key={item}
                onClick={() => {
                  const prompts: Record<string, string> = {
                    "Locutora Radio 32a": "Voz femenina adulta, cálida y directa, dicción radiofónica, ritmo seguro y presencia de estudio.",
                    "Documental Épico": "Voz profunda y cinematográfica, pausas expresivas, resonancia amplia y narración envolvente.",
                    "Podcast Tech": "Voz cercana, clara y ágil, tono experto y natural para explicar tecnología.",
                    "Audiolibro Fantasía": "Voz narrativa cálida, articulación precisa, matices emocionales y atmósfera de cuento.",
                  }
                  setPrompt(prompts[item])
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="dna-large-editor">
            <header>
              <span>
                {architecture === "qwen"
                  ? "DESCRIPCIÓN FENOTÍPICA Y TÍMBRICA"
                  : "INSTRUCCIÓN DE ESTILO Y MODULACIÓN"}
              </span>
              <button
                onClick={() => void improvePrompt()}
                type="button"
              >
                <Icon name="wand" size={16} />
                Mejorar con AI local
              </button>
            </header>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          {architecture === "cosy" && (
            <div className="dna-tags">
              <span>ETIQUETAS PARALINGÜÍSTICAS</span>
              {["Risa", "Respiración", "Susurro", "Suspiro"].map((tag) => (
                <button key={tag}>+ {tag}</button>
              ))}
            </div>
          )}
          <label className="dna-large-editor dna-script-editor">
            <header>
              <span>GUIÓN A SINTETIZAR</span>
              <b>{text.length} CAR.</b>
            </header>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="dna-bottom-controls">
            <Range
              label="CADENCIA"
              value={speed}
              min={0.6}
              max={1.6}
              step={0.05}
              display={`${speed.toFixed(2)}x`}
              onChange={setSpeed}
            />
            <Range
              label="TEMPERATURA"
              value={temperature}
              min={0.3}
              max={1.1}
              step={0.05}
              display={temperature.toFixed(2)}
              onChange={setTemperature}
            />
            <label className="dna-save-toggle">
              <input
                type="checkbox"
                checked={saveVoice}
                onChange={(event) => setSaveVoice(event.target.checked)}
              />
              Guardar en Mis voces
            </label>
            <button
              className="dna-generate"
              onClick={() => void generate()}
              disabled={isBusy}
            >
              <Icon name="sparkles" size={18} />
              {architecture === "qwen"
                ? "Generar voz con Qwen3"
                : "Sintetizar con CosyVoice"}
            </button>
          </div>
        </section>
        <aside className="dna-side-column">
          <section className="panel dna-preview-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">PREVISUALIZACIÓN</p>
                <h2>Huella DNA</h2>
              </div>
              <span>24 kHz</span>
            </div>
            <div className="dna-orb">
              <span>
                <Icon name="wave" size={29} />
              </span>
              <i />
              <i />
            </div>
            <Waveform />
            <button onClick={() => void preview()}>
              <Icon name={playing ? "pause" : "play"} size={17} />
              {playing ? "Pausar muestra" : "Escuchar muestra"}
            </button>
          </section>
          <section className="panel dna-output-meta">
            <div className="panel-head">
              <div>
                <p className="eyebrow">SALIDA</p>
                <h2>Configuración</h2>
              </div>
            </div>
            {[
              [
                "MOTOR",
                lastItem?.modelo_origen ?? (architecture === "qwen" ? "Qwen3-TTS" : "CosyVoice 3"),
              ],
              ["PROVEEDOR", "Motor local"],
              ["FORMATO", "WAV · PCM 16-bit"],
              ["REGIÓN", "ES · Personalizable"],
              ["ARCHIVO", lastItem?.archivo ?? "Pendiente de generar"],
            ].map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </Page>
  )
}

function SettingsPage({ notify }: { notify: (message: string) => void }) {
  const persisted = loadLocal("vozstudio-settings", {
    vram: 25,
    threads: 12,
    provider: "DmlExecutionProvider",
    offline: true,
    audit: true,
  })
  const [vram, setVram] = useState(persisted.vram)
  const [threads, setThreads] = useState(persisted.threads)
  const [provider, setProvider] = useState(persisted.provider)
  const [offline, setOffline] = useState(persisted.offline)
  const [audit, setAudit] = useState(persisted.audit)
  const [models, setModels] = useState<EngineInfo[]>(FALLBACK_ENGINES)

  useEffect(() => {
    void studioApi.getEngines().then((items) => {
      if (items.length) setModels(items)
    }).catch(() => undefined)
  }, [])

  const saveSettings = () => {
    window.localStorage.setItem(
      "vozstudio-settings",
      JSON.stringify({ vram, threads, provider, offline, audit }),
    )
    notify("Preferencias de la interfaz guardadas localmente")
  }
  return (
    <Page
      title="Configuración técnica"
      description="Hardware, modelos, rutas, audio y privacidad del entorno local."
      action={
        <button
          className="primary-btn"
          onClick={saveSettings}
        >
          <Icon name="check" size={17} />
          Guardar cambios
        </button>
      }
    >
      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="setting-section-head">
            <span>
              <Icon name="settings" />
              Motor de inferencia
            </span>
            <b>DIRECTML ACTIVO</b>
          </div>
          <div className="config-grid">
            <label>
              Proveedor principal
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                <option>DmlExecutionProvider</option>
                <option>CPUExecutionProvider</option>
              </select>
            </label>
            <label>
              Dispositivo DirectML
              <select>
                <option>GPU 0 · AMD Radeon</option>
                <option>GPU 1 · Adaptador secundario</option>
              </select>
            </label>
            <Range
              label="LÍMITE DE VRAM"
              value={vram}
              min={2}
              max={32}
              step={1}
              display={`${vram} GB`}
              onChange={setVram}
            />
            <Range
              label="HILOS DE CPU"
              value={threads}
              min={2}
              max={24}
              step={1}
              display={`${threads}`}
              onChange={setThreads}
            />
          </div>
          <div className="setting-section-head separated">
            <span>
              <Icon name="folder" />
              Rutas de trabajo
            </span>
            <b>VERIFICADAS</b>
          </div>
          <div className="path-list">
            <label>
              Proyecto
              <input defaultValue="C:\\antigravityAS\\VozStudio-Omni-ES" />
            </label>
            <label>
              Modelos enlazados
              <input defaultValue="C:\\antigravityAS\\Modelos -ai-brains" />
            </label>
            <label>
              Biblioteca auditada
              <input defaultValue="C:\\antigravityAS\\VozStudio-Omni-ES\\biblioteca" />
            </label>
          </div>
          <div className="setting-section-head separated">
            <span>
              <Icon name="wave" />
              Salida de audio
            </span>
          </div>
          <div className="config-grid">
            <label>
              Sample rate
              <select>
                <option>24 kHz · Producción</option>
                <option>22.05 kHz · Piper</option>
                <option>16 kHz · Ligero</option>
              </select>
            </label>
            <label>
              Formato
              <select>
                <option>WAV · PCM 16-bit</option>
                <option>WAV · PCM 24-bit</option>
              </select>
            </label>
            <label>
              Normalización
              <select>
                <option>Pico -1 dBFS</option>
                <option>-16 LUFS Streaming</option>
              </select>
            </label>
            <label>
              Crossfade
              <select>
                <option>Activado · 12 ms</option>
                <option>Desactivado</option>
              </select>
            </label>
          </div>
        </section>
        <aside className="settings-side">
          <section className="panel privacy-panel">
            <div className="setting-section-head">
              <span>
                <Icon name="check" />
                Privacidad
              </span>
            </div>
            <Toggle
              label="Modo 100% offline"
              detail="Bloquea cualquier conexión externa"
              value={offline}
              onChange={setOffline}
            />
            <Toggle
              label="Auditoría JSON automática"
              detail="Metadatos junto a cada WAV"
              value={audit}
              onChange={setAudit}
            />
            <Toggle
              label="Fallback CPU seguro"
              detail="Conmuta si DirectML falla"
              value={true}
              onChange={() => undefined}
            />
          </section>
          <section className="panel model-health">
            <div className="setting-section-head">
              <span>
                <Icon name="layers" />
                Estado de modelos
              </span>
              <b>8/8</b>
            </div>
            {models.map((model, index) => {
              const engine = toVisualEngine(model, index)
              return (
              <div key={engine.id}>
                <i style={{ background: engine.color }} />
                <span>
                  <strong>{engine.name}</strong>
                  <small>{engine.provider}</small>
                </span>
                <b>{engine.size}</b>
              </div>
              )
            })}
          </section>
        </aside>
      </div>
    </Page>
  )
}

export function AlternativesPage({
  notify,
  selected,
  onSelect,
  onOpenStudio,
}: {
  notify: (message: string) => void
  selected: string
  onSelect: (concept: string) => void
  onOpenStudio: () => void
}) {
  const concepts = [
    {
      id: "A",
      name: "Command Deck",
      subtitle: "Evolución natural del estudio actual",
      description:
        "Tres zonas permanentes: recursos, creación e inspección. Más aire, jerarquía y controles progresivos sin ocultar información técnica.",
      strengths: [
        "Visión completa",
        "Aprendizaje inmediato",
        "Ideal para 16:9",
      ],
    },
    {
      id: "B",
      name: "Focus Canvas",
      subtitle: "Producción centrada en el guion",
      description:
        "El editor y la forma de onda dominan el lienzo. Motores, voces y biblioteca aparecen en paneles contextuales plegables.",
      strengths: [
        "Máxima concentración",
        "Texto más grande",
        "Menos ruido visual",
      ],
    },
    {
      id: "C",
      name: "Flow Timeline",
      subtitle: "Flujo de producción por etapas",
      description:
        "Organiza el trabajo como una cadena: fuente, voz, dirección, proceso y exportación. Especialmente eficaz para proyectos y lotes.",
      strengths: ["Proceso evidente", "Escalable a lotes", "Historial visible"],
    },
    {
      id: "D",
      name: "Task Workbench",
      subtitle: "Una tarea principal cada vez",
      description:
        "Convierte Síntesis, Zero-Shot y DNA en espacios de trabajo dedicados. Los recursos permanecen en cajones inferiores amplios y legibles.",
      strengths: [
        "Controles más grandes",
        "Menos distracciones",
        "Flujo experto",
      ],
    },
    {
      id: "E",
      name: "Voice First",
      subtitle: "La voz como punto de partida",
      description:
        "Presenta motores y timbres como una gran matriz de selección antes del área creativa. Ideal cuando se comparan muchas voces y regiones.",
      strengths: [
        "Catálogo protagonista",
        "Comparación rápida",
        "Mejor descubrimiento",
      ],
    },
  ]

  return (
    <Page
      title="Alternativas del Estudio Neural"
      description="Tres direcciones visuales antes de modificar el espacio de producción principal."
      action={
        <div className="concept-selection">
          <span>CONCEPTO ACTIVO</span>
          <strong>{selected}</strong>
        </div>
      }
    >
      <div className="concept-grid">
        {concepts.map((concept) => (
          <article
            className={`concept-card ${
              selected === concept.id ? "selected" : ""
            }`}
            key={concept.id}
          >
            <header>
              <span>CONCEPTO {concept.id}</span>
              <b>{concept.name}</b>
              <small>{concept.subtitle}</small>
            </header>

            {concept.id === "A" && (
              <div className="concept-preview command-preview">
                <div className="mini-top">
                  <i />
                  <span />
                  <span />
                  <b />
                </div>
                <div className="mini-command-body">
                  <aside>
                    <strong>MOTORES</strong>
                    <div className="mini-engine-grid">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <i key={i} />
                      ))}
                    </div>
                    <strong>VOCES</strong>
                    <span />
                    <span />
                    <span />
                  </aside>
                  <main>
                    <nav>
                      <b />
                      <i />
                      <i />
                    </nav>
                    <div className="mini-script">
                      <small />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="mini-controls">
                      <i />
                      <i />
                      <b />
                    </div>
                    <Waveform compact />
                  </main>
                  <aside>
                    <strong>BIBLIOTECA</strong>
                    <span />
                    <span />
                    <span />
                    <div className="mini-specs">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <i key={i} />
                      ))}
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {concept.id === "B" && (
              <div className="concept-preview focus-preview">
                <div className="focus-rail">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <i key={i} />
                  ))}
                </div>
                <main>
                  <div className="focus-head">
                    <span />
                    <span />
                    <b />
                  </div>
                  <div className="focus-title">
                    <small />
                    <strong />
                  </div>
                  <div className="focus-editor">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="focus-wave">
                    <Waveform compact />
                  </div>
                </main>
                <aside>
                  <strong />
                  <span />
                  <span />
                  <span />
                  <b />
                </aside>
              </div>
            )}

            {concept.id === "C" && (
              <div className="concept-preview flow-preview">
                <div className="flow-head">
                  <i />
                  <span />
                  <b />
                </div>
                <div className="flow-steps">
                  {["FUENTE", "TIMBRE", "DIRECCIÓN", "PROCESO", "SALIDA"].map(
                    (step, i) => (
                      <div className={i === 2 ? "active" : ""} key={step}>
                        <i>{i + 1}</i>
                        <span>{step}</span>
                      </div>
                    ),
                  )}
                </div>
                <div className="flow-workspace">
                  <aside>
                    <span />
                    <span />
                    <span />
                  </aside>
                  <main>
                    <small />
                    <span />
                    <span />
                    <span />
                    <div className="flow-wave">
                      <Waveform compact />
                    </div>
                  </main>
                </div>
              </div>
            )}

            {concept.id === "D" && (
              <div className="concept-preview task-preview">
                <div className="task-tabs">
                  <b />
                  <span />
                  <span />
                  <i />
                </div>
                <main>
                  <div className="task-heading">
                    <small />
                    <strong />
                  </div>
                  <div className="task-editor">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="task-command">
                    <i />
                    <i />
                    <b />
                  </div>
                  <div className="task-wave">
                    <Waveform compact />
                  </div>
                </main>
                <div className="task-drawers">
                  <div>
                    <strong />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div>
                    <strong />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {concept.id === "E" && (
              <div className="concept-preview voice-first-preview">
                <div className="vf-head">
                  <i />
                  <span />
                  <b />
                </div>
                <div className="vf-catalog">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div className={i === 2 ? "active" : ""} key={i}>
                      <i />
                      <span />
                      <small />
                    </div>
                  ))}
                </div>
                <div className="vf-work">
                  <main>
                    <span />
                    <span />
                    <span />
                    <div>
                      <Waveform compact />
                    </div>
                  </main>
                  <aside>
                    <strong />
                    <span />
                    <span />
                    <b />
                  </aside>
                </div>
              </div>
            )}

            <div className="concept-copy">
              <p>{concept.description}</p>
              <div>
                {concept.strengths.map((strength) => (
                  <span key={strength}>
                    <Icon name="check" size={12} />
                    {strength}
                  </span>
                ))}
              </div>
            </div>
            <button
              className={selected === concept.id ? "concept-chosen" : ""}
              onClick={() => {
                onSelect(concept.id)
                notify(`Concepto ${concept.id} · ${concept.name} seleccionado`)
              }}
            >
              <Icon
                name={selected === concept.id ? "check" : "arrow"}
                size={16}
              />
              {selected === concept.id
                ? "Concepto seleccionado"
                : "Seleccionar dirección"}
            </button>
            {selected === concept.id && (
              <button className="open-live-studio" onClick={onOpenStudio}>
                <Icon name="wave" size={16} />
                Ver contenido real en Estudio Neural
              </button>
            )}
          </article>
        ))}
      </div>
      <section className="concept-note">
        <Icon name="wand" />
        <div>
          <strong>
            Estas alternativas son exploraciones, no reemplazos definitivos.
          </strong>
          <p>
            La opción elegida se desarrollará después con todos los motores,
            voces, configuraciones, DSP, biblioteca y auditoría ya incorporados.
          </p>
        </div>
      </section>
    </Page>
  )
}

function Toggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string
  detail: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button className="toggle-row" onClick={() => onChange(!value)}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <i className={value ? "on" : ""}>
        <b />
      </i>
    </button>
  )
}

function SplashScreen({ onStart }: { onStart: () => void }) {
  const [closing, setClosing] = useState(false)

  const startApp = () => {
    setClosing(true)
    window.setTimeout(onStart, 620)
  }

  return (
    <div className={`splash-screen ${closing ? "closing" : ""}`}>
      <div className="splash-glow" />
      <div className="splash-wave splash-wave-one" aria-hidden="true">
        {[0, 1].map((copy) => (
          <svg key={copy} viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path
              d="M0,100 C150,250 300,-50 500,100 C700,250 850,-50 1000,100"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M0,100 C200,180 300,20 500,100 C700,180 800,20 1000,100"
              fill="none"
              stroke="#ffb700"
              strokeWidth="1"
              strokeLinecap="round"
              opacity=".5"
            />
          </svg>
        ))}
      </div>
      <div className="splash-wave splash-wave-two" aria-hidden="true">
        {[0, 1].map((copy) => (
          <svg key={copy} viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path
              d="M0,100 C250,-80 350,280 500,100 C650,-80 750,280 1000,100"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        ))}
      </div>

      <div className="splash-content">
        <div className="splash-core splash-reveal-one">
          <div className="splash-ring ring-outer" />
          <div className="splash-ring ring-inner" />
          <svg
            overflow="visible"
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <line
              x1="-10"
              y1="50"
              x2="110"
              y2="50"
              stroke="rgba(0,229,255,.15)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {[
              [18, 35, 30],
              [31, 20, 60],
              [44, 10, 80],
              [57, 25, 50],
              [70, 15, 70],
              [83, 30, 40],
            ].map(([x, y, height], index) => (
              <rect
                className={`splash-eq-bar splash-bar-${index + 1}`}
                key={x}
                x={x}
                y={y}
                width="6"
                height={height}
                rx="3"
                fill="#00e5ff"
              />
            ))}
          </svg>
        </div>

        <div className="splash-brand splash-reveal-two">
          <h1>
            VOZ<span>STUDIO</span>
          </h1>
          <h2>Producción de Voz Neuronal en Español</h2>
        </div>

        <button
          className="splash-start splash-reveal-five"
          onClick={startApp}
          aria-label="Iniciar VozStudio"
        >
          <i aria-hidden="true" />
          <span>
            <strong>INICIAR</strong>
            <Icon name="arrow" size={17} />
          </span>
        </button>

        <div className="splash-loader splash-reveal-three">
          <i />
        </div>
        <p className="splash-credit splash-reveal-four">
          Human AI Synergy <b>By Benner Castillo</b>
        </p>
      </div>
    </div>
  )
}

function SidebarAnimatedHeader() {
  return (
    <div className="sidebar-animated-header">
      <div className="sidebar-brand-wave" aria-hidden="true">
        <svg viewBox="0 0 500 100" preserveAspectRatio="none">
          <path
            d="M0,50 C75,120 150,-20 250,50 C350,120 425,-20 500,50"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="2"
          />
          <path
            d="M0,50 C100,88 150,12 250,50 C350,88 400,12 500,50"
            fill="none"
            stroke="#ffb700"
            strokeWidth="1"
            opacity=".55"
          />
        </svg>
        <svg viewBox="0 0 500 100" preserveAspectRatio="none">
          <path
            d="M0,50 C75,120 150,-20 250,50 C350,120 425,-20 500,50"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="2"
          />
          <path
            d="M0,50 C100,88 150,12 250,50 C350,88 400,12 500,50"
            fill="none"
            stroke="#ffb700"
            strokeWidth="1"
            opacity=".55"
          />
        </svg>
      </div>
      <div className="sidebar-brand-primary">
        <div className="sidebar-neural-mark">
          <div className="sidebar-logo-ring ring-one" />
          <div className="sidebar-logo-ring ring-two" />
          <svg
            overflow="visible"
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <line
              x1="5"
              y1="50"
              x2="95"
              y2="50"
              stroke="rgba(0,229,255,.15)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {[
              [18, 35, 30],
              [31, 20, 60],
              [44, 10, 80],
              [57, 25, 50],
              [70, 15, 70],
              [83, 30, 40],
            ].map(([x, y, height], index) => (
              <rect
                className={`splash-eq-bar splash-bar-${index + 1}`}
                key={x}
                x={x}
                y={y}
                width="6"
                height={height}
                rx="3"
                fill="#00e5ff"
              />
            ))}
          </svg>
        </div>
        <strong className="sidebar-app-name">
          VOZ<span>STUDIO</span>
        </strong>
      </div>
      <div className="sidebar-brand-copy">
        <small>Producción de voz neuronal</small>
        <b>OMNI-ES · LOCAL</b>
      </div>
    </div>
  )
}

function Page({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <header className="page-head compact-head">
        <div>
          <p className="eyebrow">VOZSTUDIO OMNI</p>
          <h1>{title}</h1>
          <p className="subtitle">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </>
  )
}

export default function App() {
  const [page, setPage] = useState("Estudio neural")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState("")
  const [backendOnline, setBackendOnline] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [theme, setTheme] = useState(() => loadLocal("vozstudio-theme", "omni"))
  const cpu = useMemo(() => 42, [])

  useEffect(() => {
    window.localStorage.setItem("vozstudio-theme", JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    let mounted = true
    const probeBackend = async () => {
      try {
        const response = await fetch("/api/v1/system/status")
        if (mounted) setBackendOnline(response.ok)
      } catch {
        if (mounted) setBackendOnline(false)
      }
    }
    void probeBackend()
    const interval = window.setInterval(() => void probeBackend(), 8000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const navigate = (next: string) => {
    setPage(next)
    setSidebarOpen(false)
    if (next === "Proyectos") {
      setToast("Espacio de proyectos abierto")
      window.setTimeout(() => setToast(""), 2200)
    }
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <SidebarAnimatedHeader />
        <div className="workspace-switch">
          <span className="workspace-avatar">BC</span>
          <div>
            <small>ESPACIO DE TRABAJO</small>
            <strong>Benner Studio</strong>
          </div>
          <Icon name="chevron" size={16} />
        </div>
        <nav>
          {nav.map((item) => (
            <button
              className={page === item.label ? "active" : ""}
              key={item.label}
              onClick={() => navigate(item.label)}
            >
              <span className="nav-icon">
                <Icon name={item.icon} size={20} />
              </span>
              {item.label}
              {item.count && <em>{item.count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card">
            <header>
              <span>
                <i />
                SISTEMA LOCAL
              </span>
              <strong>Óptimo</strong>
            </header>
            <div>
              <span>GPU · DirectML</span>
              <b>68%</b>
            </div>
            <div className="meter">
              <i />
            </div>
            <div>
              <span>RAM · 13.4 / 32 GB</span>
              <b>{cpu}%</b>
            </div>
            <div className="meter ram">
              <i />
            </div>
          </div>
          <button
            className="side-settings"
            onClick={() => navigate("Configuración")}
          >
            <Icon name="settings" />
            Configuración
          </button>
          <div className="profile">
            <span className="profile-avatar">BC</span>
            <div>
              <strong>Benner Castillo</strong>
              <small>Plan Studio Pro</small>
            </div>
            <Icon name="more" />
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <main>
        <div className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>
            <Icon name="layers" />
          </button>
          <div className="global-search">
            <Icon name="search" size={18} />
            <input placeholder="Buscar voces, proyectos o archivos..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <label className="theme-switcher" title="Tema visual">
              <Icon name="wand" size={16} />
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                aria-label="Seleccionar tema visual"
              >
                <option value="omni">Omni Cyan</option>
                <option value="violet">Neural Violet</option>
                <option value="ember">Ember Studio</option>
                <option value="ice">Ice Graphite</option>
                <option value="emerald">Emerald Matrix</option>
                <option value="crimson">Crimson Noir</option>
                <option value="cobalt">Cobalt Electric</option>
                <option value="mono">Graphite Mono</option>
                <option value="light">Pearl Light</option>
                <option value="amoled">AMOLED Black</option>
              </select>
            </label>
            <span className={`online ${backendOnline ? "" : "offline"}`}>
              <i />
              {backendOnline ? "DirectML · local online" : "Offline preview"}
            </span>
            <button
              className="icon-btn"
              onClick={() => navigate("Configuración")}
            >
              <Icon name="bell" size={19} />
            </button>
            <button className="icon-btn">
              <Icon name="settings" size={19} />
            </button>
          </div>
        </div>
        <div
          className={`content ${
            page === "Estudio neural"
              ? "studio-content"
              : page === "Presets"
                ? "presets-content"
                : ""
          }`}
        >
          {page === "Inicio" && <Dashboard onNavigate={navigate} />}
          {page === "Estudio neural" && <StudioPage notify={notify} />}
          {page === "DNA Design" && <DnaDesignPage notify={notify} />}
          {page === "Proyectos" && <ProjectsPage />}
          {page === "Mis voces" && <VoicesPage onNavigate={navigate} notify={notify} />}
          {page === "Clonación en lote" && <BatchPage notify={notify} />}
          {page === "Diseño de voz" && <BatchPage design notify={notify} />}
          {page === "Presets" && <PresetsPage onNavigate={navigate} notify={notify} />}
          {page === "Configuración" && <SettingsPage notify={notify} />}
        </div>
        <footer className="app-footer">
          <span>HUMAN AI SYNERGY BY BENNER CASTILLO</span>
          <b>VOZSTUDIO OMNI-ES</b>
        </footer>
      </main>
      {toast && (
        <div className="toast">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {showSplash && <SplashScreen onStart={() => setShowSplash(false)} />}
    </div>
  )
}
