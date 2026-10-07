import platform
import sys

from app.utils.gpu_utils import format_bytes, gpu_info


class SystemService:
    def __init__(self, settings, model_manager):
        self.settings = settings
        self.model_manager = model_manager

    def status(self) -> dict:
        g = gpu_info()
        active = self.model_manager.status().get("active_mode")
        return {
            "status": "ready",
            "python_version": platform.python_version(),
            "torch_version": self._torch_version(),
            "device": g["device"],
            "gpu_available": g["available"],
            "gpu_name": g["name"],
            "vram_total": format_bytes(g["total"]),
            "vram_free": format_bytes(g["free"]),
            "online": True,
            "gpu": g["name"],
            "vram": round(g["total"] / (1024**3), 2) if g["total"] else None,
            "model": active,
            "engine": "diffusers" if active else None,
        }

    @staticmethod
    def _torch_version():
        try:
            import torch
            return torch.__version__
        except Exception:
            return None
