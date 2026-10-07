# SCENERA

SCENERA is a web application for reconstructing selected regions of images and videos with generative inpainting. The frontend provides an image workspace for drawing a mask, configuring generation, and reviewing results. A FastAPI backend validates uploads, runs the configured image models, restores original pixels outside the mask when requested, and calculates verification metrics.

The repository contains two independently run applications:

- `frontend/` — React 18, Vite, Tailwind CSS, and Fabric.js.
- `backend/` — FastAPI, Pillow, OpenCV, and Diffusers/PyTorch inference.

## Features

- Image upload for PNG, JPEG, and WebP, with an interactive canvas for painting, erasing, and editing a reconstruction mask.
- FAST, MEDIUM, and MAX image modes, prompts, seeds, generation settings, and scheduler selection.
- Asynchronous image jobs with status polling, results, downloads, analytics, and a before/after comparison viewer.
- Verification metrics and a browser-side difference map. The backend can also produce a difference image.
- Video upload, one static mask applied to each frame, sequential frame reconstruction, temporal stabilization, cancellation, progress, MP4 output, and video metrics.
- A frontend mock mode for exploring the image interface without running model inference. Mock results are labelled as simulated and do not claim to be AI-generated.

## Requirements

- Node.js and npm for the frontend.
- Python 3.11 for the backend; use the versions and package ranges in `backend/requirements.txt`.
- Internet access and disk space for first-time model downloads when running real inference.
- An NVIDIA GPU with a compatible driver and CUDA-enabled PyTorch is recommended. CPU mode is detected, but Stable Diffusion inference on CPU can be very slow. GPU memory needs depend on mode, model, input size, and settings.

## Run locally

Run the backend and frontend in separate terminals.

### Backend (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Backend (macOS/Linux)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

The checked-in `frontend/.env.example` selects live backend mode and the `/api` base path. Copy it to `.env` if you want to set the values explicitly:

```bash
cp .env.example .env
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env` instead of `cp`. The Vite development server runs at `http://localhost:5173` and proxies `/api` requests to `http://localhost:8000`.

Set `VITE_USE_MOCK=true` in `frontend/.env` to use the image UI without backend inference. Set `VITE_USE_MOCK=false` for live image reconstruction and video features. Video reconstruction requires the backend; it is unavailable in frontend mock mode.

## Configuration

Backend settings are loaded from `backend/.env` (based on `backend/.env.example`). Common settings include:

| Setting | Purpose |
| --- | --- |
| `CORS_ORIGINS` | Allowed browser origins; defaults to `http://localhost:5173`. |
| `DEVICE` and `ENABLE_GPU` | Select and enable automatic or explicit compute device behavior. |
| `SD_MODEL_ID` and `SDXL_MODEL_ID` | Hugging Face model IDs used by the inpainting pipelines. |
| `MODEL_CACHE_DIR` | Location for downloaded model files. |
| `PRELOAD_MODEL` | Whether to attempt loading the default model at startup. Defaults to `false`. |
| `MAX_UPLOAD_SIZE_MB` | Maximum image upload size. Defaults to 20 MB. |
| `MAX_VIDEO_UPLOAD_SIZE_MB` | Maximum video upload size. Defaults to 500 MB. |
| `MAX_VIDEO_DURATION_SECONDS` | Maximum video duration. Defaults to 300 seconds. |
| `ENABLE_VIDEO` | Enables the video reconstruction API. Defaults to `true`. |

Keep `.env` files, uploaded media, generated results, and model weights out of version control. Real model downloads and inference may require substantial disk space, memory, and GPU resources. Begin with FAST mode on constrained GPUs; MEDIUM and MAX require more resources.

## How reconstruction works

For image reconstruction, the UI exports a mask at the source image dimensions and submits the source image, mask, and generation parameters. White mask pixels identify areas to reconstruct; black pixels identify areas to preserve. The backend validates the inputs and parameters, queues a job, runs the selected pipeline, composites original pixels outside the mask when `preserve_original` is enabled, then calculates metrics and result URLs.

| Mode | Pipeline |
| --- | --- |
| FAST | Stable Diffusion inpainting |
| MEDIUM | SDXL inpainting |
| MAX | Stable Diffusion followed by SDXL refinement |

For video, the backend extracts frames and processes them sequentially with the selected image pipeline. The uploaded static mask is applied to every frame. Optical-flow-guided temporal stabilization is applied conservatively inside the mask; original pixels outside the mask can be preserved. The output is encoded with available MP4 codecs. This is a frame-based workflow, not a learned video diffusion model, and per-frame masks or object tracking are not implemented.

## API overview

Interactive API documentation is available at `http://127.0.0.1:8000/docs`; ReDoc is at `http://127.0.0.1:8000/redoc`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/system` | Backend, device, and GPU status. |
| `POST` | `/api/upload` | Validate and stage an image upload. |
| `POST` | `/api/reconstruct` | Queue an image reconstruction job (`image`, `mask`, and JSON `params` multipart fields). |
| `GET` | `/api/reconstruct/{job_id}` | Image job status and result. |
| `GET` | `/api/reconstruct/{job_id}/metrics` | Image verification metrics. |
| `POST` | `/api/metrics` | Calculate metrics from original, final, and mask images. |
| `POST` | `/api/video/upload` | Upload a video and optionally a static mask. |
| `POST` | `/api/video/{video_id}/mask` | Attach or replace the video mask. |
| `POST` | `/api/video/reconstruct` | Queue video reconstruction. |
| `GET` | `/api/video/jobs/{job_id}` | Video job status and progress. |
| `GET` | `/api/video/jobs/{job_id}/metrics` | Video metrics. |
| `POST` | `/api/video/jobs/{job_id}/cancel` | Request video job cancellation. |

The backend also exposes compatibility routes used by the Vite proxy and existing clients. See [`backend/README.md`](backend/README.md) for request details, response examples, environment settings, and troubleshooting.

## Repository map

```text
backend/
  app/api/             FastAPI route modules
  app/core/            Settings, dependencies, and error handling
  app/engines/         AI, computer vision, verification, and video engines
  app/schemas/         Request and response validation models
  app/services/        Image, mask, reconstruction, system, and video workflows
  app/utils/            File, image, mask, GPU, and timing helpers
  tests/                Backend API and processing tests
frontend/
  src/App.jsx           Application shell and view routing
  src/components/       Workspace, AI controls, results, and video UI
  src/hooks/            Application state and workflows
  src/services/api.js   Backend and mock API client
  src/lib/               Constants and user-facing errors
```

## Checks

Run the backend tests from `backend/`:

```bash
pytest -q
```

Run the frontend production build from `frontend/`:

```bash
npm run build
```

Unit tests do not need model downloads. Passing tests or a successful frontend build does not confirm that a particular machine has enough GPU memory or that a downloaded model can run successfully; validate real inference on the target machine.

## More documentation

- [Backend setup, API contract, architecture, and troubleshooting](backend/README.md)
- [Frontend structure, mock behavior, API contract, and shortcuts](frontend/README.md)
- [Implementation report](IMPLEMENTATION_REPORT.md)
