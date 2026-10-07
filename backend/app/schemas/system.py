from pydantic import BaseModel


class SystemResponse(BaseModel):
    status: str
    python_version: str
    torch_version: str | None
    device: str
    gpu_available: bool
    gpu_name: str | None
    vram_total: str | None
    vram_free: str | None
    online: bool = True
    gpu: str | None = None
    vram: float | None = None
    model: str | None = None
    engine: str | None = None
