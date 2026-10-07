from abc import ABC, abstractmethod
from dataclasses import dataclass
from PIL import Image


@dataclass
class GenerationRequest:
    image: Image.Image
    mask: Image.Image
    prompt: str
    negative_prompt: str
    steps: int
    guidance_scale: float
    strength: float
    resolution: int
    seed: int
    scheduler: str = "DPM++ 2M"


class BaseInpaintingEngine(ABC):
    name: str = "base"

    @abstractmethod
    def load(self) -> None:
        ...

    @abstractmethod
    def unload(self) -> None:
        ...

    @abstractmethod
    def generate(self, request: GenerationRequest) -> Image.Image:
        ...

    @abstractmethod
    def is_loaded(self) -> bool:
        ...

    @abstractmethod
    def get_device(self) -> str:
        ...
