from PIL import Image

from app.engines.cv.compositor import composite_preserving_original
from .base import BaseInpaintingEngine, GenerationRequest
from .stable_diffusion import StableDiffusionInpaintingEngine
from .sdxl import SDXLInpaintingEngine


class MaxPipeline:
    name = "Stable Diffusion → SDXL Refinement"

    def __init__(self, sd: StableDiffusionInpaintingEngine, sdxl: SDXLInpaintingEngine):
        self.sd = sd
        self.sdxl = sdxl

    def generate(self, request: GenerationRequest) -> Image.Image:
        intermediate = self.sd.generate(request)
        # Release SD before loading SDXL on constrained GPUs.
        self.sd.unload()
        # Keep the first-stage output as the second-stage image; this is refinement,
        # not an unrelated second generation.
        refined_request = GenerationRequest(
            image=intermediate,
            mask=request.mask,
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            steps=request.steps,
            guidance_scale=request.guidance_scale,
            strength=min(request.strength, 0.8),
            resolution=request.resolution,
            seed=request.seed,
            scheduler=request.scheduler,
        )
        return self.sdxl.generate(refined_request)

    def unload(self) -> None:
        self.sd.unload()
        self.sdxl.unload()
