from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.exceptions import InvalidMaskError
from app.utils.file_utils import ensure_file_size
from app.utils.image_utils import load_pil
from app.engines.cv.mask_processor import prepare_mask
from app.utils.mask_utils import mask_coverage


class MaskService:
    def __init__(self, settings):
        self.settings = settings

    async def read_and_validate(self, upload: UploadFile, image_size: tuple[int, int], *, feather: int = 0, expansion: int = 0, blur: int = 0):
        if not upload.filename:
            raise InvalidMaskError("Mask file is required.")
        data = await upload.read()
        ensure_file_size(len(data), self.settings.max_upload_bytes)
        try:
            raw = load_pil(data).convert("L")
        except Exception as exc:
            raise InvalidMaskError("Uploaded mask is not a valid image.") from exc
        if raw.size != image_size:
            raise InvalidMaskError("Mask dimensions must match the input image.")
        mask = prepare_mask(raw, image_size, feather=feather, expansion=expansion, blur=blur)
        coverage = mask_coverage(mask)
        if coverage < self.settings.MIN_MASK_COVERAGE:
            raise InvalidMaskError("Mask contains too little reconstructable area.")
        path = Path(self.settings.MASK_DIR) / f"{uuid4().hex}.png"
        mask.save(path, format="PNG")
        return mask, path, coverage
