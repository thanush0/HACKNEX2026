import cv2
import numpy as np
from PIL import Image


def pil_to_mask_array(mask: Image.Image) -> np.ndarray:
    return np.asarray(mask.convert("L"), dtype=np.uint8)


def normalize_mask(mask: Image.Image, feather: int = 0, expansion: int = 0, blur: int = 0) -> Image.Image:
    arr = pil_to_mask_array(mask)
    arr = np.where(arr >= 128, 255, 0).astype(np.uint8)
    if expansion:
        k = max(1, int(expansion) * 2 + 1)
        arr = cv2.dilate(arr, np.ones((k, k), np.uint8), iterations=1)
    if blur:
        k = max(3, int(blur) * 2 + 1)
        if k % 2 == 0:
            k += 1
        arr = cv2.GaussianBlur(arr, (k, k), 0)
    if feather:
        k = max(3, int(feather) * 2 + 1)
        if k % 2 == 0:
            k += 1
        arr = cv2.GaussianBlur(arr, (k, k), 0)
    return Image.fromarray(arr, mode="L")


def mask_coverage(mask: Image.Image) -> float:
    arr = pil_to_mask_array(mask)
    return float(np.mean(arr >= 128))
