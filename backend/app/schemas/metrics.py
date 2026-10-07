from pydantic import BaseModel


class MetricsResponse(BaseModel):
    preservation_score: float | None
    mask_coverage: float
    changed_pixels_outside_mask: int
    processing_time: float | None
    resolution: str
    model: str | None
    mode: str
    seed: int | None

    model_config = {"populate_by_name": True}
