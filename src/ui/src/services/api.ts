import type {
  ClonePayload,
  DnaSynthesisPayload,
  EngineInfo,
  EnhancePromptResult,
  LibraryItem,
  NormalizePreviewResponse,
  SynthesizePayload,
  SystemStatus,
  UpdateVoiceMetadataPayload,
  VoiceInfo,
} from '../types/tts';

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface VocalCleanMetrics {
  duracion_seg: number;
  pico_original: number;
  pico_final: number;
  filtros_aplicados: string[];
  sample_rate: number;
}

export interface VocalCleanResult {
  audio_url: string;
  metrics: VocalCleanMetrics;
}


async function fetchJson<T>(
  input: string,
  init?: RequestInit,
  timeoutMs: number = 6000,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `Error HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as { detail?: unknown; message?: string };
        if (typeof errBody.detail === 'string') {
          detail = errBody.detail;
        } else if (typeof errBody.message === 'string') {
          detail = errBody.message;
        }
      } catch {
        // Mantener mensaje HTTP por defecto si la respuesta no es JSON
      }
      throw new ApiError(detail, response.status);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export const studioApi = {
  async getSystemStatus(): Promise<SystemStatus> {
    return fetchJson<SystemStatus>('/api/v1/system/status', { method: 'GET' }, 2200);
  },

  async getEngines(): Promise<EngineInfo[]> {
    const res = await fetchJson<{ engines: EngineInfo[] }>('/api/v1/engines', { method: 'GET' }, 4000);
    return Array.isArray(res.engines) ? res.engines : [];
  },

  async getVoices(engineId: string): Promise<VoiceInfo[]> {
    const params = new URLSearchParams({ engine_id: engineId });
    const res = await fetchJson<{ voices: VoiceInfo[] }>(
      `/api/v1/voices?${params.toString()}`,
      { method: 'GET' },
      4000,
    );
    return Array.isArray(res.voices) ? res.voices : [];
  },

  async synthesize(payload: SynthesizePayload): Promise<LibraryItem> {
    const res = await fetchJson<{ item: LibraryItem }>(
      '/api/v1/synthesize',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      120000,
    );
    return res.item;
  },

  async cloneVoice(payload: ClonePayload): Promise<LibraryItem> {
    const formData = new FormData();
    formData.append('text', payload.text);
    formData.append('engine_id', payload.engine_id);
    if (payload.voice_id) {
      formData.append('voice_id', payload.voice_id);
    }
    formData.append('reference_text', payload.reference_text);
    formData.append('speed', String(payload.speed));
    if (payload.emotion) {
      formData.append('emotion', payload.emotion);
    }
    if (payload.reference_audio) {
      formData.append('reference_audio', payload.reference_audio);
    }

    const res = await fetchJson<{ item: LibraryItem }>(
      '/api/v1/clone',
      {
        method: 'POST',
        body: formData,
      },
      180000,
    );
    return res.item;
  },

  async normalizePreview(text: string, maxChars: number = 460): Promise<NormalizePreviewResponse> {
    return fetchJson<NormalizePreviewResponse>(
      '/api/v1/normalize-preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, max_chars: maxChars }),
      },
      5000,
    );
  },

  async getLibrary(engineId: string = '', query: string = ''): Promise<LibraryItem[]> {
    const params = new URLSearchParams();
    if (engineId.trim()) params.set('engine_id', engineId.trim());
    if (query.trim()) params.set('query', query.trim());
    const qs = params.toString();
    const url = qs ? `/api/v1/library?${qs}` : '/api/v1/library';
    const res = await fetchJson<{ items: LibraryItem[] }>(
      url,
      { method: 'GET' },
      5000,
    );
    return Array.isArray(res.items) ? res.items : [];
  },

  async deleteLibraryItem(id: string): Promise<{ deleted: boolean; id: string }> {
    return fetchJson<{ deleted: boolean; id: string }>(
      `/api/v1/library/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      5000,
    );
  },

  async unloadEngines(): Promise<{ unloaded: boolean }> {
    return fetchJson<{ unloaded: boolean }>(
      '/api/v1/engines/unload',
      { method: 'POST' },
      8000,
    );
  },

  async cleanVocalAudio(
    audioFile: File | Blob,
    options: {
      removeNoise?: boolean;
      antiNasal?: boolean;
      deEsser?: boolean;
      enhancePresence?: boolean;
      targetPeak?: number;
    } = {},
  ): Promise<VocalCleanResult> {
    const formData = new FormData();
    formData.append('audio_file', audioFile, 'sample.wav');
    formData.append('remove_noise', String(options.removeNoise ?? true));
    formData.append('anti_nasal', String(options.antiNasal ?? true));
    formData.append('de_esser', String(options.deEsser ?? true));
    formData.append('enhance_presence', String(options.enhancePresence ?? true));
    formData.append('target_peak', String(options.targetPeak ?? 0.89));

    return fetchJson<VocalCleanResult>(
      '/api/v1/dsp/clean-voice',
      {
        method: 'POST',
        body: formData,
      },
      30000,
    );
  },

  async saveCustomVoice(payload: {
    engineId: string;
    name: string;
    gender?: string;
    region?: string;
    description?: string;
    referenceText?: string;
    prompt_utilizado?: string;
    referenceAudio?: File | Blob;
    referenceAudioUrl?: string;
  }): Promise<VoiceInfo> {
    const formData = new FormData();
    formData.append('engine_id', payload.engineId);
    formData.append('name', payload.name);
    if (payload.gender) formData.append('gender', payload.gender);
    if (payload.region) formData.append('region', payload.region);
    if (payload.description) formData.append('description', payload.description);
    if (payload.referenceText) formData.append('reference_text', payload.referenceText);
    if (payload.prompt_utilizado) formData.append('prompt_utilizado', payload.prompt_utilizado);
    if (payload.referenceAudio) {
      formData.append('reference_audio', payload.referenceAudio, 'ref.wav');
    }
    if (payload.referenceAudioUrl) {
      formData.append('reference_audio_url', payload.referenceAudioUrl);
    }
    return fetchJson<VoiceInfo>(
      '/api/v1/voices/custom',
      {
        method: 'POST',
        body: formData,
      },
      30000,
    );
  },

  async updateCustomVoice(voiceId: string, metadata: UpdateVoiceMetadataPayload): Promise<VoiceInfo> {
    return fetchJson<VoiceInfo>(
      `/api/v1/voices/custom/${encodeURIComponent(voiceId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      },
      10000,
    );
  },

  async enhancePrompt(
    prompt: string,
    mode: 'voice_design' | 'instruct_tts' = 'voice_design',
  ): Promise<EnhancePromptResult> {
    return fetchJson<EnhancePromptResult>(
      '/api/v1/dna/enhance-prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      },
      30000,
    );
  },

  async synthesizeDna(
    payload: DnaSynthesisPayload,
  ): Promise<{ item: LibraryItem; saved_voice?: VoiceInfo | null }> {
    const formData = new FormData();
    formData.append('text', payload.text);
    formData.append('engine_id', payload.engine_id);
    formData.append('mode', payload.mode);
    if (payload.voice_design_prompt) {
      formData.append('voice_design_prompt', payload.voice_design_prompt);
    }
    if (payload.instruct_prompt) {
      formData.append('instruct_prompt', payload.instruct_prompt);
    }
    if (payload.voice_id) {
      formData.append('voice_id', payload.voice_id);
    }
    formData.append('speed', String(payload.speed));
    if (payload.temperature !== undefined) {
      formData.append('temperature', String(payload.temperature));
    }
    if (payload.save_as_custom) {
      formData.append('save_as_custom', 'true');
    }
    if (payload.custom_voice_name) {
      formData.append('custom_voice_name', payload.custom_voice_name);
    }
    if (payload.custom_voice_region) {
      formData.append('custom_voice_region', payload.custom_voice_region);
    }

    return fetchJson<{ item: LibraryItem; saved_voice?: VoiceInfo | null }>(
      '/api/v1/dna/synthesize',
      {
        method: 'POST',
        body: formData,
      },
      180000,
    );
  },

  async deleteCustomVoice(voiceId: string): Promise<{ deleted: boolean; voice_id: string }> {
    return fetchJson<{ deleted: boolean; voice_id: string }>(
      `/api/v1/voices/custom/${encodeURIComponent(voiceId)}`,
      { method: 'DELETE' },
      8000,
    );
  },
};
