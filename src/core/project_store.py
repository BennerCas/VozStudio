"""Persistencia local y auditable de proyectos de produccion de VozStudio."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Any
from uuid import uuid4


PROJECT_ID_RE = re.compile(r"^project_[a-f0-9]{32}$")
SCENE_ID_RE = re.compile(r"^scene_(?:[a-f0-9]{32}|\d{3})$")
PROJECT_SCHEMA_VERSION = 1
PROMPT_VERSION = "project-preset-v1"
SCENE_STATUSES = {"draft", "ready", "generated", "approved"}


class ProjectNotFoundError(FileNotFoundError):
    """El proyecto solicitado no existe en el almacen local."""


class ProjectValidationError(ValueError):
    """Los datos persistidos o recibidos no cumplen el contrato del proyecto."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _safe_project_id(value: str) -> str:
    project_id = str(value or "").strip()
    if not PROJECT_ID_RE.fullmatch(project_id):
        raise ProjectValidationError("Identificador de proyecto invalido.")
    return project_id


def _safe_scene_id(value: str) -> str:
    scene_id = str(value or "").strip()
    if not SCENE_ID_RE.fullmatch(scene_id):
        raise ProjectValidationError("Identificador de escena invalido.")
    return scene_id


def _new_scene(
    *,
    title: str,
    role: str,
    text: str,
    engine_id: str,
    voice_id: str | None,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": f"scene_{uuid4().hex}",
        "title": title,
        "role": role,
        "text": text,
        "engine_id": engine_id,
        "voice_id": voice_id,
        "parameters": parameters,
        "status": "draft",
        "library_item_ids": [],
    }


PROJECT_PRESETS: tuple[dict[str, Any], ...] = (
    {
        "id": "audiobook_chapter",
        "name": "Audiolibro · capitulo narrado",
        "project_type": "audiolibro",
        "description": "Capitulo con apertura, narracion principal y cierre; conserva la direccion vocal entre escenas.",
        "color": "#8b7cff",
        "memory": {
            "creative_direction": "Narracion calida, estable y cercana. Mantener continuidad de personaje y respiraciones discretas.",
            "glossary": [],
        },
        "deliverables": ["WAV por escena", "capitulo aprobado", "metadatos auditados"],
        "scenes": (
            {
                "title": "Apertura del capitulo",
                "role": "intro",
                "text": "",
                "engine_id": "cosyvoice",
                "voice_id": "cosy_nova_es",
                "parameters": {"speed": 0.9, "pitch_semitones": 0.0, "emotion": "calido"},
            },
            {
                "title": "Narracion principal",
                "role": "chapter",
                "text": "",
                "engine_id": "cosyvoice",
                "voice_id": "cosy_nova_es",
                "parameters": {"speed": 0.9, "pitch_semitones": 0.0, "emotion": "narrativo"},
            },
            {
                "title": "Cierre",
                "role": "outro",
                "text": "",
                "engine_id": "cosyvoice",
                "voice_id": "cosy_nova_es",
                "parameters": {"speed": 0.9, "pitch_semitones": 0.0, "emotion": "calido"},
            },
        ),
    },
    {
        "id": "podcast_episode",
        "name": "Podcast · episodio guiado",
        "project_type": "podcast",
        "description": "Episodio con apertura, bloque central y despedida, listo para producir por secciones.",
        "color": "#37cfa2",
        "memory": {
            "creative_direction": "Conversacion clara, humana y sin prisa. La informacion debe sonar cercana, no leida.",
            "glossary": [],
        },
        "deliverables": ["WAV de introduccion", "WAV de bloque", "WAV de cierre"],
        "scenes": (
            {
                "title": "Bienvenida",
                "role": "intro",
                "text": "",
                "engine_id": "cosyvoice",
                "voice_id": "cosy_nova_es",
                "parameters": {"speed": 1.0, "pitch_semitones": 0.0, "emotion": "neutro"},
            },
            {
                "title": "Bloque principal",
                "role": "body",
                "text": "",
                "engine_id": "cosyvoice",
                "voice_id": "cosy_nova_es",
                "parameters": {"speed": 1.0, "pitch_semitones": 0.0, "emotion": "narrativo"},
            },
            {
                "title": "Despedida y llamada a la accion",
                "role": "outro",
                "text": "",
                "engine_id": "cosyvoice",
                "voice_id": "cosy_nova_es",
                "parameters": {"speed": 1.0, "pitch_semitones": 0.0, "emotion": "calido"},
            },
        ),
    },
    {
        "id": "course_lesson",
        "name": "Curso · leccion clara",
        "project_type": "curso",
        "description": "Leccion estructurada en objetivo, explicacion y recapitulacion para e-learning o capacitacion.",
        "color": "#00c2d7",
        "memory": {
            "creative_direction": "Didactico, preciso y paciente. Pausas antes de los conceptos clave y pronunciacion limpia.",
            "glossary": [],
        },
        "deliverables": ["WAV de objetivo", "WAV de desarrollo", "WAV de repaso"],
        "scenes": (
            {
                "title": "Objetivo de la leccion",
                "role": "intro",
                "text": "",
                "engine_id": "kokoro",
                "voice_id": "es_blend_editorial",
                "parameters": {"speed": 0.95, "pitch_semitones": 0.0, "emotion": "narrativo"},
            },
            {
                "title": "Explicacion",
                "role": "body",
                "text": "",
                "engine_id": "kokoro",
                "voice_id": "es_blend_editorial",
                "parameters": {"speed": 0.95, "pitch_semitones": 0.0, "emotion": "informativo"},
            },
            {
                "title": "Resumen y siguiente paso",
                "role": "outro",
                "text": "",
                "engine_id": "kokoro",
                "voice_id": "es_blend_editorial",
                "parameters": {"speed": 0.95, "pitch_semitones": 0.0, "emotion": "calido"},
            },
        ),
    },
    {
        "id": "commercial_campaign",
        "name": "Campana · versiones de spot",
        "project_type": "campana",
        "description": "Una misma direccion de marca para cortes de 15, 30 y 60 segundos.",
        "color": "#ffb547",
        "memory": {
            "creative_direction": "Comercial contemporaneo: articulacion precisa, energia medida y remate memorable sin exageracion.",
            "glossary": [],
        },
        "deliverables": ["Corte 15 s", "Corte 30 s", "Corte 60 s", "variante aprobada"],
        "scenes": (
            {
                "title": "Spot 15 segundos",
                "role": "cut_15",
                "text": "",
                "engine_id": "qwen3_tts",
                "voice_id": "qwen3_voice_design",
                "parameters": {"speed": 1.05, "pitch_semitones": 0.5, "emotion": "expresivo", "voice_design_prompt": "Locutora elegante, segura y sobria; microfono cercano, seco y sin musica."},
            },
            {
                "title": "Spot 30 segundos",
                "role": "cut_30",
                "text": "",
                "engine_id": "qwen3_tts",
                "voice_id": "qwen3_voice_design",
                "parameters": {"speed": 1.05, "pitch_semitones": 0.5, "emotion": "expresivo", "voice_design_prompt": "Locutora elegante, segura y sobria; microfono cercano, seco y sin musica."},
            },
            {
                "title": "Spot 60 segundos",
                "role": "cut_60",
                "text": "",
                "engine_id": "qwen3_tts",
                "voice_id": "qwen3_voice_design",
                "parameters": {"speed": 1.0, "pitch_semitones": 0.5, "emotion": "expresivo", "voice_design_prompt": "Locutora elegante, segura y sobria; microfono cercano, seco y sin musica."},
            },
        ),
    },
    {
        "id": "voice_identity",
        "name": "Identidad de voz · clonacion y aprobacion",
        "project_type": "identidad_voz",
        "description": "Proyecto para preparar referencia, prueba de clonacion y muestra aprobada de una voz propia.",
        "color": "#f57878",
        "memory": {
            "creative_direction": "Preservar el timbre de referencia. No presentar la voz como aprobada hasta revisar una muestra real.",
            "glossary": [],
        },
        "deliverables": ["Referencia documentada", "muestra de prueba", "voz aprobada"],
        "scenes": (
            {
                "title": "Referencia y transcripcion",
                "role": "reference",
                "text": "Describe aqui el contenido de la referencia y su contexto de grabacion.",
                "engine_id": "f5_spanish",
                "voice_id": "f5_es_neutro_clone",
                "parameters": {"requires_reference": True, "speed": 1.0, "emotion": "neutro"},
            },
            {
                "title": "Muestra de validacion",
                "role": "validation",
                "text": "",
                "engine_id": "f5_spanish",
                "voice_id": "f5_es_neutro_clone",
                "parameters": {"requires_reference": True, "speed": 1.0, "emotion": "neutro"},
            },
            {
                "title": "Aprobacion de la voz",
                "role": "approval",
                "text": "Anota los criterios de aprobacion: inteligibilidad, timbre, ritmo y ausencia de artefactos.",
                "engine_id": "f5_spanish",
                "voice_id": "f5_es_neutro_clone",
                "parameters": {"requires_reference": True, "speed": 1.0, "emotion": "neutro"},
            },
        ),
    },
)


def list_project_presets() -> list[dict[str, Any]]:
    """Devuelve recetas de proyecto sin exponer estructuras mutables globales."""
    return deepcopy(list(PROJECT_PRESETS))


class ProjectStore:
    """Guarda un JSON por proyecto y conserva su memoria de produccion local."""

    def __init__(self, projects_dir: Path) -> None:
        self.projects_dir = Path(projects_dir).resolve()

    def _project_path(self, project_id: str) -> Path:
        safe_id = _safe_project_id(project_id)
        candidate = (self.projects_dir / f"{safe_id}.json").resolve()
        if candidate.parent != self.projects_dir:
            raise ProjectValidationError("Ruta de proyecto invalida.")
        return candidate

    def _normalize_scene(self, raw: dict[str, Any], index: int) -> dict[str, Any]:
        scene_id = str(raw.get("id") or f"scene_{index + 1:03d}")
        _safe_scene_id(scene_id)
        status = str(raw.get("status") or "draft").strip().lower()
        if status not in SCENE_STATUSES:
            status = "draft"
        return {
            "id": scene_id,
            "title": str(raw.get("title") or f"Escena {index + 1}")[:120],
            "role": str(raw.get("role") or "scene")[:40],
            "text": str(raw.get("text") or "")[:12000],
            "engine_id": str(raw.get("engine_id") or "kokoro")[:32],
            "voice_id": str(raw.get("voice_id") or "")[:64] or None,
            "parameters": dict(raw.get("parameters") or {}),
            "status": status,
            "library_item_ids": [str(item)[:128] for item in list(raw.get("library_item_ids") or raw.get("output_ids") or [])[:100]],
        }

    def _normalize_project(self, raw: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise ProjectValidationError("El archivo de proyecto no contiene un objeto JSON.")
        project_id = _safe_project_id(str(raw.get("id") or ""))
        scenes = raw.get("scenes") or []
        if not isinstance(scenes, list):
            raise ProjectValidationError("Las escenas del proyecto no son validas.")
        memory = dict(raw.get("memory") or {})
        legacy_description = str(raw.get("description") or "")
        memory.setdefault("brief", legacy_description)
        memory.setdefault("creative_direction", "")
        memory.setdefault("glossary", [])
        memory.setdefault("notes", [])
        memory.setdefault("prompt_version", PROMPT_VERSION)
        memory["glossary"] = [str(item)[:100] for item in list(memory["glossary"])[:60]]
        memory["notes"] = [str(item)[:1000] for item in list(memory["notes"])[:60]]
        return {
            "schema_version": int(raw.get("schema_version") or PROJECT_SCHEMA_VERSION),
            "id": project_id,
            "name": str(raw.get("name") or "Proyecto sin titulo")[:120],
            "description": legacy_description[:1000],
            "project_type": str(raw.get("project_type") or "produccion")[:48],
            "preset_id": str(raw.get("preset_id") or "")[:64] or None,
            "preset_version": str(raw.get("preset_version") or PROMPT_VERSION)[:64],
            "color": str(raw.get("color") or "#37cfa2")[:20],
            "scenes": [self._normalize_scene(scene, idx) for idx, scene in enumerate(scenes) if isinstance(scene, dict)],
            "deliverables": [str(item)[:160] for item in list(raw.get("deliverables") or [])[:40]],
            "settings": dict(raw.get("settings") or {}),
            "memory": memory,
            "created_at": str(raw.get("created_at") or _utc_now()),
            "updated_at": str(raw.get("updated_at") or raw.get("created_at") or _utc_now()),
        }

    def _read(self, project_id: str) -> dict[str, Any]:
        path = self._project_path(project_id)
        if not path.is_file():
            raise ProjectNotFoundError(project_id)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ProjectValidationError("No se pudo leer el proyecto persistido.") from exc
        return self._normalize_project(raw)

    def _write(self, project: dict[str, Any]) -> dict[str, Any]:
        normalized = self._normalize_project(project)
        normalized["updated_at"] = _utc_now()
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        target = self._project_path(normalized["id"])
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(target)
        return normalized

    def list_projects(self) -> list[dict[str, Any]]:
        if not self.projects_dir.is_dir():
            return []
        projects: list[dict[str, Any]] = []
        for path in self.projects_dir.glob("project_*.json"):
            try:
                projects.append(self._read(path.stem))
            except (ProjectNotFoundError, ProjectValidationError):
                continue
        return sorted(projects, key=lambda item: item["updated_at"], reverse=True)

    def get_project(self, project_id: str) -> dict[str, Any]:
        return self._read(project_id)

    def create_project(
        self,
        *,
        name: str,
        description: str,
        preset_id: str | None,
        memory: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        selected = next((item for item in PROJECT_PRESETS if item["id"] == preset_id), None)
        if preset_id and selected is None:
            raise ProjectValidationError("El preset de proyecto solicitado no existe.")
        selected = selected or {
            "id": None,
            "project_type": "produccion",
            "description": "Proyecto local de voz.",
            "color": "#37cfa2",
            "memory": {"creative_direction": "", "glossary": []},
            "deliverables": [],
            "scenes": (),
        }
        now = _utc_now()
        project_memory = deepcopy(dict(selected.get("memory") or {}))
        project_memory.update(dict(memory or {}))
        project_memory["brief"] = description or str(project_memory.get("brief") or selected["description"])
        project_memory.setdefault("creative_direction", "")
        project_memory.setdefault("glossary", [])
        project_memory.setdefault("notes", [])
        project_memory["prompt_version"] = PROMPT_VERSION
        project = {
            "schema_version": PROJECT_SCHEMA_VERSION,
            "id": f"project_{uuid4().hex}",
            "name": name or "Proyecto sin titulo",
            "description": description or str(selected["description"]),
            "project_type": selected["project_type"],
            "preset_id": selected["id"],
            "preset_version": PROMPT_VERSION,
            "color": selected["color"],
            "scenes": [
                _new_scene(**scene)
                for scene in selected.get("scenes", ())
            ],
            "deliverables": list(selected.get("deliverables") or []),
            "settings": {},
            "memory": project_memory,
            "created_at": now,
            "updated_at": now,
        }
        return self._write(project)

    def update_project(self, project_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        project = self._read(project_id)
        for key in ("name", "description", "project_type", "color", "deliverables", "settings"):
            if key in changes and changes[key] is not None:
                project[key] = changes[key]
        if isinstance(changes.get("memory"), dict):
            project["memory"] = {**project["memory"], **changes["memory"]}
            project["memory"]["prompt_version"] = PROMPT_VERSION
        return self._write(project)

    def add_scene(self, project_id: str, scene: dict[str, Any]) -> dict[str, Any]:
        project = self._read(project_id)
        project["scenes"].append(
            _new_scene(
                title=str(scene.get("title") or "Nueva escena"),
                role=str(scene.get("role") or "scene"),
                text=str(scene.get("text") or ""),
                engine_id=str(scene.get("engine_id") or "kokoro"),
                voice_id=str(scene.get("voice_id") or "") or None,
                parameters=dict(scene.get("parameters") or {}),
            )
        )
        return self._write(project)

    def update_scene(self, project_id: str, scene_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        project = self._read(project_id)
        safe_scene_id = _safe_scene_id(scene_id)
        scene = next((item for item in project["scenes"] if item["id"] == safe_scene_id), None)
        if scene is None:
            raise ProjectNotFoundError(scene_id)
        for key in ("title", "role", "text", "engine_id", "voice_id", "parameters", "status", "library_item_ids"):
            if key in changes and changes[key] is not None:
                scene[key] = changes[key]
        return self._write(project)

