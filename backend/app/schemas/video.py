from enum import Enum
from typing import Any
from pydantic import BaseModel, Field

class VideoStatus(str, Enum):
    queued = "queued"
    analyzing = "analyzing"
    extracting = "extracting"
    processing = "processing"
    temporal_consistency = "temporal_consistency"
    verification = "verification"
    encoding = "encoding"
    complete = "complete"
    failed = "failed"
    cancelled = "cancelled"

class VideoMetadata(BaseModel):
    video_id: str
    filename: str
    width: int
    height: int
    fps: float
    frame_count: int
    duration: float
    codec: str | None = None
    status: str = "uploaded"

class VideoJobResponse(BaseModel):
    job_id: str
    video_id: str
    status: str
    progress: float | None = None
    current_frame: int = 0
    total_frames: int = 0
    stage: str
    elapsed_time: float | None = None
    estimated_remaining: float | None = None
    output_url: str | None = None
    metrics_url: str | None = None
    verification_url: str | None = None
    error: dict[str, Any] | None = None

class VideoReconstructionParams(BaseModel):
    prompt: str = Field(default="", max_length=1000)
    negative_prompt: str = Field(default="", max_length=1000)
    mode: str = Field(default="MEDIUM")
    seed: int = Field(default=-1, ge=-1, le=2**31-1)
    steps: int = Field(default=20, ge=1, le=100)
    guidance_scale: float = Field(default=7.5, ge=0, le=30)
    strength: float = Field(default=0.8, ge=0, le=1)
    resolution: int = Field(default=768, ge=256, le=2048)
    temporal_strength: float = Field(default=0.12, ge=0, le=0.5)
    feather: int = Field(default=0, ge=0, le=128)
    preserve_original: bool = True

    @classmethod
    def from_payload(cls, data: dict[str, Any]):
        aliases = {"negativePrompt":"negative_prompt","guidanceScale":"guidance_scale",
                   "temporalStrength":"temporal_strength","preserveOriginal":"preserve_original"}
        return cls.model_validate({aliases.get(k,k): v for k,v in data.items()})
