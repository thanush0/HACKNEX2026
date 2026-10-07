// Fabric.js lives ONLY in this file. The rest of the app talks to it through props + an imperative ref:
// fit() zoomBy(f) undo() redo() clear() exportMask() -> { empty, dataUrl, blob, coverage, width, height }
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Canvas, FabricImage, PencilBrush, Point, Shadow } from 'fabric'

const CYAN = '34,211,238'
const clampZ = z => Math.min(16, Math.max(0.05, z))
const isPath = o => o.type === 'path'

function emit(s) {
  cancelAnimationFrame(s.raf)
  s.raf = requestAnimationFrame(() => {
    const c = s.c; if (!c) return
    const paths = c.getObjects().filter(isPath); let bbox = null
    if (paths.length) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      paths.forEach(p => { const r = p.getBoundingRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.left + r.width); y1 = Math.max(y1, r.top + r.height) })
      bbox = [x0, y0, x1 - x0, y1 - y0].map(Math.round)
    }
    s.onStats({ zoom: c.getZoom(), vpt: [...c.viewportTransform], paths: paths.length, bbox, canUndo: s.hist.u.length > 0, canRedo: s.hist.r.length > 0 })
  })
}
function fit(s) {
  const c = s.c, { w, h } = s.dims; if (!c || !w) return
  const cw = c.getWidth(), ch = c.getHeight(), z = Math.min((cw - 48) / w, (ch - 48) / h, 4)
  c.setViewportTransform([z, 0, 0, z, (cw - w * z) / 2, (ch - h * z) / 2]); emit(s)
}
function applyTool(s) {
  const c = s.c; if (!c) return
  const { tool, spacePan, brush } = s
  const draw = tool === 'brush' && !spacePan, sel = tool === 'select' && !spacePan, er = tool === 'eraser' && !spacePan
  c.isDrawingMode = draw; c.selection = false
  if (draw) {
    const b = new PencilBrush(c)
    b.width = brush.size; b.color = `rgba(${CYAN},${brush.opacity})`; b.strokeLineCap = 'round'; b.strokeLineJoin = 'round'
    b.shadow = new Shadow({ blur: brush.feather, color: `rgba(${CYAN},0.9)` })
    c.freeDrawingBrush = b; c.freeDrawingCursor = 'none'
  }
  c.forEachObject(o => { if (isPath(o)) { o.selectable = sel; o.evented = sel || er; o.hoverCursor = er ? 'none' : 'move' } })
  c.defaultCursor = spacePan || tool === 'pan' ? 'grab' : tool === 'zoom' ? 'zoom-in' : er ? 'none' : 'default'
  c.discardActiveObject(); c.requestRenderAll()
}
function step(s, from, to) {
  const c = s.c, op = s.hist[from].pop(); if (!op) return
  const add = (op.t === 'add') === (from === 'r')
  op.o.forEach(o => (add ? c.add(o) : c.remove(o)))
  s.hist[to].push(op); applyTool(s); emit(s)
}
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

async function exportMask(s) {
  const c = s.c, { w, h } = s.dims, paths = c?.getObjects().filter(isPath) || []
  if (!paths.length || !s.img) return { empty: true }
  const saved = paths.map(p => [p.stroke, p.opacity, p.shadow, p.visible])
  paths.forEach(p => p.set({ stroke: '#fff', opacity: 1, shadow: null, visible: true }))
  s.img.visible = false; const bg = c.backgroundColor; c.backgroundColor = '#000'
  const dataUrl = c.toDataURL({ format: 'png', left: 0, top: 0, width: w, height: h, multiplier: 1, enableRetinaScaling: false })
  paths.forEach((p, i) => p.set({ stroke: saved[i][0], opacity: saved[i][1], shadow: saved[i][2], visible: saved[i][3] }))
  s.img.visible = true; c.backgroundColor = bg; c.requestRenderAll()
  const img = await loadImage(dataUrl), k = Math.min(1, 512 / Math.max(w, h))
  const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(w * k)); o.height = Math.max(1, Math.round(h * k))
  const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, o.width, o.height)
  const d = x.getImageData(0, 0, o.width, o.height).data; let on = 0
  for (let i = 0; i < d.length; i += 4) if (d[i] > 127) on++
  const blob = await (await fetch(dataUrl)).blob()
  return { empty: false, dataUrl, blob, coverage: on / (o.width * o.height), width: w, height: h }
}

export const CanvasEditor = forwardRef(function CanvasEditor({ imageUrl, tool, spacePan, brush, maskVisible, onStats, coordRef }, ref) {
  const host = useRef(), el = useRef(), ring = useRef()
  const S = useRef({ c: null, img: null, dims: { w: 0, h: 0 }, hist: { u: [], r: [] }, raf: 0, fitted: false })
  Object.assign(S.current, { tool, spacePan, brush, onStats })

  useImperativeHandle(ref, () => ({
    fit: () => fit(S.current),
    zoomBy: f => { const c = S.current.c; c.zoomToPoint(new Point(c.getWidth() / 2, c.getHeight() / 2), clampZ(c.getZoom() * f)); emit(S.current) },
    undo: () => step(S.current, 'u', 'r'),
    redo: () => step(S.current, 'r', 'u'),
    clear: () => { const s = S.current, ps = s.c.getObjects().filter(isPath); if (!ps.length) return; s.c.remove(...ps); s.hist.u.push({ t: 'remove', o: ps }); s.hist.r = []; s.c.requestRenderAll(); emit(s) },
    exportMask: () => exportMask(S.current),
  }), [])

  // Canvas lifecycle + input events (created once, disposed on unmount)
  useEffect(() => {
    const s = S.current
    const c = new Canvas(el.current, { selection: false, preserveObjectStacking: true, stopContextMenu: true, fireRightClick: false })
    s.c = c; let pan = null, erasing = false
    const eraseAt = o => { const t = o.target; if (t && isPath(t)) { c.remove(t); s.hist.u.push({ t: 'remove', o: [t] }); s.hist.r = []; emit(s) } }
    const ro = new ResizeObserver(() => {
      const r = host.current.getBoundingClientRect(); if (!r.width || !r.height) return
      c.setDimensions({ width: Math.floor(r.width), height: Math.floor(r.height) })
      if (s.dims.w && !s.fitted) { fit(s); s.fitted = true } else emit(s)
    })
    ro.observe(host.current)
    c.on('path:created', e => { e.path.set({ selectable: false, evented: false, objectCaching: false }); s.hist.u.push({ t: 'add', o: [e.path] }); s.hist.r = []; emit(s) })
    c.on('mouse:wheel', o => { o.e.preventDefault(); o.e.stopPropagation(); c.zoomToPoint(new Point(o.e.offsetX, o.e.offsetY), clampZ(c.getZoom() * 0.999 ** o.e.deltaY)); emit(s) })
    c.on('mouse:down', o => {
      const e = o.e
      if (s.spacePan || s.tool === 'pan') { pan = { x: e.clientX, y: e.clientY }; c.setCursor('grabbing') }
      else if (s.tool === 'zoom') { c.zoomToPoint(new Point(e.offsetX, e.offsetY), clampZ(c.getZoom() * (e.altKey ? 0.8 : 1.25))); emit(s) }
      else if (s.tool === 'eraser') { erasing = true; eraseAt(o) }
    })
    c.on('mouse:move', o => {
      if (coordRef?.current && o.scenePoint) coordRef.current.textContent = `X ${Math.round(o.scenePoint.x)}  Y ${Math.round(o.scenePoint.y)}`
      if (pan) { c.relativePan(new Point(o.e.clientX - pan.x, o.e.clientY - pan.y)); pan = { x: o.e.clientX, y: o.e.clientY }; emit(s) }
      else if (erasing) eraseAt(o)
    })
    c.on('mouse:up', () => { pan = null; erasing = false; applyTool(s) })
    // Brush-size ring follows the pointer (DOM only, no React re-render)
    const h = host.current
    const move = e => {
      const r = h.getBoundingClientRect(), live = (s.tool === 'brush' || s.tool === 'eraser') && !s.spacePan
      const d = s.tool === 'eraser' ? 18 : Math.max(6, s.brush.size * c.getZoom())
      Object.assign(ring.current.style, { opacity: live ? 1 : 0, width: d + 'px', height: d + 'px', transform: `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)` })
    }
    const leave = () => { ring.current.style.opacity = 0 }
    h.addEventListener('pointermove', move); h.addEventListener('pointerleave', leave)
    return () => { cancelAnimationFrame(s.raf); ro.disconnect(); h.removeEventListener('pointermove', move); h.removeEventListener('pointerleave', leave); c.dispose(); s.c = null }
  }, [coordRef])

  // Load / replace the base image
  useEffect(() => {
    const s = S.current, c = s.c; if (!c) return
    let dead = false
    c.remove(...c.getObjects()); s.hist = { u: [], r: [] }; s.img = null; s.dims = { w: 0, h: 0 }; s.fitted = false
    if (!imageUrl) { emit(s); return }
    FabricImage.fromURL(imageUrl).then(img => {
      if (dead || !s.c) return
      img.set({ left: 0, top: 0, selectable: false, evented: false, hoverCursor: 'inherit' })
      c.add(img); c.sendObjectToBack(img); s.img = img; s.dims = { w: img.width, h: img.height }; s.fitted = true
      fit(s); applyTool(s)
    })
    return () => { dead = true }
  }, [imageUrl])

  useEffect(() => { applyTool(S.current) }, [tool, spacePan, brush.size, brush.opacity, brush.feather])
  useEffect(() => { // global mask look: opacity + feather apply to existing strokes too
    const c = S.current.c; if (!c) return
    c.getObjects().filter(isPath).forEach(p => p.set({ stroke: `rgba(${CYAN},${brush.opacity})`, shadow: new Shadow({ blur: brush.feather, color: `rgba(${CYAN},0.9)` }) }))
    c.requestRenderAll()
  }, [brush.opacity, brush.feather])
  useEffect(() => { const c = S.current.c; if (!c) return; c.getObjects().filter(isPath).forEach(p => p.set({ visible: maskVisible })); c.requestRenderAll() }, [maskVisible])

  return (
    <div ref={host} className="absolute inset-0 touch-none">
      <canvas ref={el} />
      <div ref={ring} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full border border-accent/90 opacity-0 shadow-[0_0_10px_rgb(var(--accent)/.5),inset_0_0_8px_rgb(var(--accent)/.25)]" />
    </div>
  )
})
