from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import health, metrics, reconstruct, system, video
from app.core.config import get_settings
from app.core.exceptions import SceneraError
from app.core.logging_config import configure_logging
from app.engines.ai.model_manager import ModelManager
from app.services.image_service import ImageService
from app.services.mask_service import MaskService
from app.services.reconstruction_service import ReconstructionService
from app.services.system_service import SystemService
from app.services.verification_service import VerificationService
from app.services.video_service import VideoService
from app.utils.file_utils import ensure_dirs

settings = get_settings()
ensure_dirs(settings.UPLOAD_DIR, settings.MASK_DIR, settings.RESULT_DIR, settings.FRAME_DIR, settings.MODEL_CACHE_DIR)
configure_logging(settings.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs(settings.UPLOAD_DIR, settings.MASK_DIR, settings.RESULT_DIR, settings.FRAME_DIR, settings.MODEL_CACHE_DIR)
    model_manager = ModelManager(settings)
    image_service = ImageService(settings)
    mask_service = MaskService(settings)
    verification_service = VerificationService(settings)
    reconstruction_service = ReconstructionService(settings, model_manager, image_service, mask_service, verification_service)
    app.state.model_manager = model_manager
    app.state.reconstruction_service = reconstruction_service
    app.state.system_service = SystemService(settings, model_manager)
    app.state.video_service = VideoService(settings, model_manager, mask_service)

    if settings.PRELOAD_MODEL:
        try:
            model_manager.prepare(settings.DEFAULT_MODE)
        except Exception:
            logger.exception("Configured model preload failed; server remains available.")
    yield
    model_manager.release()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Generative Computer Vision & Scene Reconstruction backend.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(system.router, prefix="/api")

@app.get("/system", include_in_schema=False)
async def system_compat(request: Request):
    return request.app.state.system_service.status()

@app.get("/health", include_in_schema=False)
async def health_compat():
    return {"status": "ok", "service": "scenera-backend", "version": settings.APP_VERSION}
app.include_router(reconstruct.router, prefix="/api")
app.include_router(reconstruct.compat_router)
app.include_router(metrics.router, prefix="/api")
app.include_router(video.router, prefix="/api")

# Controlled generated-file directory. Only files placed in RESULT_DIR are exposed.
app.mount("/api/results", StaticFiles(directory=settings.RESULT_DIR), name="results")


@app.exception_handler(SceneraError)
async def scenera_exception_handler(request: Request, exc: SceneraError):
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled request error")
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "An internal server error occurred."}})
