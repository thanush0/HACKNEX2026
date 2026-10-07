from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "SCENERA API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173"
    UPLOAD_DIR: str = "./temp/uploads"
    MASK_DIR: str = "./temp/masks"
    RESULT_DIR: str = "./temp/results"
    FRAME_DIR: str = "./temp/frames"
    MAX_UPLOAD_SIZE_MB: int = 20
    MAX_VIDEO_UPLOAD_SIZE_MB: int = 500
    MAX_VIDEO_DURATION_SECONDS: float = 300.0
    MAX_VIDEO_FRAMES: int = 9000
    DEFAULT_MODE: str = "MEDIUM"
    DEFAULT_STEPS: int = 30
    DEFAULT_GUIDANCE_SCALE: float = 7.5
    DEFAULT_STRENGTH: float = 0.8
    SD_MODEL_ID: str = "runwayml/stable-diffusion-inpainting"
    SDXL_MODEL_ID: str = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
    DEVICE: str = "auto"
    ENABLE_GPU: bool = True
    ENABLE_VIDEO: bool = True
    PRELOAD_MODEL: bool = False
    MODEL_CACHE_DIR: str = "./models"
    MAX_PROMPT_LENGTH: int = 1000
    MAX_DIMENSION: int = 8192
    MIN_MASK_COVERAGE: float = 0.001
    MAX_MASK_COVERAGE: float = 0.99
    VIDEO_TEMPORAL_STRENGTH: float = 0.12
    VIDEO_MAX_WORKING_SIDE: int = 1024
    ALLOW_LEGACY_ROUTES: bool = True
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]
    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    @property
    def max_video_upload_bytes(self) -> int:
        return self.MAX_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024
    @field_validator("DEFAULT_MODE")
    @classmethod
    def validate_mode(cls, value: str) -> str:
        value = value.upper()
        if value not in {"FAST", "MEDIUM", "MAX"}: raise ValueError("DEFAULT_MODE must be FAST, MEDIUM, or MAX")
        return value

@lru_cache
def get_settings() -> Settings:
    return Settings()
