from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class JobStatus(BaseModel):
    job_id: str = Field(alias="jobId")
    status: str
    stage: str
    progress: float | None = None
    message: str = ""
    simulated: bool = False
    result: dict[str, Any] | None = None
    error: ErrorBody | None = None

    model_config = {"populate_by_name": True}
