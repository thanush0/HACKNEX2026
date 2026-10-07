import os
import re
from pathlib import Path
from uuid import uuid4

from app.core.exceptions import FileTooLargeError, InvalidImageError


def safe_filename(original: str | None, suffix: str = "") -> str:
    base = Path(original or "upload").stem
    base = re.sub(r"[^A-Za-z0-9_.-]+", "_", base)[:80] or "upload"
    return f"{uuid4().hex}_{base}{suffix}"


def ensure_dirs(*paths: str) -> None:
    for path in paths:
        Path(path).mkdir(parents=True, exist_ok=True)


def ensure_file_size(size: int, max_bytes: int) -> None:
    if size > max_bytes:
        raise FileTooLargeError("Uploaded file exceeds the configured size limit.")


def is_allowed_image_suffix(name: str) -> bool:
    return Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}


def remove_file(path: str | Path) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
