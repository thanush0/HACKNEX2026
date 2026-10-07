import logging
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.exceptions import InvalidImageError
from app.utils.file_utils import ensure_file_size
from app.utils.image_utils import load_pil

logger = logging.getLogger(__name__)


class ImageService:
    def __init__(self, settings):
        self.settings = settings

    async def read_and_validate(self, upload: UploadFile):
        if not upload.filename:
            raise InvalidImageError("Image file is required.")
        data = await upload.read()
        ensure_file_size(len(data), self.settings.max_upload_bytes)
        try:
            image = load_pil(data)
        except Exception as exc:
            raise InvalidImageError("Uploaded file is not a valid PNG, JPEG, or WEBP image.") from exc
        if max(image.size) > self.settings.MAX_DIMENSION:
            raise InvalidImageError(f"Image dimensions exceed {self.settings.MAX_DIMENSION}px.")
        if min(image.size) < 2:
            raise InvalidImageError("Image dimensions are invalid.")
        path = Path(self.settings.UPLOAD_DIR) / f"{uuid4().hex}.png"
        image.save(path, format="PNG")
        return image, path
