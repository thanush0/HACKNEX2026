import { useEffect, useId, useRef, useState } from 'react'
export const cx = (...a) => a.filter(Boolean).join(' ')

export function Button({ variant = 'ghost', className, ...p }) {
  const v = {
    ghost: 'border-line/20 text-ink hover:border-accent/60 hover:bg-accent/10',
    solid: 'border-transparent bg-accent text-bg hover:brightness-110',
    danger: 'border-bad/40 text-bad hover:bg-bad/10',
  }[variant]
  return <button type="button" {...p} className={cx('inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[.97] disabled:pointer-events-none disabled:opacity-40', v, className)} />
}

export function Panel({ title, aside, children, className, id }) {
  return (
    <section id={id} className={cx('panel p-3.5', className)}>
      {title && <header className="mb-3 flex items-center justify-between"><h2 className="label">{title}</h2>{aside}</header>}
      {children}
    </section>
  )
}

export function Tooltip({ text, k, side = 'right', children }) {
  const pos = { right: 'left-full ml-2 top-1/2 -translate-y-1/2', top: 'bottom-full mb-2 left-1/2 -translate-x-1/2', bottom: 'top-full mt-2 left-1/2 -translate-x-1/2' }[side]
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className={cx('pointer-events-none absolute z-50 hidden items-center gap-2 whitespace-nowrap rounded-md border border-line/20 bg-bg2 px-2 py-1 text-[11px] opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 lg:flex', pos)}>
        {text}{k && <kbd className="rounded border border-line/30 px-1 font-mono text-[10px] text-accent">{k}</kbd>}
      </span>
    </span>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, format = v => v }) {
  const id = useId(); const p = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between"><label htmlFor={id} className="label">{label}</label><output htmlFor={id} className="value">{format(value)}</output></div>
      <input id={id} type="range" className="range" min={min} max={max} step={step} value={value} style={{ '--p': p + '%' }} aria-valuetext={String(format(value))} onChange={e => onChange(+e.target.value)} />
    </div>
  )
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="group flex w-full items-center justify-between gap-3 rounded-md py-1.5 text-left">
      <span><span className="block text-[13px] text-ink">{label}</span>{hint && <span className="block text-[11px] text-mute">{hint}</span>}</span>
      <span className={cx('relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-200', checked ? 'border-accent/70 bg-accent/25' : 'border-line/25 bg-bg/60')}>
        <span className={cx('absolute top-[2px] h-3 w-3 rounded-full transition-all duration-200', checked ? 'left-[16px] bg-accent shadow-[0_0_8px_rgb(var(--accent)/.8)]' : 'left-[2px] bg-mute')} />
      </span>
    </button>
  )
}

export function Select({ label, value, onChange, options }) {
  const id = useId()
  return (
    <div className="space-y-1"><label htmlFor={id} className="label">{label}</label>
      <select id={id} className="field" value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
  )
}

export function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen); const id = useId()
  return (
    <section className="panel overflow-hidden">
      <h2><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-3.5 text-left">
        <span className="label">{title}</span><span className={cx('text-accent transition-transform duration-200', open && 'rotate-90')} aria-hidden>›</span></button></h2>
      <div id={id} className={cx('grid transition-[grid-template-rows] duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden"><div className="space-y-1 px-3.5 pb-3.5">{children}</div></div>
      </div>
    </section>
  )
}

/** value: 0..1, or null when the backend reports no progress (renders an honest indeterminate bar). */
export function ProgressBar({ value, label, simulated }) {
  const pct = value == null ? null : Math.round(value * 100)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label text-accent">{label}{simulated && <span className="ml-2 text-warn">simulated</span>}</span>
        <span className="value">{pct == null ? '—' : pct + '%'}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} className="relative h-1.5 overflow-hidden rounded-full bg-line/15">
        {pct == null
          ? <div className="indeterminate h-full rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />
          : <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-accent to-violet shadow-[0_0_12px_rgb(var(--accent)/.8)] transition-[width] duration-500" style={{ width: pct + '%' }}><div className="shimmer absolute inset-0" /></div>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); ref.current?.focus()
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="anim-fade fixed inset-0 z-[60] grid place-items-center bg-bg/70 p-4 backdrop-blur-sm" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="panel anim-rise w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg tracking-wide">{title}</h2><Button onClick={onClose} aria-label="Close dialog" className="!px-2 !py-1">✕</Button></div>
        {children}
      </div>
    </div>
  )
}
