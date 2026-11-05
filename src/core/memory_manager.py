"""Gestor de memoria Zero-OOM con politica Single-Active-Engine y cerrojo DirectML."""

from __future__ import annotations

from datetime import datetime, timezone
import gc
import logging
import sys
import threading
from typing import Any, Callable

from src.core.config import GPU_MEMORY_LIMIT_GB

logger = logging.getLogger(__name__)


def _release_optional_torch_cache() -> None:
    """Vacia la cache de PyTorch unicamente si el modulo ya reside en sys.modules."""
    torch_mod = sys.modules.get("torch")
    if torch_mod is None:
        return
    try:
        cuda_mod = getattr(torch_mod, "cuda", None)
        if cuda_mod is not None and callable(getattr(cuda_mod, "is_available", None)):
            if cuda_mod.is_available() and callable(getattr(cuda_mod, "empty_cache", None)):
                cuda_mod.empty_cache()
    except Exception as exc:
        logger.debug("No fue posible vaciar cache opcional de torch: %r", exc)


class MemoryManager:
    """Coordina la residencia exclusiva de un unico motor TTS en memoria y serializa DirectML."""

    def __init__(self) -> None:
        self.inference_lock: threading.RLock = threading.RLock()
        self.active_engine_id: str | None = None
        self.active_provider: str | None = None
        self.estimated_mb: float = 0.0
        self.loaded_at: str | None = None
        self._unloader_fn: Callable[[], None] | None = None

    def _evict_locked(self) -> None:
        """Desaloja el motor residente actual y fuerza recoleccion de basura (requiere inference_lock)."""
        prev_engine = self.active_engine_id
        unloader = self._unloader_fn

        self.active_engine_id = None
        self.active_provider = None
        self.estimated_mb = 0.0
        self.loaded_at = None
        self._unloader_fn = None

        if unloader is not None:
            try:
                unloader()
            except Exception as exc:
                logger.warning(
                    "Error controlado al descargar motor previo '%s': %r",
                    prev_engine,
                    exc,
                )
            finally:
                unloader = None

        gc.collect()
        _release_optional_torch_cache()

    def activate_engine(
        self,
        engine_id: str,
        loader_fn: Callable[[], str],
        unloader_fn: Callable[[], None],
        estimated_mb: float = 350.0,
    ) -> str:
        """Activa ``engine_id`` desalojando previamente cualquier otro motor cargado."""
        clean_id = str(engine_id).strip()
        if not clean_id:
            raise ValueError("El identificador engine_id no puede estar vacio.")

        with self.inference_lock:
            if self.active_engine_id == clean_id and self.active_provider is not None:
                self._unloader_fn = unloader_fn
                self.estimated_mb = round(max(0.0, float(estimated_mb)), 2)
                return self.active_provider

            if self.active_engine_id is not None or self._unloader_fn is not None:
                logger.info(
                    "Desalojando motor '%s' para cargar '%s' (Zero-OOM).",
                    self.active_engine_id,
                    clean_id,
                )
                self._evict_locked()

            try:
                provider = loader_fn()
            except BaseException:
                self._evict_locked()
                raise

            resolved_provider = str(provider).strip() if provider else "CPUExecutionProvider"
            self.active_engine_id = clean_id
            self.active_provider = resolved_provider
            self.estimated_mb = round(max(0.0, float(estimated_mb)), 2)
            self.loaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            self._unloader_fn = unloader_fn
            return resolved_provider

    def unload_current(self) -> bool:
        """Descarga explicitamente el motor activo y libera memoria."""
        with self.inference_lock:
            if self.active_engine_id is None and self._unloader_fn is None:
                return False
            self._evict_locked()
            return True

    def get_status(self) -> dict[str, Any]:
        """Retorna una instantanea segura del estado actual del gestor de memoria."""
        with self.inference_lock:
            return {
                "active_engine_id": self.active_engine_id,
                "active_engine": self.active_engine_id,
                "active_provider": self.active_provider,
                "estimated_mb": float(self.estimated_mb),
                "estimated_engine_mb": float(self.estimated_mb),
                "loaded_at": self.loaded_at,
                "vram_limit_gb": float(GPU_MEMORY_LIMIT_GB),
            }


memory_manager = MemoryManager()

__all__ = [
    "MemoryManager",
    "memory_manager",
]
