import cv2
import numpy as np
from PIL import Image


def create_difference_image(original: Image.Image, final: Image.Image, mask: Image.Image) -> Image.Image:
    a = cv2.cvtColor(np.asarray(original.convert("RGB")), cv2.COLOR_RGB2BGR)
    b = cv2.cvtColor(np.asarray(final.convert("RGB")), cv2.COLOR_RGB2BGR)
    diff = cv2.absdiff(a, b)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    heat = cv2.applyColorMap(np.clip(gray * 4, 0, 255).astype(np.uint8), cv2.COLORMAP_JET)
    m = np.asarray(mask.convert("L")) >= 128
    # Keep the visualization focused on changes, while retaining context outside the mask.
    heat[~m] = (heat[~m] * 0.25).astype(np.uint8)
    return Image.fromarray(cv2.cvtColor(heat, cv2.COLOR_BGR2RGB))
