import logging
import secrets
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from time import perf_counter

from fastapi import UploadFile
from PIL import Image

from app.core.exceptions import JobNotFoundError, ReconstructionError
from app.engines.ai.base import GenerationRequest
from app.engines.ai.model_manager import ModelManager
from app.engines.cv.compositor import composite_preserving_original
from app.engines.cv.image_processor import prepare_image, resize_to
from app.services.image_service import ImageService
from app.services.mask_service import MaskService
from app.services.verification_service import VerificationService
from app.utils.file_utils import ensure_dirs

logger = logging.getLogger(__name__)


@dataclass
class Job:
    job_id: str
    status: str = "queued"
    stage: str = "queued"
    progress: float | None = 0.0
    message: str = "Queued"
    simulated: bool = False
    result: dict | None = None
    error: dict | None = None
    metrics: dict | None = None
    mode: str = "MEDIUM"
    model: str | None = None
    seed: int | None = None
    created_at: float = field(default_factory=perf_counter)


class ReconstructionService:
    def __init__(self, settings, model_manager: ModelManager, image_service: ImageService, mask_service: MaskService, verification_service: VerificationService):
        self.settings = settings
        self.model_manager = model_manager
        self.image_service = image_service
        self.mask_service = mask_service
        self.verification_service = verification_service
        self.jobs: dict[str, Job] = {}
        self._lock = threading.RLock()
        ensure_dirs(settings.UPLOAD_DIR, settings.MASK_DIR, settings.RESULT_DIR, settings.FRAME_DIR)

    def create_job(self) -> Job:
        job = Job(job_id=str(uuid.uuid4()))
        with self._lock:
            self.jobs[job.job_id] = job
        return job

    def get_job(self, job_id: str) -> Job:
        with self._lock:
            job = self.jobs.get(job_id)
        if not job:
            raise JobNotFoundError(f"Job '{job_id}' was not found.")
        return job

    def _update(self, job: Job, *, status=None, stage=None, progress=None, message=None):
        with self._lock:
            if status is not None: job.status = status
            if stage is not None: job.stage = stage
            if progress is not None: job.progress = progress
            if message is not None: job.message = message

    async def submit(self, image_upload: UploadFile, mask_upload: UploadFile, params) -> Job:
        job = self.create_job()
        # FastAPI request handling remains async; inference is run in a worker thread below.
        try:
            image, _ = await self.image_service.read_and_validate(image_upload)
            expansion = getattr(params, "expansion", 0)
            blur = getattr(params, "blur", 0)
            feather = getattr(params, "feather", 0)
            mask, _, _ = await self.mask_service.read_and_validate(mask_upload, image.size, feather=feather, expansion=expansion, blur=blur)
        except Exception as exc:
            self._fail(job, exc)
            raise

        thread = threading.Thread(target=self._run_job, args=(job, image, mask, params), daemon=True)
        thread.start()
        return job

    def _run_job(self, job: Job, original: Image.Image, mask: Image.Image, params):
        start = perf_counter()
        seed = params.seed if params.seed >= 0 else secrets.randbelow(2**31)
        job.seed = seed
        job.mode = params.mode.value
        try:
            self._update(job, status="running", stage="analysis", progress=0.05, message="IMAGE ANALYSIS")
            prepared = prepare_image(original, params.resolution)
            prepared_mask = resize_to(mask, prepared.size)
            self._update(job, stage="mask", progress=0.15, message="MASK ANALYSIS")
            self._update(job, stage="understanding", progress=0.20, message="SCENE UNDERSTANDING")
            self._update(job, stage="generation", progress=0.35, message="GENERATION")

            engine = self.model_manager.prepare(params.mode.value)
            model_name = getattr(engine, "name", params.mode.value)
            job.model = model_name
            request = GenerationRequest(
                image=prepared,
                mask=prepared_mask,
                prompt=params.prompt,
                negative_prompt=params.negative_prompt,
                steps=params.steps,
                guidance_scale=params.guidance_scale,
                strength=params.strength,
                resolution=params.resolution,
                seed=seed,
                scheduler=params.scheduler,
            )
            generated_small = engine.generate(request)
            self._update(job, stage="refinement", progress=0.75 if params.mode.value == "MAX" else 0.65, message="REFINEMENT")
            generated = resize_to(generated_small, original.size)
            self._update(job, stage="preservation", progress=0.85, message="PRESERVATION")
            final = composite_preserving_original(original, generated, mask) if params.preserve_original else generated

            self._update(job, stage="verification", progress=0.93, message="VERIFICATION")
            processing = perf_counter() - start
            metrics, diff_path = self.verification_service.verify(
                original, final, mask, processing_time=processing, model=model_name, mode=params.mode.value, seed=seed
            )
            result_path = Path(self.settings.RESULT_DIR) / f"final_{job.job_id}.png"
            generated_path = Path(self.settings.RESULT_DIR) / f"generated_{job.job_id}.png"
            final.save(result_path, format="PNG")
            generated.save(generated_path, format="PNG")
            # Use API-relative URLs, never expose local filesystem paths.
            job.metrics = metrics
            job.result = {
                "before": f"/api/results/{result_path.name}",
                "mask": f"/api/results/{Path(self.settings.MASK_DIR).name}/{job.job_id}.png",
                "generatedUrl": f"/api/results/{generated_path.name}",
                "finalUrl": f"/api/results/{result_path.name}",
                "differenceUrl": f"/api/results/{diff_path.name}",
            }
            # Actual mask is copied to a stable job-named result for the frontend.
            stable_mask = Path(self.settings.RESULT_DIR) / f"mask_{job.job_id}.png"
            mask.save(stable_mask, format="PNG")
            job.result["mask"] = f"/api/results/{stable_mask.name}"
            self._update(job, status="complete", stage="complete", progress=1.0, message="COMPLETE")
        except Exception as exc:
            logger.exception("Reconstruction job %s failed", job.job_id)
            self._fail(job, exc)

    def _fail(self, job: Job, exc: Exception):
        code = getattr(exc, "code", "GENERATION_FAILED")
        message = getattr(exc, "message", str(exc))
        with self._lock:
            job.status = "failed"
            job.stage = "failed"
            job.progress = None
            job.message = message
            job.error = {"code": code, "message": message}

    def status(self, job_id: str) -> dict:
        j = self.get_job(job_id)
        return {
            "job_id": j.job_id,
            "jobId": j.job_id,
            "status": "complete" if j.status == "complete" else j.status,
            "stage": j.stage,
            "progress": j.progress,
            "message": j.message,
            "simulated": False,
            "result": j.result,
            "error": j.error,
        }

    def metrics(self, job_id: str) -> dict:
        j = self.get_job(job_id)
        if j.metrics is None:
            return {"preservationScore": None, "maskCoverage": None, "processingTime": None, "resolution": None, "model": j.model, "mode": j.mode, "seed": j.seed}
        m = j.metrics
        return {
            "preservationScore": m["preservation_score"],
            "maskCoverage": m["mask_coverage"],
            "changedPixelsOutsideMask": m["changed_pixels_outside_mask"],
            "processingTime": m["processing_time"],
            "resolution": m["resolution"],
            "model": m["model"],
            "mode": m["mode"],
            "seed": m["seed"],
        }
