import cv2
import numpy as np
from PIL import Image


def prepare_image(image: Image.Image, resolution: int) -> Image.Image:
    image = image.convert("RGB")
    w, h = image.size
    scale = min(1.0, resolution / max(w, h))
    if scale == 1:
        return image
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    arr = np.asarray(image)
    arr = cv2.resize(arr, (nw, nh), interpolation=cv2.INTER_AREA)
    return Image.fromarray(arr, "RGB")


def resize_to(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.LANCZOS)
