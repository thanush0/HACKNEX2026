import numpy as np
from PIL import Image

from app.engines.cv.compositor import composite_preserving_original
from app.utils.mask_utils import mask_coverage, normalize_mask


def test_mask_normalization():
    mask = Image.fromarray(np.array([[0, 255], [255, 0]], dtype=np.uint8), "L")
    out = normalize_mask(mask)
    assert mask_coverage(out) == 0.5


def test_pixel_preservation():
    original = Image.fromarray(np.zeros((2, 2, 3), dtype=np.uint8) + 10, "RGB")
    generated = Image.fromarray(np.zeros((2, 2, 3), dtype=np.uint8) + 200, "RGB")
    mask = Image.fromarray(np.array([[0, 255], [0, 255]], dtype=np.uint8), "L")
    final = np.asarray(composite_preserving_original(original, generated, mask))
    assert np.all(final[:, 0] == 10)
    assert np.all(final[:, 1] == 200)
