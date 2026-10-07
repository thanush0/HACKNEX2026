import { useEffect, useRef } from 'react'
import { Minus, Plus, Maximize2, Grid3x3 } from 'lucide-react'
import { CanvasEditor } from './CanvasEditor'
import { Button, Tooltip } from '../ui'

const css = (n, a = 1) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim()} / ${a})`
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]

function Ruler({ vertical, off, z }) {
  const ref = useRef()
  useEffect(() => {
    const cv = ref.current, len = vertical ? cv.clientHeight : cv.clientWidth, dpr = window.devicePixelRatio || 1
    cv.width = (vertical ? 20 : len) * dpr; cv.height = (vertical ? len : 20) * dpr
    const x = cv.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0, 0, 9999, 9999)
    x.strokeStyle = css('border', 0.35); x.fillStyle = css('text-muted'); x.font = '9px "JetBrains Mono", monospace'
    const major = NICE.find(n => n * z >= 60) || 5000, minor = major / 5
    for (let v = Math.floor(-off / z / minor) * minor; v * z + off < len; v += minor) {
      const p = Math.round(v * z + off) + 0.5, big = Math.abs(v % major) < 1e-6, t = big ? 20 : 6
      x.beginPath()
      if (vertical) { x.moveTo(20 - t, p); x.lineTo(20, p) } else { x.moveTo(p, 20 - t); x.lineTo(p, 20) }
      x.stroke()
      if (big) { x.save(); if (vertical) { x.translate(2, p + 3); x.rotate(-Math.PI / 2); x.fillText(Math.round(v), 0, 8) } else x.fillText(Math.round(v), p + 3, 9); x.restore() }
    }
  })
  return <canvas ref={ref} aria-hidden className={vertical ? 'absolute bottom-0 left-0 top-5 h-[calc(100%-20px)] w-5' : 'absolute left-5 right-0 top-0 h-5 w-[calc(100%-20px)]'} />
}

export function ZoomControls({ editorRef, zoom }) {
  return (
    <div className="panel flex items-center gap-1 p-1" role="group" aria-label="Zoom controls">
      <Button aria-label="Zoom out" onClick={() => editorRef.current?.zoomBy(0.8)} className="!border-transparent !p-1.5"><Minus size={14} /></Button>
      <output className="value w-12 text-center" aria-live="polite">{Math.round(zoom * 100)}%</output>
      <Button aria-label="Zoom in" onClick={() => editorRef.current?.zoomBy(1.25)} className="!border-transparent !p-1.5"><Plus size={14} /></Button>
      <Tooltip text="Fit to view" side="top"><Button aria-label="Fit to view" onClick={() => editorRef.current?.fit()} className="!border-transparent !p-1.5"><Maximize2 size={14} /></Button></Tooltip>
    </div>
  )
}

export function ImageWorkspace({ editorRef, image, tool, spacePan, brush, ui, setUi, stats, onStats, children }) {
  const coord = useRef(); const z = stats.zoom, [, , , , ox, oy] = stats.vpt
  const br = 'border-accent'
  return (
    <section aria-label="Image workspace" className="relative m-2 min-h-0 min-w-0 flex-1 lg:m-3">
      <Ruler off={ox} z={z} /><Ruler vertical off={oy} z={z} />
      <div className="checker absolute bottom-0 left-5 right-0 top-5 overflow-hidden rounded-br-xl border border-line/15">
        <CanvasEditor ref={editorRef} imageUrl={image.url} tool={tool} spacePan={spacePan} brush={brush} maskVisible={ui.maskVisible} onStats={onStats} coordRef={coord} />
        {ui.grid && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgb(var(--accent)/.14) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--accent)/.14) 1px,transparent 1px)', backgroundSize: `${64 * z}px ${64 * z}px`, backgroundPosition: `${ox}px ${oy}px` }} />}
        <div key={image.url} aria-hidden className="reveal-sweep" />
      </div>
      {[`left-4 top-4 border-l-2 border-t-2`, `right-0 top-4 border-r-2 border-t-2`, `left-4 bottom-0 border-b-2 border-l-2`, `right-0 bottom-0 border-b-2 border-r-2`].map(p => <span key={p} aria-hidden className={`bracket ${p} ${br}`} />)}
      <div className="absolute bottom-3 left-8 flex items-center gap-3 rounded-md bg-bg/70 px-2.5 py-1 backdrop-blur">
        <span ref={coord} className="value text-dim">X —  Y —</span>
        <span className="label hidden sm:inline">{image.w}×{image.h}</span>
        <span className="label hidden md:inline">{stats.bbox ? `MASK ${stats.bbox[2]}×${stats.bbox[3]} @ ${stats.bbox[0]},${stats.bbox[1]}` : 'NO MASK'}</span>
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <Tooltip text="Toggle grid" k="G" side="top"><Button aria-pressed={ui.grid} aria-label="Toggle grid" onClick={() => setUi({ grid: !ui.grid })} className={`!p-2 ${ui.grid ? '!border-accent/70 !text-accent' : ''}`}><Grid3x3 size={14} /></Button></Tooltip>
        <ZoomControls editorRef={editorRef} zoom={z} />
      </div>
      {children}
    </section>
  )
}
