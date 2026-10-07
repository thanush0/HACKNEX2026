
from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.dependencies import get_reconstruction_service
from app.core.exceptions import InvalidImageError, InvalidMaskError
from app.engines.verification.metrics import calculate_metrics
from app.services.reconstruction_service import ReconstructionService
from app.utils.image_utils import load_pil

router = APIRouter(tags=["metrics"])


@router.post("/metrics", summary="Calculate verification metrics from image data")
async def calculate_metrics_endpoint(
    original: UploadFile = File(...),
    final: UploadFile = File(...),
    mask: UploadFile = File(...),
    processing_time: float | None = Form(default=None),
    model: str | None = Form(default=None),
    mode: str = Form(default="MEDIUM"),
    seed: int | None = Form(default=None),
    service: ReconstructionService = Depends(get_reconstruction_service),
):
    try:
        original_image = load_pil(await original.read())
        final_image = load_pil(await final.read())
        mask_image = load_pil(await mask.read()).convert("L")
    except Exception as exc:
        raise InvalidImageError("original and final must be valid images; mask must be a valid image.") from exc
    if original_image.size != final_image.size or original_image.size != mask_image.size:
        raise InvalidMaskError("original, final, and mask dimensions must match.")
    return calculate_metrics(
        original_image, final_image, mask_image,
        processing_time=processing_time, model=model, mode=mode, seed=seed
    )
