import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../services/api'
import { ApiError, toUserError } from '../lib/errors'

const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 25 * 1024 * 1024, MAX_SIDE = 8192
const sleep = ms => new Promise(r => setTimeout(r, ms))
const dims = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej; i.src = url })
const readHistory = () => { try { return JSON.parse(localStorage.getItem('scenera.history') || '[]') } catch { return [] } }
const fail = code => toUserError(new ApiError(code))

export const DEFAULT_GEN = {
  mode: 'MEDIUM', prompt: '', negativePrompt: '', seed: -1, seedLock: false, steps: 30, guidanceScale: 7.5, strength: 0.8,
  resolution: 1024, batch: 1, scheduler: 'DPM++ 2M', preserveOriginal: true, highQuality: false, faceProtection: false,
  edgeRefinement: true, colorMatching: false, lightingMatching: false,
}
export const DEFAULT_BRUSH = { size: 48, opacity: 0.6, feather: 6, blur: 4, expansion: 0 }
const IDLE = { status: 'idle', stage: null, progress: null, message: '', simulated: false }

/** All app state lives here, split logically: image / mask (brush) / tool / generation / result / system / ui. */
export function useScenera(editorRef) {
  const [image, setImage] = useState(null)
  const [tool, setTool] = useState('brush')
  const [brush, setBrushState] = useState(DEFAULT_BRUSH)
  const [gen, setGenState] = useState(DEFAULT_GEN)
  const [run, setRun] = useState(IDLE)
  const [result, setResult] = useState(null)
  const [system, setSystem] = useState(null)
  const [ui, setUiState] = useState({ view: 'workspace', drawer: false, grid: false, maskVisible: true, settings: false })
  const [stats, setStats] = useState({ zoom: 1, vpt: [1, 0, 0, 1, 0, 0], paths: 0, bbox: null, canUndo: false, canRedo: false })
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(readHistory)
  const alive = useRef(true), urlRef = useRef(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const setBrush = useCallback(p => setBrushState(s => ({ ...s, ...p })), [])
  const setG = useCallback(p => setGenState(s => ({ ...s, ...p })), [])
  const setUi = useCallback(p => setUiState(s => ({ ...s, ...p })), [])
  const pickTool = useCallback(t => { setTool(t); if (t === 'brush' || t === 'eraser') setUiState(s => ({ ...s, maskVisible: true })) }, [])

  useEffect(() => {
    let dead = false
    const poll = () => api.getSystemStatus().then(s => !dead && setSystem(s)).catch(() => !dead && setSystem({ online: false }))
    poll(); const t = setInterval(poll, 15000)
    return () => { dead = true; clearInterval(t) }
  }, [])

  const loadFile = useCallback(async file => {
    if (!file) return
    if (!OK_TYPES.includes(file.type)) return setError(fail('UNSUPPORTED_FILE'))
    if (file.size > MAX_BYTES) return setError(fail('IMAGE_TOO_LARGE'))
    const url = URL.createObjectURL(file)
    try {
      const { w, h } = await dims(url)
      if (Math.max(w, h) > MAX_SIDE) { URL.revokeObjectURL(url); return setError(fail('IMAGE_TOO_LARGE')) }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = url
      setImage({ file, url, w, h, name: file.name }); setResult(null); setRun(IDLE); setError(null)
      setUiState(s => ({ ...s, view: 'workspace' }))
      api.uploadImage(file).catch(e => setError(toUserError(e)))
    } catch { URL.revokeObjectURL(url); setError(fail('UNSUPPORTED_FILE')) }
  }, [])

  const closeImage = useCallback(() => { setImage(null); setResult(null); setRun(IDLE); setUiState(s => ({ ...s, view: 'workspace' })) }, [])

  const generate = useCallback(async () => {
    if (!image) return setError(fail('NO_IMAGE'))
    if (run.status !== 'idle') return
    const m = await editorRef.current?.exportMask()
    if (!m || m.empty) return setError(fail('NO_MASK'))
    if (m.coverage < 0.001) return setError(fail('MASK_TOO_SMALL'))
    setError(null); setRun({ ...IDLE, status: 'running', stage: 'analysis', message: 'IMAGE ANALYSIS' })
    if (gen.prompt.trim()) {
      const h = [gen.prompt.trim(), ...history.filter(x => x !== gen.prompt.trim())].slice(0, 8)
      setHistory(h); try { localStorage.setItem('scenera.history', JSON.stringify(h)) } catch { /* storage blocked */ }
    }
    try {
      const params = { ...gen, brush: { blur: brush.blur, feather: brush.feather, expansion: brush.expansion } }
      const { jobId } = await api.generateReconstruction({ image: image.file, mask: m.blob, params, meta: { imageUrl: image.url, coverage: m.coverage, w: image.w, h: image.h } })
      let s
      for (;;) {
        await sleep(500)
        if (!alive.current) return
        s = await api.getGenerationStatus(jobId)
        if (s.status === 'failed') throw new ApiError(s.error?.code || 'GENERATION_FAILED')
        setRun({ status: 'running', stage: s.stage, progress: s.progress ?? null, message: s.message || '', simulated: !!s.simulated })
        if (s.status === 'complete') break
      }
      const metrics = await api.getMetrics(jobId)
      const variants = s.result?.variants || [{ generatedUrl: s.result?.generatedUrl, finalUrl: s.result?.finalUrl }]
      setRun({ status: 'done', stage: 'complete', progress: 1, message: 'COMPLETE', simulated: !!s.simulated })
      await sleep(700)
      if (!alive.current) return
      setResult({ variants, active: 0, metrics, before: image.url, mask: m.dataUrl, simulated: !!s.simulated })
      setUiState(u => ({ ...u, view: 'reconstruct' })); setRun(IDLE)
    } catch (e) { if (alive.current) { setError(toUserError(e)); setRun(IDLE) } }
  }, [image, run.status, gen, brush, history, editorRef])

  return { image, tool, brush, gen, run, result, setResult, system, ui, stats, error, history,
    setStats, setError, setBrush, setG, setUi, pickTool, loadFile, closeImage, generate }
}
