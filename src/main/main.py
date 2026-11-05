"""Punto de entrada FastAPI de VozStudio Omni-ES con cabeceras OWASP y servicio SPA estatico."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from src.ai.engine_factory import EngineOrchestrator, orchestrator as default_orchestrator
from src.api.routes import create_api_router
from src.core.audio_dsp import get_biblioteca_item
from src.core.config import APP_NAME, APP_VERSION, BIBLIOTECA_DIR, PROJECT_ROOT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("vozstudio.main")


def create_app(
    engine_orch: EngineOrchestrator | None = None,
    biblioteca_dir: Path | None = None,
) -> FastAPI:
    """Construye la aplicacion FastAPI de VozStudio Omni-ES."""
    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        description="Estacion offline de sintesis neural de voz en espanol con aceleracion DirectML.",
        docs_url="/api/docs",
        redoc_url=None,
    )

    allowed_origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:8880",
        "http://localhost:8880",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.middleware("http")
    async def attach_security_headers(request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        return response

    target_bib = biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR
    app.include_router(create_api_router(engine_orch=engine_orch, biblioteca_dir=target_bib))

    # Ruta alias defensiva para compatibilidad con metadatos previos (/api/library/{id}/audio)
    @app.get("/api/library/{item_id}/audio", include_in_schema=False)
    async def legacy_audio_alias(item_id: str) -> FileResponse:
        try:
            wav_path, _ = get_biblioteca_item(item_id, biblioteca_dir=target_bib)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return FileResponse(path=str(wav_path), media_type="audio/wav", filename=wav_path.name)

    @app.get("/favicon.ico", include_in_schema=False)
    async def serve_favicon() -> Response:
        favicon_file = PROJECT_ROOT / "src" / "ui" / "dist" / "favicon.ico"
        if favicon_file.is_file():
            return FileResponse(str(favicon_file), media_type="image/x-icon")
        return Response(status_code=204)

    ui_dist = PROJECT_ROOT / "src" / "ui" / "dist"
    if ui_dist.is_dir() and (ui_dist / "index.html").is_file():
        assets_dir = ui_dist / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="ui-assets")

        @app.get("/", include_in_schema=False)
        async def serve_spa_index() -> FileResponse:
            return FileResponse(str(ui_dist / "index.html"))

        app.mount("/", StaticFiles(directory=str(ui_dist), html=True), name="ui-spa")

    return app


app = create_app()


def main() -> None:
    """Arranca el servidor Uvicorn local enlazado exclusivamente a loopback."""
    host = os.environ.get("VOZSTUDIO_HOST", "127.0.0.1")
    port = int(os.environ.get("VOZSTUDIO_PORT", "8880"))
    logger.info("Iniciando %s v%s en http://%s:%d", APP_NAME, APP_VERSION, host, port)
    uvicorn.run("src.main.main:app", host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
