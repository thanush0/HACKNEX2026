from PIL import Image

from app.engines.verification.preservation import preservation_metrics
from app.utils.mask_utils import mask_coverage


def calculate_metrics(original: Image.Image, final: Image.Image, mask: Image.Image, processing_time: float | None, model: str | None, mode: str, seed: int | None) -> dict:
    preservation = preservation_metrics(original, final, mask)
    return {
        **preservation,
        "mask_coverage": mask_coverage(mask),
        "processing_time": processing_time,
        "resolution": f"{original.width}×{original.height}",
        "model": model,
        "mode": mode,
        "seed": seed,
    }
