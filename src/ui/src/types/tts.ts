export type RegionBadge = 'ES' | 'MX' | 'AR' | 'LATAM' | 'MULTI';
export type GenderBadge = 'FEM' | 'MASC' | 'MIX';

export interface HardwareMetrics {
  ram_total_gb: number;
  ram_used_gb: number;
  ram_available_gb: number;
  process_rss_mb: number;
  vram_limit_gb: number;
  cpu_threads: number;
  dml_available: boolean;
  available_providers: string[];
}

export interface SystemStatus {
  app: string;
  version: string;
  active_engine: string | null;
  active_provider: string | null;
  estimated_engine_mb: number;
  hardware: HardwareMetrics;
}

export interface EngineInfo {
  id: string;
  name: string;
  category: string;
  available: boolean;
  active: boolean;
  license: string;
  estimated_mb: number;
  availability_note: string;
  voices_count: number;
  description: string;
}

export interface VoiceInfo {
  id: string;
  name: string;
  engine: string;
  region: string;
  gender: string;
  sample_rate: number;
  quality: string;
  description: string;
  supports_cloning: boolean;
  supports_emotion: boolean;
  is_custom?: boolean;
  is_default?: boolean;
  prompt_utilizado?: string;
}

export interface EnhancePromptResult {
  original_prompt: string;
  enhanced_prompt: string;
  engine_used: string;
}

export interface DnaSynthesisPayload {
  text: string;
  engine_id: string;
  mode: 'voice_design' | 'instruct_tts';
  voice_design_prompt?: string;
  instruct_prompt?: string;
  voice_id?: string;
  speed: number;
  temperature?: number;
  save_as_custom?: boolean;
  custom_voice_name?: string;
  custom_voice_region?: string;
}

export interface UpdateVoiceMetadataPayload {
  name?: string;
  description?: string;
  region?: string;
  gender?: string;
  reference_text?: string;
  prompt_utilizado?: string;
}

export interface LibraryMetrics {
  caracteres_entrada?: number;
  fragmentos?: number;
  duracion_audio_seg?: number;
  tiempo_inferencia_ms?: number;
  rtf?: number;
  pico_memoria_mb?: number;
  [key: string]: unknown;
}

export interface LibraryItem {
  id: string;
  archivo: string;
  json_archivo?: string;
  audio_url: string;
  modelo_origen: string;
  motor: string;
  voz_id: string;
  parametros: Record<string, unknown>;
  prompt_original: string;
  metricas: LibraryMetrics;
  contexto: Record<string, unknown>;
}

export interface SynthesizePayload {
  text: string;
  engine_id: string;
  voice_id: string | null;
  speed: number;
  pitch_semitones: number;
  emotion: string | null;
}

export interface ClonePayload {
  text: string;
  engine_id: string;
  voice_id: string | null;
  reference_text: string;
  speed: number;
  emotion: string | null;
  reference_audio?: File | null;
}

export interface NormalizePreviewResponse {
  segments: string[];
  total_chars: number;
  segments_count: number;
}
