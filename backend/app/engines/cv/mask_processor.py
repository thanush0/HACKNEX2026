from PIL import Image

from app.core.exceptions import InvalidMaskError
from app.utils.mask_utils import mask_coverage, normalize_mask


def prepare_mask(mask: Image.Image, image_size: tuple[int, int], feather: int = 0, expansion: int = 0, blur: int = 0) -> Image.Image:
    mask = mask.convert("L")
    if mask.size != image_size:
        raise InvalidMaskError("Mask dimensions must match the input image.")
    mask = normalize_mask(mask, feather=feather, expansion=expansion, blur=blur)
    coverage = mask_coverage(mask)
    if coverage <= 0:
        raise InvalidMaskError("Mask contains no reconstructable region.")
    if coverage >= 0.99:
        raise InvalidMaskError("Mask covers almost the entire image.")
    return mask
