# SCENERA Phase 4 — Completed Integration

## 1. Existing project inspected

- `backend/app/api/video.py`
- `backend/app/services/video_service.py`
- `backend/app/engines/video/frame_processor.py`
- `backend/app/engines/video/temporal.py`
- `backend/app/engines/video/encoder.py`
- existing reconstruction service/model manager/AI engines
- mask service and compositor
- verification and schemas
- frontend API service
- React application shell/workspace/results/hooks
- existing backend tests

## 2. Modified

### Backend
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/app/api/video.py`
- `backend/app/services/video_service.py`
- `backend/app/engines/video/frame_processor.py`
- `backend/app/engines/video/temporal.py`
- `backend/app/engines/video/encoder.py`
- `backend/app/engines/ai/model_manager.py`
- `backend/app/schemas/video.py`
- `backend/README.md`
- `backend/.env.example`

### Frontend
- `frontend/src/services/api.js`
- `frontend/src/App.jsx`
- `frontend/src/components/layout/Shell.jsx`
- `frontend/vite.config.js`
- `frontend/README.md`
- `frontend/.env.example`

## 3. Created

- `frontend/src/components/video/VideoWorkspace.jsx`
- `backend/tests/test_video_phase4.py`
- `IMPLEMENTATION_REPORT.md`

## 4. Completed

- video upload and metadata extraction
- static mask attachment
- sequential frame processing
- FAST/MEDIUM/MAX reuse of existing AI engines
- original-pixel preservation after generation
- optical-flow-guided temporal stabilization inside the mask
- frame-difference/flicker/temporal metrics
- background video jobs
- real frame-based progress
- cancellation
- MP4 encoding with codec fallback
- verification report
- frontend video upload/mask painting
- frontend mode/prompt/temporal controls
- frontend progress/cancellation
- frontend result playback and metrics
- canonical `/api` frontend/backend connection

## 5. Tests

Backend test suite: **8 passed**.

The end-to-end video test uses a deterministic fake AI engine so normal tests do not download large Diffusers models.

## 6. Real-AI limitation

The full video path requires the configured Diffusers models and suitable GPU/CPU resources. No fake reconstruction output or fake metrics were added.

Real GPU integration should be run on the Windows NVIDIA CUDA machine after installing the backend dependencies and downloading the configured models.

## 7. Frontend validation

The uploaded archive contained an incomplete/non-runnable `node_modules` tree in this Linux validation environment; `vite` was not executable/available after dependency installation could not complete. The frontend source/configuration was updated, but a real production Vite build must be run in the project's normal Windows environment with:

```powershell
cd frontend
npm install
npm run build
```

## 8. Run both sides

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://127.0.0.1:8000`

Swagger: `http://127.0.0.1:8000/docs`

The frontend `.env` defaults to live backend mode:

```text
VITE_USE_MOCK=false
VITE_API_URL=/api
```
