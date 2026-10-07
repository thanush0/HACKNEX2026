import { useEffect, useRef, useState } from 'react'
import { MousePointer2, Brush, Eraser, Hand, ZoomIn, Layers, Droplets, Undo2, Redo2, RotateCcw, Settings, AlertTriangle, X, Upload } from 'lucide-react'
import { Button, Modal, Panel, Tooltip, cx } from '../ui'
import { StatusDot } from '../system/Hud'
import { API_BASE, USE_MOCK } from '../../services/api'
import { AdvancedPanel, GenerateButton, MaskSettings, ModeSelector, ParameterPanel, PromptPanel } from '../ai/AiPanels'

export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="ambient" /><div className="floor" />
      {Array.from({ length: 14 }, (_, i) => <span key={i} className="particle" style={{ left: `${(i * 73) % 100}%`, animationDuration: `${16 + (i % 5) * 4}s`, animationDelay: `${-i * 2.3}s` }} />)}
      <div className="scanlines" /><div className="noise" />
    </div>
  )
}

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs><linearGradient id="lg" x1="4" y1="4" x2="28" y2="28"><stop stopColor="rgb(var(--accent))" /><stop offset="1" stopColor="rgb(var(--accent-2))" /></linearGradient></defs>
      <path d="M26 6H11a5 5 0 0 0-1.5 9.8" stroke="url(#lg)" strokeWidth="2.6" strokeLinecap="square" />
      <path d="M22.5 16.2A5 5 0 0 1 21 26H6" stroke="url(#lg)" strokeWidth="2.6" strokeLinecap="square" />
      <rect x="13.5" y="14" width="3" height="3" fill="rgb(var(--accent))" /><rect x="17.5" y="14" width="3" height="3" fill="rgb(var(--magenta))" opacity=".85" />
    </svg>
  )
}

const NAV = [['workspace', 'Workspace'], ['reconstruct', 'Reconstruct'], ['video', 'Video'], ['analytics', 'Analytics']]
export function TopNav({ view, hasResult, onView, system, onSettings, session }) {
  const s = system || {}
  return (
    <header className="relative z-30 flex items-center justify-between gap-3 border-b border-line/10 bg-bg/60 px-3 py-2 backdrop-blur-md lg:px-5">
      <div className="flex items-center gap-3"><Logo />
        <div className="leading-tight"><div className="font-display text-lg font-semibold tracking-[.3em]">SCENERA</div><div className="label hidden !text-[9px] sm:block">Gen AI scene reconstruction</div></div></div>
      <nav aria-label="Primary" className="flex items-center gap-1">
        {NAV.map(([id, l]) => {
          const off = (id === 'reconstruct' || id === 'analytics') && !hasResult
          return <Tooltip key={id} side="bottom" text={off ? 'Run a reconstruction first' : l}>
            <button type="button" aria-current={view === id ? 'page' : undefined} aria-disabled={off} onClick={() => !off && onView(id)}
              className={cx('relative rounded-md px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[.12em] transition max-sm:px-1.5', view === id ? 'text-accent after:absolute after:inset-x-2 after:-bottom-[9px] after:h-px after:bg-accent after:shadow-[0_0_8px_rgb(var(--accent))]' : off ? 'cursor-not-allowed text-mute/60' : 'text-dim hover:text-ink')}>{l}</button></Tooltip>
        })}
      </nav>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-4 xl:flex">
          <span className="label flex items-center gap-2"><StatusDot state={s.online ?? null} />GPU {s.gpu ?? (s.online == null ? 'UNKNOWN' : s.online ? 'READY' : 'OFFLINE')}</span>
          <span className="label flex items-center gap-2"><StatusDot state={s.online ?? null} />SYSTEM {s.online == null ? 'UNKNOWN' : s.online ? 'READY' : 'OFFLINE'}</span>
          <span className="label">SES {session}</span>
        </div>
        {USE_MOCK && <span className="label rounded border border-warn/40 px-1.5 py-1 !text-warn">MOCK</span>}
        <Button aria-label="Settings" onClick={onSettings} className="!p-2"><Settings size={15} /></Button>
      </div>
    </header>
  )
}

const TOOLS = [
  ['select', 'Select', 'V', MousePointer2], ['brush', 'Brush', 'B', Brush], ['eraser', 'Eraser (removes strokes)', 'E', Eraser], ['pan', 'Pan', 'Space', Hand], ['zoom', 'Zoom (Alt-click out)', 'Z', ZoomIn],
  ['mask', 'Show / hide mask', 'M', Layers], ['feather', 'Feather settings', null, Droplets], ['undo', 'Undo', 'Ctrl+Z', Undo2], ['redo', 'Redo', 'Ctrl+Shift+Z', Redo2], ['reset', 'Clear mask', null, RotateCcw],
]
export function Sidebar({ tool, ui, stats, onTool, onAction }) {
  return (
    <nav aria-label="Tools" className="panel relative z-10 mx-2 mb-2 flex shrink-0 items-center gap-1 overflow-x-auto p-1.5 max-lg:order-last lg:m-3 lg:mr-0 lg:flex-col lg:overflow-visible">
      {TOOLS.map(([id, label, key, I], n) => {
        const isTool = ['select', 'brush', 'eraser', 'pan', 'zoom'].includes(id)
        const on = isTool ? tool === id : id === 'mask' ? ui.maskVisible : false
        const off = (id === 'undo' && !stats.canUndo) || (id === 'redo' && !stats.canRedo) || (id === 'reset' && !stats.paths)
        return (
          <span key={id} className="contents">
            {(n === 5 || n === 7) && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line/15 lg:mx-0 lg:my-1 lg:h-px lg:w-6" />}
            <Tooltip text={label} k={key}>
              <button type="button" aria-label={label} aria-pressed={isTool || id === 'mask' ? on : undefined} disabled={off} onClick={() => (isTool ? onTool(id) : onAction(id))}
                className={cx('relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition duration-150 hover:-translate-y-px active:scale-95 disabled:opacity-30 disabled:hover:translate-y-0', on ? 'border-accent/70 bg-accent/10 text-accent shadow-[0_0_14px_rgb(var(--accent)/.3)]' : 'border-transparent text-dim hover:border-line/25 hover:text-ink')}>
                <I size={17} />{on && isTool && <span aria-hidden className="absolute -left-[7px] top-2 hidden h-6 w-0.5 rounded bg-accent shadow-[0_0_8px_rgb(var(--accent))] lg:block" />}
                {key && key.length === 1 && <span aria-hidden className="absolute bottom-0.5 right-1 font-mono text-[8px] text-mute">{key}</span>}
              </button>
            </Tooltip>
          </span>
        )
      })}
    </nav>
  )
}

export function UploadZone({ onFile, compact }) {
  const input = useRef(), [over, setOver] = useState(false)
  return (
    <div onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); onFile(e.dataTransfer.files[0]) }}
      className={cx('relative overflow-hidden rounded-2xl border border-dashed text-center transition duration-300', compact ? 'p-5' : 'p-8 sm:p-10', over ? 'scale-[1.02] border-accent bg-accent/10 shadow-[0_0_40px_rgb(var(--accent)/.25)]' : 'border-line/30 bg-bg/40')}>
      {over && <div aria-hidden className="holo-grid anim-fade" />}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
      <p className="relative font-display text-base tracking-[.25em]">DROP IMAGE HERE</p>
      <p className="label relative mt-2">or select a file</p>
      <Button variant="solid" onClick={() => input.current.click()} className="relative mt-5 !px-6 !py-2.5 tracking-widest"><Upload size={14} />IMPORT IMAGE</Button>
      <p className="label relative mt-4 !text-[9.5px]">PNG · JPG · JPEG · WEBP</p>
    </div>
  )
}

export function EmptyState({ onFile }) {
  return (
    <div className="anim-fade relative z-10 grid flex-1 place-items-center overflow-y-auto p-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-4 w-fit [perspective:500px]"><div style={{ transform: 'rotateX(14deg) rotateY(-16deg)' }}><Logo size={64} /></div></div>
        <h1 className="font-display text-4xl font-semibold tracking-[.38em] sm:text-5xl">SCENERA</h1>
        <p className="label mt-3 !text-accent">Generative scene reconstruction</p>
        <p className="mx-auto mt-5 max-w-sm text-balance text-[15px] leading-relaxed text-dim">Restore what is missing.<br />Preserve what matters.</p>
        <div className="mt-8"><UploadZone onFile={onFile} /></div>
      </div>
    </div>
  )
}

export function SettingsModal({ open, onClose }) {
  const rows = [['Backend', USE_MOCK ? 'MOCK (no inference)' : 'LIVE'], ['API base', API_BASE]]
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <dl className="space-y-2">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line/10 pb-2"><dt className="label">{k}</dt><dd className="value">{v}</dd></div>)}</dl>
      <p className="mt-4 text-[13px] leading-relaxed text-dim">Set <code className="font-mono text-accent">VITE_USE_MOCK=false</code> and <code className="font-mono text-accent">VITE_API_URL</code> in <code className="font-mono">.env</code>, then restart the dev server to connect FastAPI. Animations follow your system reduced-motion setting.</p>
    </Modal>
  )
}

export function ErrorToast({ error, onClose }) {
  useEffect(() => { if (!error) return; const t = setTimeout(onClose, 9000); return () => clearTimeout(t) }, [error, onClose])
  if (!error) return null
  return (
    <div role="alert" key={error.code + error.message} className="anim-shake fixed left-1/2 top-16 z-[70] flex w-[min(92vw,26rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-bad/40 bg-bg2/95 p-3.5 shadow-[0_0_30px_rgb(var(--danger)/.18)] backdrop-blur">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-bad" />
      <div className="min-w-0 flex-1"><p className="font-display text-sm tracking-wide">{error.title}</p><p className="mt-0.5 text-[13px] text-dim">{error.message}</p></div>
      <button type="button" aria-label="Dismiss error" onClick={onClose} className="text-mute hover:text-ink"><X size={16} /></button>
    </div>
  )
}

export function RightPanel({ S, open, onClose }) {
  const { gen, setG, brush, setBrush, history, run, generate, closeImage, image } = S
  return (
    <aside aria-label="Reconstruction controls" className={cx('z-40 flex min-h-0 flex-col transition-transform duration-300 lg:m-3 lg:ml-0 lg:w-[22rem] lg:shrink-0 lg:translate-x-0', 'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:w-[min(92vw,24rem)] max-lg:bg-bg/95 max-lg:p-3 max-lg:backdrop-blur-xl', open ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full')}>
      <div className="mb-2 flex items-center justify-between lg:hidden"><span className="label">Controls</span><Button aria-label="Close controls" onClick={onClose} className="!p-1.5"><X size={14} /></Button></div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3 pr-1">
        <Panel title="Image" aside={<Button onClick={closeImage} className="!px-2 !py-1 !text-[11px]">Replace</Button>}><p className="truncate text-[13px]" title={image.name}>{image.name}</p><p className="value mt-1 text-dim">{image.w}×{image.h}</p></Panel>
        <ModeSelector mode={gen.mode} onChange={mode => setG({ mode })} />
        <PromptPanel gen={gen} setG={setG} history={history} />
        <ParameterPanel gen={gen} setG={setG} />
        <MaskSettings brush={brush} setBrush={setBrush} />
        <AdvancedPanel gen={gen} setG={setG} />
      </div>
      <div className="pt-2"><GenerateButton run={run} onClick={() => { onClose(); generate() }} /></div>
    </aside>
  )
}
