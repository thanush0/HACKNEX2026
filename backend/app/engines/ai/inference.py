from PIL import Image
from .base import BaseInpaintingEngine, GenerationRequest


def run_inference(engine: BaseInpaintingEngine, image: Image.Image, mask: Image.Image, **kwargs) -> Image.Image:
    return engine.generate(GenerationRequest(image=image, mask=mask, **kwargs))
