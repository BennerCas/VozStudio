"""Punto de entrada FastAPI de VozStudio Omni-ES con interfaz Atlas, compatibilidad Studio y OWASP."""

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
from src.core.config import APP_NAME, APP_VERSION, BIBLIOTECA_DIR, PROJECT_ROOT, PROJECTS_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("vozstudio.main")


def create_app(
    engine_orch: EngineOrchestrator | None = None,
    biblioteca_dir: Path | None = None,
    projects_dir: Path | None = None,
) -> FastAPI:
    """Construye la aplicacion FastAPI de VozStudio Omni-ES con servicio dual Atlas/Studio."""
    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        description="Estacion offline de sintesis neural de voz en espanol con aceleracion DirectML.",
        docs_url="/api/docs",
        redoc_url=None,
    )

    allowed_origins = [
        "http://127.0.0.1:8880",
        "http://localhost:8880",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
        "http://127.0.0.1",
        "http://localhost",
        "null",
        "*",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    @app.middleware("http")
    async def attach_security_headers(request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        return response

    target_bib = biblioteca_dir if biblioteca_dir is not None else BIBLIOTECA_DIR
    target_projects = projects_dir if projects_dir is not None else PROJECTS_DIR
    app.include_router(
        create_api_router(
            engine_orch=engine_orch,
            biblioteca_dir=target_bib,
            projects_dir=target_projects,
        )
    )

    # Ruta alias defensiva para compatibilidad con metadatos previos (/api/library/{id}/audio)
    @app.get("/api/library/{item_id}/audio", include_in_schema=False)
    async def legacy_audio_alias(item_id: str) -> FileResponse:
        clean_id = item_id[:-4] if item_id.endswith(".wav") else item_id
        try:
            wav_path, _ = get_biblioteca_item(clean_id, biblioteca_dir=target_bib)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        if not wav_path.is_file():
            raise HTTPException(status_code=404, detail="Archivo de audio WAV no encontrado en disco.")

        return FileResponse(
            path=str(wav_path),
            media_type="audio/wav",
            filename=wav_path.name,
            content_disposition_type="inline",
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*",
            },
        )

    atlas_dir = PROJECT_ROOT / "docs" / "prototipo-atlas"
    studio_dist = PROJECT_ROOT / "src" / "ui" / "dist"

    atlas_index = atlas_dir / "index.html"
    studio_index = studio_dist / "index.html"

    atlas_assets = atlas_dir / "assets"
    studio_assets = studio_dist / "assets"

    @app.get("/favicon.ico", include_in_schema=False)
    async def serve_favicon_ico() -> Response:
        studio_favicon = studio_dist / "favicon.ico"
        if studio_favicon.is_file():
            return FileResponse(str(studio_favicon), media_type="image/x-icon")
        atlas_favicon = atlas_dir / "favicon.svg"
        if atlas_favicon.is_file():
            return FileResponse(str(atlas_favicon), media_type="image/svg+xml")
        return Response(status_code=204)

    @app.get("/favicon.svg", include_in_schema=False)
    async def serve_favicon_svg() -> Response:
        atlas_favicon = atlas_dir / "favicon.svg"
        if atlas_favicon.is_file():
            return FileResponse(str(atlas_favicon), media_type="image/svg+xml")
        return Response(status_code=204)

    # Resolucion unificada de assets estaticos (/assets/...)
    @app.get("/assets/{file_path:path}", include_in_schema=False)
    async def serve_assets(file_path: str) -> FileResponse:
        # Prioridad 1: docs/prototipo-atlas/assets
        if atlas_assets.is_dir():
            candidate = (atlas_assets / file_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(atlas_assets.resolve()):
                return FileResponse(str(candidate))
        # Prioridad 2: src/ui/dist/assets
        if studio_assets.is_dir():
            candidate = (studio_assets / file_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(studio_assets.resolve()):
                return FileResponse(str(candidate))
        raise HTTPException(status_code=404, detail="Recurso estatico no encontrado")

    # Servir scripts auxiliares de Atlas si existen
    atlas_scripts = atlas_dir / "scripts"
    if atlas_scripts.is_dir():
        @app.get("/scripts/{file_path:path}", include_in_schema=False)
        async def serve_atlas_scripts(file_path: str) -> FileResponse:
            candidate = (atlas_scripts / file_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(atlas_scripts.resolve()):
                return FileResponse(str(candidate))
            raise HTTPException(status_code=404, detail="Script no encontrado")

    # Ruta de compatibilidad /studio para la interfaz anterior (src/ui/dist)
    if studio_dist.is_dir() and studio_index.is_file():
        @app.get("/studio", include_in_schema=False)
        @app.get("/studio/", include_in_schema=False)
        async def serve_studio_root() -> FileResponse:
            return FileResponse(str(studio_index))

        @app.get("/studio/{subpath:path}", include_in_schema=False)
        async def serve_studio_subpaths(subpath: str) -> FileResponse:
            candidate = (studio_dist / subpath).resolve()
            if candidate.is_file() and candidate.is_relative_to(studio_dist.resolve()):
                return FileResponse(str(candidate))
            return FileResponse(str(studio_index))

    # Pagina auxiliar de desarrollo Atlas
    dev_html = atlas_dir / "dev.html"
    if dev_html.is_file():
        @app.get("/dev.html", include_in_schema=False)
        async def serve_dev_html() -> FileResponse:
            return FileResponse(str(dev_html))

    # Montaje estatico directo opcional de Atlas en /atlas
    if atlas_dir.is_dir():
        app.mount("/atlas", StaticFiles(directory=str(atlas_dir), html=True), name="atlas-direct")

    # Interfaz principal en la raiz / (VozStudio Atlas)
    @app.get("/", include_in_schema=False)
    @app.get("/index.html", include_in_schema=False)
    async def serve_main_interface() -> FileResponse:
        no_cache_headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
        if atlas_index.is_file():
            return FileResponse(str(atlas_index), headers=no_cache_headers)
        if studio_index.is_file():
            return FileResponse(str(studio_index), headers=no_cache_headers)
        raise HTTPException(status_code=404, detail="Interfaz principal no disponible.")

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
