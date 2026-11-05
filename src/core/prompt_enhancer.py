"""Optimizador neural de descripciones acusticas y estilos vocales con Phi-3.5 DirectML."""

from __future__ import annotations

import logging
from pathlib import Path
import re
import threading
import time

from src.core.config import BRAINS_SPACE_DIR, CPU_THREADS

logger = logging.getLogger(__name__)

_GENAI_LOCK = threading.Lock()
_CACHED_MODEL = None
_CACHED_TOKENIZER = None
_CACHED_DEVICE = None


def _get_phi_model_dir() -> tuple[Path | None, str]:
    """Localiza el directorio ONNX de Phi-3.5 optimizado para GPU DirectML o CPU."""
    base_dir = BRAINS_SPACE_DIR / "phi-3.5-mini-instruct-onnx"
    gpu_dir = base_dir / "gpu" / "gpu-int4-awq-block-128"
    cpu_dir = base_dir / "cpu_and_mobile" / "cpu-int4-awq-block-128-acc-level-4"

    if (gpu_dir / "model.onnx").is_file():
        return gpu_dir, "DirectML"
    if (cpu_dir / "phi-3.5-mini-instruct-cpu-int4-awq-block-128-acc-level-4.onnx").is_file():
        return cpu_dir, "CPU"
    return None, "None"


def _load_phi_session():
    """Carga o reutiliza la sesion de onnxruntime_genai para Phi-3.5."""
    global _CACHED_MODEL, _CACHED_TOKENIZER, _CACHED_DEVICE
    if _CACHED_MODEL is not None and _CACHED_TOKENIZER is not None:
        return _CACHED_MODEL, _CACHED_TOKENIZER, _CACHED_DEVICE

    model_dir, device = _get_phi_model_dir()
    if model_dir is None:
        return None, None, None

    try:
        import onnxruntime_genai as og

        m = og.Model(str(model_dir))
        tok = og.Tokenizer(m)
        _CACHED_MODEL = m
        _CACHED_TOKENIZER = tok
        _CACHED_DEVICE = device
        return _CACHED_MODEL, _CACHED_TOKENIZER, _CACHED_DEVICE
    except Exception as exc:
        logger.warning("No se pudo cargar Phi-3.5 onnxruntime_genai (%s): %s", device, exc)
        return None, None, None


def _heuristic_enhance_voice_design(raw_prompt: str) -> str:
    """Expansion heuristica acustica para VoiceDesign si el LLM local no esta disponible."""
    text = raw_prompt.strip()
    low = text.lower()

    genero = "femenina" if any(w in low for w in ("mujer", "chica", "femenina", "senora")) else "masculina"
    if "neutro" in low or "androgin" in low:
        genero = "androgina o neutra"

    edad = "madura de unos 45 a 55 anos" if any(w in low for w in ("viejo", "anciano", "maduro", "abuelo")) else "joven de unos 25 a 35 anos"
    timbre = "calido, envolvente y aterciopelado"
    if any(w in low for w in ("grave", "profundo", "bajo")):
        timbre = "profundo, con resonancia pectoral y graves solidos"
    elif any(w in low for w in ("agudo", "brillante", "claro")):
        timbre = "claro, brillante y de tesitura alta"

    cadencia = "cadencia pausada, articulacion impecable y tono reflexivo"
    if any(w in low for w in ("rapido", "dinamico", "agil", "noticias", "comercial")):
        cadencia = "cadencia dinamica, ritmo agil y proyeccion comercial energica"

    return (
        f"Voz {genero} {edad}, {timbre}, {cadencia}, con acento castellano neutro, "
        "excelente inteligibilidad y presencia acustica de estudio profesional de grabacion."
    )


def _heuristic_enhance_instruct_tts(raw_prompt: str) -> str:
    """Expansion heuristica para CosyVoice Instruct-TTS."""
    text = raw_prompt.strip()
    low = text.lower()

    if any(w in low for w in ("alegre", "feliz", "contento", "sonriente")):
        return "Habla con tono sonriente y alegre, proyectando optimismo y energia calida en cada frase."
    if any(w in low for w in ("susurr", "secreto", "misterio")):
        return "Habla susurrando con misterio e intimidad, bajando la intensidad y alargando las sibilancias."
    if any(w in low for w in ("serio", "corporativo", "formal", "documental")):
        return "Habla con tono firme, pausado y profesional, manteniendo una diccion neutral y ceremoniosa."
    if any(w in low for w in ("triste", "nostalgico", "melancolico")):
        return "Habla con modulacion melancolica y reflexiva, con pausas expresivas y respiracion tenue."

    return f"Habla con intencion clara de {text}, modulando la cadencia y expresividad de forma humana y natural."


def enhance_prompt(raw_prompt: str, mode: str = "voice_design") -> tuple[str, str]:
    """Optimiza una descripcion breve del usuario en una instruccion acustica profesional.
    
    Retorna (prompt_optimizado, motor_utilizado).
    """
    clean_in = raw_prompt.strip()
    if not clean_in:
        return "", "None"

    with _GENAI_LOCK:
        model, tokenizer, device = _load_phi_session()
        if model is not None and tokenizer is not None:
            try:
                import onnxruntime_genai as og

                if mode == "instruct_tts":
                    system_role = (
                        "Eres un director de doblaje y modulacion vocal. "
                        "Convierte la peticion del usuario en una sola oracion directa que comience con 'Habla con...' "
                        "detallando la emocion, ritmo y tono para guiar un modelo de sintesis de voz en espanol. "
                        "Devuelve exclusivamente esa oracion, sin comillas adicionales ni explicaciones."
                    )
                else:
                    system_role = (
                        "Eres un disenador acustico y fonetico de elite para sintesis neural. "
                        "Transforma la peticion del usuario en una descripcion fenotipica y timbrica precisa en espanol: "
                        "genero, edad aproximada, timbre, cadencia, acento neutro y resonancia de grabacion. "
                        "Devuelve exclusivamente un solo parrafo compacto de maximo 3 lineas sin explicaciones."
                    )

                chat_text = (
                    f"<|system|>\n{system_role}<|end|>\n"
                    f"<|user|>\n{clean_in}<|end|>\n"
                    f"<|assistant|>\n"
                )

                input_tokens = tokenizer.encode(chat_text)
                params = og.GeneratorParams(model)
                max_toks = len(input_tokens) + 110
                params.set_search_options(max_length=max_toks, temperature=0.6, top_p=0.9)

                generator = og.Generator(model, params)
                generator.append_tokens(input_tokens)

                while not generator.is_done():
                    generator.generate_next_token()

                out_tokens = generator.get_sequence(0)
                generated_part = tokenizer.decode(out_tokens[len(input_tokens):]).strip()

                # Limpieza de tokens residuales de parada y truncado
                generated_part = re.sub(r"<\|.*?\|>", "", generated_part).strip()
                generated_part = generated_part.strip('"`')

                # Si el modelo genero algo coherente de mas de 15 caracteres
                if len(generated_part) >= 15:
                    return generated_part, f"phi-3.5-mini ({device})"
            except Exception as exc:
                logger.warning("Fallo en inferencia de Phi-3.5 (%s), aplicando fallback: %s", device, exc)

    # Fallback heuristico garantizado
    if mode == "instruct_tts":
        return _heuristic_enhance_instruct_tts(clean_in), "acoustic-heuristics"
    return _heuristic_enhance_voice_design(clean_in), "acoustic-heuristics"
