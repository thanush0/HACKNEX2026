from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ReconstructionMode(str, Enum):
    FAST = "FAST"
    MEDIUM = "MEDIUM"
    MAX = "MAX"


class ReconstructionParams(BaseModel):
    prompt: str = Field(default="", max_length=1000)
    negative_prompt: str = Field(default="", max_length=1000)
    mode: ReconstructionMode = ReconstructionMode.MEDIUM
    seed: int = Field(default=-1, ge=-1, le=2**31 - 1)
    steps: int = Field(default=30, ge=1, le=100)
    guidance_scale: float = Field(default=7.5, ge=0, le=30)
    strength: float = Field(default=0.8, ge=0, le=1)
    resolution: int = Field(default=1024, ge=256, le=8192)
    preserve_original: bool = True
    feather: int = Field(default=0, ge=0, le=128)
    scheduler: str = "DPM++ 2M"
    high_quality: bool = False
    face_protection: bool = False
    edge_refinement: bool = True
    color_matching: bool = False
    lighting_matching: bool = False
    batch: int = Field(default=1, ge=1, le=4)

    @field_validator("scheduler")
    @classmethod
    def scheduler_allowed(cls, value: str) -> str:
        allowed = {"DPM++ 2M", "Euler a", "DDIM", "UniPC"}
        if value not in allowed:
            raise ValueError(f"scheduler must be one of: {', '.join(sorted(allowed))}")
        return value


class ReconstructionResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: str
    mode: ReconstructionMode
    result_url: str | None = Field(default=None, alias="resultUrl")
    difference_url: str | None = Field(default=None, alias="differenceUrl")
    mask_url: str | None = Field(default=None, alias="maskUrl")
    original_url: str | None = Field(default=None, alias="originalUrl")
    generated_url: str | None = Field(default=None, alias="generatedUrl")
    model: str | None = None
    seed: int | None = None
    metrics: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}
