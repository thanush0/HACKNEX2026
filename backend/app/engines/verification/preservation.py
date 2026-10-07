import numpy as np
from PIL import Image


def preservation_metrics(original: Image.Image, final: Image.Image, mask: Image.Image) -> dict:
    a = np.asarray(original.convert("RGB"), dtype=np.int16)
    b = np.asarray(final.convert("RGB"), dtype=np.int16)
    m = np.asarray(mask.convert("L")) >= 128
    outside = ~m
    if not outside.any():
        return {"preservation_score": None, "changed_pixels_outside_mask": 0}
    diff = np.max(np.abs(a - b), axis=2)
    changed = int(np.count_nonzero((diff > 0) & outside))
    mean_error = float(np.mean(diff[outside]))
    score = max(0.0, 1.0 - mean_error / 255.0)
    return {"preservation_score": score, "changed_pixels_outside_mask": changed}
