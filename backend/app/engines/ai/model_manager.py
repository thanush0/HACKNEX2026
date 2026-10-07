import logging, threading
from app.core.exceptions import ModelUnavailableError
from app.utils.gpu_utils import cleanup_torch_memory, detect_device
from .base import BaseInpaintingEngine
from .max_pipeline import MaxPipeline
from .sdxl import SDXLInpaintingEngine
from .stable_diffusion import StableDiffusionInpaintingEngine
logger=logging.getLogger(__name__)

class ModelManager:
    def __init__(self, settings):
        self.settings=settings; self.device=detect_device(settings.DEVICE,settings.ENABLE_GPU)
        self.sd=StableDiffusionInpaintingEngine(settings.SD_MODEL_ID,self.device,settings.MODEL_CACHE_DIR)
        self.sdxl=SDXLInpaintingEngine(settings.SDXL_MODEL_ID,self.device,settings.MODEL_CACHE_DIR)
        self.max_pipeline=MaxPipeline(self.sd,self.sdxl); self._lock=threading.RLock(); self._inference_lock=threading.RLock(); self._active=None
    def engine_for(self,mode:str):
        mode=mode.upper()
        if mode=="FAST": return self.sd
        if mode=="MEDIUM": return self.sdxl
        if mode=="MAX": return self.max_pipeline
        raise ModelUnavailableError(f"Unsupported reconstruction mode: {mode}.")
    def prepare(self,mode:str):
        mode=mode.upper()
        with self._lock:
            if mode=="MAX":
                # MAX manages its two stages itself so constrained GPUs do not retain both pipelines.
                self._active=mode
                return self.max_pipeline
            engine=self.engine_for(mode)
            other=self.sdxl if mode=="FAST" else self.sd
            if other.is_loaded(): other.unload()
            engine.load(); self._active=mode
            return engine
    @property
    def inference_lock(self): return self._inference_lock
    def release(self):
        with self._lock:
            self.sd.unload(); self.sdxl.unload(); self._active=None; cleanup_torch_memory()
    def status(self):
        return {"device":self.device,"active_mode":self._active,"sd_loaded":self.sd.is_loaded(),"sdxl_loaded":self.sdxl.is_loaded()}
