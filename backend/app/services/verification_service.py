from pathlib import Path
from uuid import uuid4

from app.engines.verification.difference import create_difference_image
from app.engines.verification.metrics import calculate_metrics


class VerificationService:
    def __init__(self, settings):
        self.settings = settings

    def verify(self, original, final, mask, *, processing_time, model, mode, seed):
        metrics = calculate_metrics(original, final, mask, processing_time, model, mode, seed)
        diff = create_difference_image(original, final, mask)
        path = Path(self.settings.RESULT_DIR) / f"difference_{uuid4().hex}.png"
        diff.save(path, format="PNG")
        return metrics, path
