import numpy as np
from PIL import Image


def composite_preserving_original(original: Image.Image, generated: Image.Image, mask: Image.Image) -> Image.Image:
    original = original.convert("RGB")
    generated = generated.convert("RGB").resize(original.size, Image.Resampling.LANCZOS)
    m = np.asarray(mask.convert("L"), dtype=np.float32) / 255.0
    a = np.asarray(original, dtype=np.float32)
    b = np.asarray(generated, dtype=np.float32)
    out = a * (1.0 - m[..., None]) + b * m[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
