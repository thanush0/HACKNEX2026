import logging
from PIL import Image

from app.core.exceptions import GPUOutOfMemoryError, ModelUnavailableError, ReconstructionError
from app.utils.gpu_utils import cleanup_torch_memory
from .base import BaseInpaintingEngine, GenerationRequest

logger = logging.getLogger(__name__)


class StableDiffusionInpaintingEngine(BaseInpaintingEngine):
    name = "Stable Diffusion Inpainting"

    def __init__(self, model_id: str, device: str, cache_dir: str):
        self.model_id = model_id
        self.device = device
        self.cache_dir = cache_dir
        self.pipeline = None

    def load(self) -> None:
        if self.pipeline is not None:
            return
        try:
            import torch
            from diffusers import StableDiffusionInpaintPipeline
            dtype = torch.float16 if self.device.startswith("cuda") else torch.float32
            self.pipeline = StableDiffusionInpaintPipeline.from_pretrained(
                self.model_id,
                torch_dtype=dtype,
                cache_dir=self.cache_dir,
                safety_checker=None,
            )
            if self.device.startswith("cuda"):
                self.pipeline.enable_model_cpu_offload()
                try:
                    self.pipeline.enable_attention_slicing()
                except Exception:
                    pass
            else:
                self.pipeline.to("cpu")
        except Exception as exc:
            logger.exception("Failed to load Stable Diffusion model")
            raise ModelUnavailableError(f"Unable to load model '{self.model_id}'.") from exc

    def unload(self) -> None:
        self.pipeline = None
        cleanup_torch_memory()

    def is_loaded(self) -> bool:
        return self.pipeline is not None

    def get_device(self) -> str:
        return self.device

    def _set_scheduler(self, scheduler: str) -> None:
        if self.pipeline is None:
            return
        from diffusers import DDIMScheduler, EulerAncestralDiscreteScheduler, DPMSolverMultistepScheduler, UniPCMultistepScheduler
        mapping = {
            "DPM++ 2M": DPMSolverMultistepScheduler,
            "Euler a": EulerAncestralDiscreteScheduler,
            "DDIM": DDIMScheduler,
            "UniPC": UniPCMultistepScheduler,
        }
        cls = mapping.get(scheduler)
        if cls:
            self.pipeline.scheduler = cls.from_config(self.pipeline.scheduler.config)

    def generate(self, request: GenerationRequest) -> Image.Image:
        self.load()
        try:
            import torch
            self._set_scheduler(request.scheduler)
            generator = torch.Generator(device="cpu").manual_seed(request.seed)
            result = self.pipeline(
                prompt=request.prompt or "realistic seamless scene reconstruction",
                negative_prompt=request.negative_prompt or None,
                image=request.image,
                mask_image=request.mask,
                num_inference_steps=request.steps,
                guidance_scale=request.guidance_scale,
                strength=request.strength,
                generator=generator,
            ).images[0]
            return result.convert("RGB")
        except torch.cuda.OutOfMemoryError as exc:
            cleanup_torch_memory()
            raise GPUOutOfMemoryError("GPU memory was exhausted during Stable Diffusion inference.") from exc
        except Exception as exc:
            logger.exception("Stable Diffusion inference failed")
            raise ReconstructionError("Stable Diffusion inference failed.") from exc
