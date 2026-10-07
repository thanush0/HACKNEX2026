# SCENERA frontend

React + Vite + Tailwind + Fabric.js. No state library, no Axios.

    npm install
    cp .env.example .env
    npm run dev

## Layers
UI components -> `hooks/useScenera.js` (state) -> `services/api.js` (only file that calls fetch) -> FastAPI.
Fabric.js is isolated in `components/workspace/CanvasEditor.jsx` and driven through props and an imperative ref.

## Mock vs live
`VITE_USE_MOCK=true` (default): no inference. Progress is simulated and labelled "simulated", the "generated" image is the original,
unknown metrics show UNAVAILABLE, system fields show UNKNOWN. Mask coverage is real (measured from your mask).
`VITE_USE_MOCK=false`: calls `VITE_API_URL` (default `/api`, proxied to http://localhost:8000 by vite.config.js).

## Backend contract (FastAPI)
| Method | Path | Notes |
|---|---|---|
| POST | /upload | multipart `image` -> `{imageId}` |
| POST | /reconstruct | multipart `image`, `mask` (white = rebuild, PNG at image size), `params` (JSON) -> `{jobId}` |
| GET | /jobs/{id} | `{status: queued/running/complete/failed, stage, progress 0..1 or null, message, error?: {code}, result?: {variants:[{generatedUrl, finalUrl}]}}` |
| GET | /jobs/{id}/metrics | `{preservationScore 0..1, maskCoverage 0..1, processingTime seconds, resolution, model, mode, seed}` |
| GET | /system | `{online, gpu, vram (GB), model, engine}`; unknown = null |

Stages: analysis, mask, understanding, generation, refinement, preservation, verification, complete.
Error codes: NO_MASK, GPU_UNAVAILABLE, GENERATION_FAILED, IMAGE_TOO_LARGE, UNSUPPORTED_FILE.
Result image URLs must be CORS-readable for the difference map and downloads.

## Shortcuts
B brush, E eraser, V select, H pan, Z zoom, M mask visibility, G grid, hold Space to pan, Ctrl+Z undo, Ctrl+Shift+Z redo.


## Phase 4 video

Set `VITE_USE_MOCK=false` and run the FastAPI backend at `http://127.0.0.1:8000`. The Vite proxy forwards `/api` requests to FastAPI.

The Video workspace supports video upload, first-frame static mask painting, FAST/MEDIUM/MAX selection, temporal strength, real job progress, cancellation, result playback, and backend-calculated metrics.

```powershell
npm install
npm run dev
```
