from io import BytesIO
from PIL import Image


SUPPORTED_FORMATS = {"PNG", "JPEG", "WEBP"}


def load_pil(data: bytes) -> Image.Image:
    with Image.open(BytesIO(data)) as img:
        img.verify()
    with Image.open(BytesIO(data)) as img:
        return img.convert("RGB").copy()


def encode_png(image: Image.Image) -> bytes:
    out = BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def image_size(image: Image.Image) -> tuple[int, int]:
    return image.size
