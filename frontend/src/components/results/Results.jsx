import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button, Panel, Slider, cx } from '../ui'
import { ApiError, toUserError } from '../../lib/errors'

const pick = r => r.variants[r.active || 0]
const Img = ({ src, alt, className }) => <img src={src} alt={alt} draggable={false} className={cx('h-full w-full select-none object-contain', className)} />
const Tag = ({ children, pos }) => <span className={cx('label absolute z-10 rounded bg-bg/75 px-2 py-1 backdrop-blur', pos)}>{children}</span>

function Divider({ axis, pos, setPos, children }) {
  const ref = useRef(), x = axis === 'x'
  const set = e => { const r = ref.current.getBoundingClientRect(); setPos(Math.min(100, Math.max(0, ((x ? e.clientX - r.left : e.clientY - r.top) / (x ? r.width : r.height)) * 100))) }
  const key = e => {
    const d = e.shiftKey ? 10 : 2, k = e.key
    if (k === 'ArrowLeft' || k === 'ArrowUp') setPos(Math.max(0, pos - d)); else if (k === 'ArrowRight' || k === 'ArrowDown') setPos(Math.min(100, pos + d))
    else if (k === 'Home') setPos(0); else if (k === 'End') setPos(100); else return
    e.preventDefault()
  }
  return (
    <div ref={ref} className="relative h-full w-full touch-none overflow-hidden" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); set(e) }} onPointerMove={e => e.buttons && set(e)}>
      {children}
      <div role="slider" tabIndex={0} aria-label="Comparison position" aria-orientation={x ? 'horizontal' : 'vertical'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} onKeyDown={key}
        className={cx('group absolute z-20 bg-accent shadow-[0_0_14px_rgb(var(--accent))] focus-visible:outline-none', x ? 'top-0 h-full w-px cursor-ew-resize' : 'left-0 h-px w-full cursor-ns-resize')} style={x ? { left: pos + '%' } : { top: pos + '%' }}>
        <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-accent bg-bg/90 font-mono text-[10px] text-accent shadow-[0_0_18px_rgb(var(--accent)/.7)] transition-transform group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-accent/30">{Math.round(pos)}%</span>
      </div>
    </div>
  )
}

export function ComparisonViewer({ urls }) {
  const [mode, setMode] = useState('slider'), [pos, setPos] = useState(50), [op, setOp] = useState(0.5), [target, setTarget] = useState('final')
  const B = urls[target], name = target.toUpperCase()
  const modes = [['slider', 'Slider'], ['split', 'Split'], ['side', 'Side by side'], ['overlay', 'Overlay']]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Comparison mode" className="flex gap-1">{modes.map(([id, l]) => <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cx('rounded-md border px-2.5 py-1.5 text-xs transition', mode === id ? 'border-accent/70 bg-accent/10 text-accent' : 'border-line/15 text-dim hover:border-accent/40')}>{l}</button>)}</div>
        <div role="tablist" aria-label="Compare before with" className="flex items-center gap-1"><span className="label mr-1">Before vs</span>
          {['mask', 'generated', 'final'].map(t => <button key={t} role="tab" aria-selected={target === t} onClick={() => setTarget(t)} className={cx('rounded-md border px-2.5 py-1.5 text-xs uppercase transition', target === t ? 'border-accent/70 bg-accent/10 text-accent' : 'border-line/15 text-dim hover:border-accent/40')}>{t}</button>)}</div>
      </div>
      <div className="checker relative min-h-0 flex-1 overflow-hidden rounded-xl border border-line/15">
        {(mode === 'slider' || mode === 'split') && (() => { const x = mode === 'slider'; return (
          <Divider axis={x ? 'x' : 'y'} pos={pos} setPos={setPos}>
            <Img src={urls.before} alt="Before" /><div className="absolute inset-0" style={{ clipPath: x ? `inset(0 0 0 ${pos}%)` : `inset(${pos}% 0 0 0)` }}><Img src={B} alt={name} /></div>
            <Tag pos="left-3 top-3">BEFORE</Tag><Tag pos={x ? 'right-3 top-3' : 'left-3 bottom-3'}>{name}</Tag>
          </Divider>) })()}
        {mode === 'side' && <div className="grid h-full grid-cols-2 gap-px bg-line/20"><div className="relative bg-bg"><Img src={urls.before} alt="Before" /><Tag pos="left-3 top-3">BEFORE</Tag></div><div className="relative bg-bg"><Img src={B} alt={name} /><Tag pos="left-3 top-3">{name}</Tag></div></div>}
        {mode === 'overlay' && <div className="relative h-full"><Img src={urls.before} alt="Before" /><div className="absolute inset-0" style={{ opacity: op }}><Img src={B} alt={name} /></div><Tag pos="left-3 top-3">BEFORE → {name}</Tag></div>}
      </div>
      {mode === 'overlay' && <div className="max-w-xs"><Slider label={`${name} opacity`} value={op} min={0} max={1} step={0.05} onChange={setOp} format={v => Math.round(v * 100) + '%'} /></div>}
    </div>
  )
}

const pct = v => (v == null ? null : (v * 100).toFixed(1) + '%')
export function ResultAnalytics({ m }) {
  const rows = [['PRESERVATION', pct(m.preservationScore)], ['MASK COVERAGE', pct(m.maskCoverage)], ['PROCESS TIME', m.processingTime == null ? null : m.processingTime.toFixed(1) + 's'],
    ['MODEL', m.model], ['MODE', m.mode], ['RESOLUTION', m.resolution], ['SEED', m.seed]]
  return (
    <Panel title="Reconstruction analytics"><dl className="space-y-2">
      {rows.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/10 pb-2 last:border-0 last:pb-0"><dt className="label">{k}</dt>
        <dd className={cx('value text-right', v == null && '!text-mute')} title={v == null ? 'Not reported by the backend' : undefined}>{v ?? 'UNAVAILABLE'}</dd></div>)}
    </dl></Panel>
  )
}

const load = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src })
const HEAT = [[10, 14, 32], [34, 211, 238], [129, 140, 248], [217, 70, 239], [255, 255, 255]]
const heat = t => { const s = t * (HEAT.length - 1), i = Math.min(Math.floor(s), HEAT.length - 2), f = s - i; return HEAT[i].map((c, k) => c + (HEAT[i + 1][k] - c) * f) }

/** Real pixel diff computed in-browser (original vs final), downscaled to 640px. Needs CORS-readable image URLs. */
export function DifferenceMap({ urls }) {
  const [view, setView] = useState('difference'), [d, setD] = useState(null), [failed, setFailed] = useState(false)
  useEffect(() => {
    let dead = false; setD(null); setFailed(false)
    ;(async () => {
      const [a, b, m] = await Promise.all([load(urls.before), load(urls.final), load(urls.mask)])
      const k = Math.min(1, 640 / Math.max(a.width, a.height)), w = Math.round(a.width * k), h = Math.round(a.height * k)
      const read = im => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h); return x.getImageData(0, 0, w, h) }
      const A = read(a), B = read(b), M = read(m), out = new ImageData(w, h)
      let inC = 0, inN = 0, outC = 0, outN = 0
      for (let i = 0; i < A.data.length; i += 4) {
        const df = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])) / 255
        const [r, g, bl] = heat(Math.min(1, df * 4)); out.data.set([r, g, bl, 255], i)
        if (M.data[i] > 127) { inN++; if (df > 0.05) inC++ } else { outN++; if (df > 0.05) outC++ }
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(out, 0, 0)
      if (!dead) setD({ url: c.toDataURL(), inside: inN ? inC / inN : 0, outside: outN ? outC / outN : 0 })
    })().catch(() => !dead && setFailed(true))
    return () => { dead = true }
  }, [urls.before, urls.final, urls.mask])
  const src = { original: urls.before, final: urls.final, mask: urls.mask, difference: d?.url }[view]
  return (
    <Panel title="Difference map" className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Verification view" className="mb-2 flex flex-wrap gap-1">{['original', 'final', 'difference', 'mask'].map(v => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('rounded-md border px-2.5 py-1.5 text-xs capitalize transition', view === v ? 'border-accent/70 bg-accent/10 text-accent' : 'border-line/15 text-dim hover:border-accent/40')}>{v}</button>)}</div>
      <div className="checker relative min-h-[12rem] flex-1 overflow-hidden rounded-lg border border-line/15">
        {failed ? <p className="grid h-full place-items-center p-4 text-center text-sm text-dim">Difference unavailable. The result image could not be read (the server must allow CORS for image URLs).</p>
          : src ? <Img key={view} src={src} alt={`${view} view`} className="anim-fade" /> : <div className="shimmer h-full w-full opacity-30" />}
      </div>
      {view === 'difference' && <div aria-hidden className="mt-2 h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${HEAT.map(c => `rgb(${c})`).join(',')})` }} />}
      {d && <p className="mt-2 font-mono text-[11px] text-dim">CHANGED INSIDE MASK {(d.inside * 100).toFixed(1)}% · OUTSIDE MASK {(d.outside * 100).toFixed(2)}% <span className="text-mute">(measured here, 640px sample)</span></p>}
    </Panel>
  )
}

export function DownloadPanel({ urls, onError }) {
  const dl = async (url, name) => {
    try { const r = await fetch(url); if (!r.ok) throw new ApiError('DOWNLOAD_FAILED'); const u = URL.createObjectURL(await r.blob()); const a = Object.assign(document.createElement('a'), { href: u, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000) }
    catch { onError(toUserError(new ApiError('DOWNLOAD_FAILED'))) }
  }
  return (
    <Panel title="Download"><div className="grid gap-2">
      <Button variant="solid" onClick={() => dl(urls.final, 'scenera-final.png')}><Download size={14} />Download final</Button>
      <div className="grid grid-cols-2 gap-2"><Button onClick={() => dl(urls.generated, 'scenera-generated.png')}>Generated</Button><Button onClick={() => dl(urls.mask, 'scenera-mask.png')}>Mask</Button></div>
    </div></Panel>
  )
}

const urlsOf = r => { const v = pick(r); return { before: r.before, mask: r.mask, generated: v.generatedUrl || v.finalUrl, final: v.finalUrl } }

export function ResultsView({ result, onBack, onPick, onError }) {
  const urls = urlsOf(result)
  return (
    <div className="anim-fade flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
      <div className="flex min-h-[22rem] min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between"><Button onClick={onBack}>← Back to workspace</Button>
          {result.variants.length > 1 && <div className="flex gap-1" role="group" aria-label="Variants">{result.variants.map((_, i) => <button key={i} aria-pressed={(result.active || 0) === i} onClick={() => onPick(i)} className={cx('rounded-md border px-2.5 py-1.5 text-xs', (result.active || 0) === i ? 'border-accent/70 text-accent' : 'border-line/15 text-dim')}>V{i + 1}</button>)}</div>}</div>
        {result.simulated && <p className="rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">Mock backend: no model ran, so the result is the original image. Set VITE_USE_MOCK=false to use FastAPI.</p>}
        <ComparisonViewer urls={urls} />
      </div>
      <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80 lg:overflow-y-auto"><ResultAnalytics m={result.metrics} /><DownloadPanel urls={urls} onError={onError} /></div>
    </div>
  )
}

export function AnalyticsView({ result }) {
  const urls = urlsOf(result)
  return (
    <div className="anim-fade grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[22rem_1fr]">
      <ResultAnalytics m={result.metrics} /><DifferenceMap urls={urls} />
    </div>
  )
}
