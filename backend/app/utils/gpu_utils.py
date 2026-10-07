import gc
import logging
import platform

logger = logging.getLogger(__name__)


def detect_device(configured: str = "auto", enable_gpu: bool = True) -> str:
    if not enable_gpu or configured.lower() == "cpu":
        return "cpu"
    try:
        import torch
        if configured.lower() in {"cuda", "cuda:0"} and torch.cuda.is_available():
            return "cuda"
        if configured.lower() not in {"auto", ""}:
            return configured
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        logger.exception("Unable to inspect CUDA")
    return "cpu"


def gpu_info() -> dict:
    try:
        import torch
        if not torch.cuda.is_available():
            return {"available": False, "device": "cpu", "name": None, "total": None, "free": None}
        idx = torch.cuda.current_device()
        props = torch.cuda.get_device_properties(idx)
        free, total = torch.cuda.mem_get_info(idx)
        return {
            "available": True,
            "device": f"cuda:{idx}",
            "name": props.name,
            "total": total,
            "free": free,
        }
    except Exception:
        logger.exception("GPU information lookup failed")
        return {"available": False, "device": "cpu", "name": None, "total": None, "free": None}


def cleanup_torch_memory() -> None:
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        logger.debug("Torch memory cleanup failed", exc_info=True)


def format_bytes(value: int | None) -> str | None:
    if value is None:
        return None
    units = ["B", "KB", "MB", "GB", "TB"]
    x = float(value)
    for unit in units:
        if x < 1024 or unit == units[-1]:
            return f"{x:.2f} {unit}"
        x /= 1024
    return None
