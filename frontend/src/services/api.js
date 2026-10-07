// Service layer: the ONLY place that talks to the backend. UI never calls fetch directly.
// Mock mode is on unless VITE_USE_MOCK=false. Mock mode runs no inference: the "generated" image is the
// original, progress is simulated (flagged `simulated: true`), and unknown values are null (UI shows UNAVAILABLE).
import { ApiError } from '../lib/errors'
import { MODES, STAGES } from '../lib/constants'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
export const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function http(path, opts) {
  let res
  try { res = await fetch(API_BASE + path, opts) } catch { throw new ApiError('BACKEND_UNAVAILABLE') }
  if (!res.ok) {
    let code = res.status === 503 ? 'GPU_UNAVAILABLE' : 'GENERATION_FAILED'
    try { code = (await res.json()).code || code } catch { /* non-JSON error body */ }
    throw new ApiError(code)
  }
  return res.json()
}

const jobs = new Map()
const MOCK_MS = 6000

/** POST /upload (multipart: image) -> { imageId } */
export async function uploadImage(file) {
  if (USE_MOCK) return { imageId: null }
  const fd = new FormData(); fd.append('image', file)
  return http('/upload', { method: 'POST', body: fd })
}

/** POST /reconstruct (multipart: image, mask, params JSON) -> { jobId } */
export async function generateReconstruction({ image, mask, params, meta }) {
  if (USE_MOCK) {
    const jobId = crypto.randomUUID()
    jobs.set(jobId, { t0: performance.now(), params, meta })
    return { jobId }
  }
  const fd = new FormData()
  fd.append('image', image); fd.append('mask', mask, 'mask.png'); fd.append('params', JSON.stringify(params))
  return http('/reconstruct', { method: 'POST', body: fd })
}

/** GET /jobs/{id} -> { status: queued|running|complete|failed, stage, progress: 0..1|null, message, error?:{code}, result? }
 *  result = { variants: [{ generatedUrl, finalUrl }] }  (or flat { generatedUrl, finalUrl }) */
export async function getGenerationStatus(jobId) {
  if (!USE_MOCK) return http(`/jobs/${jobId}`)
  const j = jobs.get(jobId)
  const p = Math.min((performance.now() - j.t0) / MOCK_MS, 1)
  const i = p >= 1 ? STAGES.length - 1 : Math.floor(p * (STAGES.length - 1))
  return {
    status: p >= 1 ? 'complete' : 'running', stage: STAGES[i][0], progress: p, message: STAGES[i][1], simulated: true,
    result: p >= 1 ? { variants: [{ generatedUrl: j.meta.imageUrl, finalUrl: j.meta.imageUrl }] } : undefined,
  }
}

/** GET /jobs/{id}/metrics -> { preservationScore 0..1, maskCoverage 0..1, processingTime (s), resolution, model, mode, seed } */
export async function getMetrics(jobId) {
  if (!USE_MOCK) return http(`/jobs/${jobId}/metrics`)
  const j = jobs.get(jobId)
  return {
    preservationScore: null, maskCoverage: j.meta.coverage, processingTime: null,
    resolution: `${j.meta.w}×${j.meta.h}`, model: MODES.find(m => m.id === j.params.mode)?.full, mode: j.params.mode,
    seed: j.params.seed < 0 ? null : j.params.seed,
  }
}

/** GET /system -> { online, gpu, vram, model, engine }. Unknown values must be null. */
export async function getSystemStatus() {
  if (USE_MOCK) return { online: null, gpu: null, vram: null, model: null, engine: null }
  return http('/system')
}


export async function uploadVideo(file, mask = null) {
  if (USE_MOCK) throw new ApiError('VIDEO_BACKEND_REQUIRED')
  const fd = new FormData(); fd.append('video', file)
  if (mask) fd.append('mask', mask, 'video-mask.png')
  return http('/video/upload', { method: 'POST', body: fd })
}

export async function attachVideoMask(videoId, mask) {
  const fd = new FormData(); fd.append('mask', mask, 'video-mask.png')
  return http(`/video/${videoId}/mask`, { method: 'POST', body: fd })
}

export async function startVideoReconstruction({ videoId, params }) {
  const fd = new FormData(); fd.append('video_id', videoId); fd.append('params', JSON.stringify(params))
  return http('/video/reconstruct', { method: 'POST', body: fd })
}

export async function getVideoJobStatus(jobId) {
  return http(`/video/jobs/${jobId}`)
}

export async function getVideoMetrics(jobId) {
  return http(`/video/jobs/${jobId}/metrics`)
}

export async function cancelVideoJob(jobId) {
  return http(`/video/jobs/${jobId}/cancel`, { method: 'POST' })
}
