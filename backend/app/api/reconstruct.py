import json
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException

from app.core.dependencies import get_reconstruction_service
from app.core.exceptions import SceneraError
from app.schemas.reconstruction import ReconstructionParams
from app.services.reconstruction_service import ReconstructionService
from app.services.image_service import ImageService
from app.core.dependencies import get_reconstruction_service

router = APIRouter(tags=["reconstruction"])


def parse_params(params: str | None, **form_values) -> ReconstructionParams:
    data = {}
    if params:
        try:
            data = json.loads(params)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="params must be valid JSON") from exc
    # Support the frontend's current params JSON while also accepting direct fields.
    aliases = {
        "negativePrompt": "negative_prompt", "guidanceScale": "guidance_scale",
        "preserveOriginal": "preserve_original", "highQuality": "high_quality",
    }
    for k, v in form_values.items():
        if v is not None:
            data[aliases.get(k, k)] = v
    return ReconstructionParams.model_validate(data)




@router.post("/upload", summary="Validate and stage an image upload")
async def upload_image(image: UploadFile = File(...), service: ReconstructionService = Depends(get_reconstruction_service)):
    staged, path = await service.image_service.read_and_validate(image)
    return {"imageId": path.stem}


@router.post("/reconstruct", summary="Start an image reconstruction job")
async def reconstruct(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
    params: str | None = Form(default=None),
    prompt: str | None = Form(default=None),
    negative_prompt: str | None = Form(default=None),
    mode: str | None = Form(default=None),
    seed: int | None = Form(default=None),
    steps: int | None = Form(default=None),
    guidance_scale: float | None = Form(default=None),
    strength: float | None = Form(default=None),
    resolution: int | None = Form(default=None),
    preserve_original: bool | None = Form(default=None),
    scheduler: str | None = Form(default=None),
    service: ReconstructionService = Depends(get_reconstruction_service),
):
    p = parse_params(
        params, prompt=prompt, negative_prompt=negative_prompt, mode=mode, seed=seed, steps=steps,
        guidance_scale=guidance_scale, strength=strength, resolution=resolution,
        preserve_original=preserve_original, scheduler=scheduler,
    )
    job = await service.submit(image, mask, p)
    return {"jobId": job.job_id, "job_id": job.job_id, "status": job.status}


@router.get("/reconstruct/{job_id}", summary="Get reconstruction job status")
async def reconstruct_status(job_id: str, service: ReconstructionService = Depends(get_reconstruction_service)):
    return service.status(job_id)


@router.get("/jobs/{job_id}", summary="Frontend-compatible reconstruction status alias")
async def legacy_status(job_id: str, service: ReconstructionService = Depends(get_reconstruction_service)):
    return service.status(job_id)


@router.get("/jobs/{job_id}/metrics", summary="Frontend-compatible metrics alias")
async def legacy_metrics(job_id: str, service: ReconstructionService = Depends(get_reconstruction_service)):
    return service.metrics(job_id)


@router.get("/reconstruct/{job_id}/metrics", summary="Get reconstruction metrics")
async def reconstruction_metrics(job_id: str, service: ReconstructionService = Depends(get_reconstruction_service)):
    return service.metrics(job_id)


# Vite dev-server compatibility router. It forwards the exact same service operations
# at the unprefixed paths produced when the frontend proxy strips "/api".
compat_router = APIRouter(tags=["frontend-compat"])


@compat_router.post("/upload", include_in_schema=False)
async def compat_upload(image: UploadFile = File(...), service: ReconstructionService = Depends(get_reconstruction_service)):
    staged, path = await service.image_service.read_and_validate(image)
    return {"imageId": path.stem}


@compat_router.post("/reconstruct", include_in_schema=False)
async def compat_reconstruct(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
    params: str | None = Form(default=None),
    service: ReconstructionService = Depends(get_reconstruction_service),
):
    p = parse_params(params)
    job = await service.submit(image, mask, p)
    return {"jobId": job.job_id, "job_id": job.job_id, "status": job.status}


@compat_router.get("/jobs/{job_id}", include_in_schema=False)
async def compat_status(job_id: str, service: ReconstructionService = Depends(get_reconstruction_service)):
    return service.status(job_id)


@compat_router.get("/jobs/{job_id}/metrics", include_in_schema=False)
async def compat_metrics(job_id: str, service: ReconstructionService = Depends(get_reconstruction_service)):
    return service.metrics(job_id)
