// VozStudio Atlas - Cliente API y adaptadores de conexion local.
// Gestiona la deteccion automatica del backend (HTTP vs file://), llamadas REST
// y reproduccion de audio HTML5 con cancelacion de instancias previas.

const FALLBACK_API_ORIGIN = 'http://127.0.0.1:8880';
let activeAudioInstance = null;

/**
 * Detecta si la aplicacion se ejecuta desde el protocolo file:// o contexto local sin servidor web.
 */
export function isLocalFileOrigin() {
  if (typeof window === 'undefined' || !window.location) return true;
  const protocol = window.location.protocol;
  const origin = window.location.origin;
  return protocol === 'file:' || !origin || origin === 'null';
}

/**
 * Devuelve la URL base de la API REST v1.
 * Retorna '/api/v1' si se sirve por HTTP o 'http://127.0.0.1:8880/api/v1' en caso de file:// o dev server.
 */
export function getApiBase() {
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, origin, port } = window.location;
    if ((protocol === 'http:' || protocol === 'https:') && origin && origin !== 'null') {
      if (port === '8880' || port === '') {
        return '/api/v1';
      }
    }
  }
  return `${FALLBACK_API_ORIGIN}/api/v1`;
}

/**
 * Resuelve una URL relativa de audio asegurando que funcione tanto en HTTP como en file://.
 */
export function resolveAudioUrl(url) {
  if (!url) return '';
  if (/^(?:https?:|blob:|data:)/i.test(url)) return url;
  const base = getApiBase();
  if (base.startsWith('http')) {
    const origin = base.replace(/\/api\/v1\/?$/, '');
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
}

/**
 * Comprueba si el backend local de VozStudio esta activo y respondiendo.
 * Ejecuta una peticion con timeout de 2.5 segundos a /system/status.
 */
export async function checkBackendHealth() {
  const base = getApiBase();
  const url = `${base}/system/status`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch (_err) {
    return false;
  }
}

/**
 * Consulta la telemetria actual de hardware, modelos cargados y estado del backend.
 */
export async function apiGetSystemStatus() {
  const base = getApiBase();
  const url = `${base}/system/status`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error ${res.status}: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Obtiene el listado completo de audios generados y almacenados en la biblioteca.
 */
export async function apiListLibrary() {
  const base = getApiBase();
  const url = `${base}/library`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((item) => ({
    ...item,
    audio_url: resolveAudioUrl(item.audio_url || `/api/v1/library/${item.id}/audio`),
  }));
}

/**
 * Envia solicitud de sintesis neuronal al endpoint POST /api/v1/synthesize.
 * Retorna { audio_url, metricas, item }.
 */
export async function apiSynthesize(payload = {}) {
  const base = getApiBase();
  const url = `${base}/synthesize`;

  const body = {
    text: String(payload.text || '').trim(),
    engine_id: String(payload.engine_id || 'kokoro').trim().toLowerCase(),
    voice_id: String(payload.voice_id || 'ef_dora').trim(),
    speed: typeof payload.speed === 'number' ? payload.speed : 1.0,
    pitch_semitones: typeof payload.pitch_semitones === 'number' ? payload.pitch_semitones : 0.0,
    emotion: payload.emotion ? String(payload.emotion).trim() : null,
    max_chunk_chars: typeof payload.max_chunk_chars === 'number' ? payload.max_chunk_chars : 280,
    voice_design_prompt: payload.voice_design_prompt ? String(payload.voice_design_prompt).trim() : null,
    instruct_prompt: payload.instruct_prompt ? String(payload.instruct_prompt).trim() : null,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.detail || `Error ${res.status}: ${res.statusText}`;
    throw new Error(message);
  }

  const data = await res.json();
  const item = data.item || data;
  const rawAudioUrl = item.audio_url || (item.id ? `/api/v1/library/${item.id}/audio` : '');
  const resolvedUrl = resolveAudioUrl(rawAudioUrl);

  const formattedItem = {
    ...item,
    audio_url: resolvedUrl,
  };

  return {
    audio_url: resolvedUrl,
    metricas: item.metricas || {},
    item: formattedItem,
  };
}

/**
 * Detiene cualquier audio en reproduccion activa.
 */
export function apiStopAudio() {
  if (activeAudioInstance) {
    try {
      activeAudioInstance.pause();
      activeAudioInstance.currentTime = 0;
      activeAudioInstance.src = '';
    } catch (_err) {
      // Audio ya revocado
    }
    activeAudioInstance = null;
  }
}

/**
 * Reproduce un archivo de audio mediante HTML5 Audio, deteniendo de forma segura cualquier pista previa.
 */
export function apiPlayAudio(url) {
  apiStopAudio();

  if (!url) return null;

  const targetUrl = resolveAudioUrl(url);
  const audio = new Audio(targetUrl);
  activeAudioInstance = audio;

  audio.addEventListener('ended', () => {
    if (activeAudioInstance === audio) {
      activeAudioInstance = null;
    }
  });

  audio.addEventListener('error', () => {
    if (activeAudioInstance === audio) {
      activeAudioInstance = null;
    }
  });

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch((err) => {
      console.warn('Reproduccion bloqueada o fallida:', err);
      if (activeAudioInstance === audio) {
        activeAudioInstance = null;
      }
    });
  }

  return audio;
}

/**
 * Obtiene la instancia HTML5 Audio actualmente en reproduccion o null.
 */
export function getActiveAudio() {
  return activeAudioInstance;
}
