# SCENERA Backend

Production-oriented FastAPI backend for **SCENERA — Generative Computer Vision & Scene Reconstruction**.

The backend is independent of the React UI. Its primary contract is:

`image + mask + reconstruction parameters -> asynchronous job -> result URLs + real verification metrics`

## 1. Requirements

- Windows 10/11
- VS Code
- Python 3.11
- NVIDIA GPU + compatible NVIDIA driver/CUDA-enabled PyTorch for local GPU inference (optional for API/unit-test work)
- Internet access for first-time Hugging Face model downloads

The code also detects CPU mode. CPU inference for SD/SDXL can be extremely slow and is not recommended for the hackathon MVP.

## 2. Windows PowerShell setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks activation, use the VS Code terminal or execute:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

## 3. PyTorch / NVIDIA note

PyTorch wheels are sensitive to the installed CUDA runtime and GPU driver. Install the appropriate official CUDA-enabled PyTorch wheel for the machine rather than assuming a toolkit version.

Verify:

```powershell
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```

Do not treat a printed CUDA version alone as proof that inference will fit in GPU memory.

## 4. Environment

Copy `.env.example` to `.env`.

Important values:

- `CORS_ORIGINS=http://localhost:5173`
- `DEVICE=auto`
- `ENABLE_GPU=true`
- `PRELOAD_MODEL=false`
- `SD_MODEL_ID=...`
- `SDXL_MODEL_ID=...`
- `MODEL_CACHE_DIR=./models`
- `MAX_UPLOAD_SIZE_MB=20`

Do not commit `.env` or downloaded model weights.

## 5. Run

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## 6. API

For the canonical API, use `/api/...`. The uploaded Vite frontend rewrites `/api` away during development, so equivalent unprefixed compatibility routes are also registered.

### Health

`GET /api/health`

Does not load an AI model.

### System

`GET /api/system`

Reports CPU/CUDA status and real GPU/VRAM information. It never fabricates GPU values.

### Upload

`POST /api/upload` (also `/upload`)

This validates and stages an image. The reconstruction endpoint remains self-contained and accepts the image again.

### Reconstruction

`POST /api/reconstruct`

Multipart fields:

- `image`: PNG/JPEG/WEBP
- `mask`: PNG/JPEG/WEBP, same dimensions
- `params`: JSON string

The frontend can also send the reconstruction parameters as individual form fields.

Example JSON:

```json
{
  "prompt": "a realistic clean wall continuing naturally",
  "negative_prompt": "blurry, distorted, duplicate",
  "mode": "MEDIUM",
  "seed": 12345,
  "steps": 30,
  "guidance_scale": 7.5,
  "strength": 0.8,
  "resolution": 1024,
  "preserve_original": true,
  "scheduler": "DPM++ 2M"
}
```

Response:

```json
{
  "jobId": "uuid",
  "job_id": "uuid",
  "status": "queued"
}
```

Poll:

`GET /api/reconstruct/{job_id}`

Frontend-compatible alias:

`GET /api/jobs/{job_id}`

Metrics:

`GET /api/reconstruct/{job_id}/metrics`

`POST /api/metrics` can also calculate metrics directly from `original`, `final`, and `mask` multipart images.

Frontend-compatible alias:

`GET /api/jobs/{job_id}/metrics`

## 7. Frontend compatibility

The uploaded React frontend currently uses:

- `POST /api/reconstruct`
- `GET /api/jobs/{id}`
- `GET /api/jobs/{id}/metrics`
- response field `jobId`

Those routes are supported as compatibility aliases without changing the backend architecture.

The frontend expects stage names such as:

`analysis`, `mask`, `understanding`, `generation`, `refinement`, `preservation`, `verification`, `complete`

The backend reports these stages from the actual job pipeline. Stage progress is intentionally coarse; it is not fake per-step diffusion progress.

## 8. Mask convention

`BLACK = preserve`

`WHITE = reconstruct`

The backend converts the incoming mask to binary form and verifies its dimensions.

## 9. Reconstruction modes

### FAST

Stable Diffusion Inpainting.

### MEDIUM

SDXL Inpainting.

### MAX

Stable Diffusion inpainting followed by SDXL refinement, using the first generated image as the second-stage input.

The model manager prevents unnecessary simultaneous retention of both large pipelines and performs cleanup/offloading appropriate to the device.

## 10. Original-pixel preservation

When `preserve_original=true`, the final image is explicitly composited:

- outside mask: original pixels
- inside mask: generated pixels

Verification calculates changed pixels outside the mask from actual image data.

## 11. Difference map

A server-generated difference image is written to `temp/results/` and returned through a controlled `/api/results/...` URL.

The backend never exposes arbitrary filesystem paths.

## 12. Testing

Run:

```powershell
pytest -q
```

Unit tests do not require downloading the AI models.

Model integration should be tested separately on the actual NVIDIA machine.

## 13. Architecture

```text
FastAPI route
    |
    v
ReconstructionService
    |
    +--> ImageService
    +--> MaskService
    +--> ModelManager
    |       |
    |       +--> Stable Diffusion
    |       +--> SDXL
    |       +--> MAX pipeline
    |
    +--> CV compositor
    |
    +--> Verification engine
            |
            +--> preservation metrics
            +--> difference map
```

No AI implementation is placed in API route modules.

## 14. GPU memory

The target development GPU is an NVIDIA GTX 1650. This is a constrained-VRAM device.

Recommended sequence:

1. Start with `FAST`.
2. Verify CUDA and one inpainting pipeline.
3. Test `MEDIUM`.
4. Test `MAX` only after the first two are stable.
5. Keep `PRELOAD_MODEL=false` during development.
6. Avoid loading SD and SDXL simultaneously unless the machine can support it.

`enable_model_cpu_offload`, VAE slicing/tiling, cache cleanup, and model release are used where compatible.

## 15. Video

`POST /api/video/reconstruct` is a foundation only.

Set:

`ENABLE_VIDEO=true`

only after the image MVP is stable. The current implementation deliberately returns a controlled not-enabled/not-implemented response instead of pretending to reconstruct video.

## 16. Future multi-worker interface

The first release is single-machine. A worker abstraction can later wrap:

- worker ID
- device
- capabilities
- health
- submit job
- status
- cancellation

Redis/Celery is intentionally not introduced into the MVP.

## 17. Troubleshooting

### `torch.cuda.is_available()` is false

Check:

- NVIDIA driver
- correct PyTorch wheel
- active virtual environment
- Python 3.11 environment
- `nvidia-smi`

### Model download fails

Check internet access, Hugging Face availability, disk space, and model ID in `.env`.

### CUDA out of memory

Try:

- FAST instead of MEDIUM/MAX
- lower `resolution`
- lower `steps`
- keep `PRELOAD_MODEL=false`
- ensure no other GPU applications are using VRAM

### Frontend cannot display result images

Ensure the backend is running on `127.0.0.1:8000`, the frontend is on `localhost:5173`, and CORS includes the exact frontend origin.

## 18. Security

- Upload size is limited.
- Client filenames are not used as storage paths.
- Only controlled result files are served.
- User input is not passed to a shell.
- Prompt and numeric parameters are validated.
- Internal stack traces are logged server-side but not returned to clients.


## Phase 4 — Video Reconstruction

The existing image architecture now includes sequential video reconstruction with a static per-frame mask, temporal stabilization, verification, background jobs, progress, and cancellation.

### Run

PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://127.0.0.1:8000/docs`.

Set `ENABLE_VIDEO=true` for Phase 4. The first real-AI run downloads the configured Diffusers model(s), so model cache size and GTX 1650 VRAM must be considered.

### Video API

1. `POST /api/video/upload` — upload video, optionally with a static mask.
2. `POST /api/video/{video_id}/mask` — attach/replace a static mask.
3. `POST /api/video/reconstruct` — queue a reconstruction job.
4. `GET /api/video/jobs/{job_id}` — real frame-based progress/status.
5. `GET /api/video/jobs/{job_id}/metrics` — calculated temporal/preservation metrics.
6. `POST /api/video/jobs/{job_id}/cancel` — request cancellation.

The video loop processes one frame at a time, reuses the existing model manager, performs conservative optical-flow-guided temporal stabilization inside the mask, and composites the original pixels back outside the mask.

### Frontend connection

From `frontend`:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend `.env.example` uses:

```text
VITE_USE_MOCK=false
VITE_API_URL=/api
```

Vite proxies `/api` to the FastAPI server on port 8000.

### Phase 4 limitations

- The implemented mask workflow is a static mask applied to every frame. Per-frame masks/tracking remain an extension point.
- Temporal stabilization uses dense optical flow plus conservative masked-region blending; it is not a full learned video diffusion model.
- Video output uses OpenCV's available MP4 codecs and falls back between common codecs.
- Real AI video reconstruction remains compute-intensive, especially in MAX mode on a GTX 1650.
