import { useState } from 'react'
import { USE_MOCK } from '../../services/api'
import { cx } from '../ui'

export function StatusDot({ state }) { // true | false | null(unknown)
  const c = state === true ? 'bg-ok shadow-[0_0_8px_rgb(var(--success))]' : state === false ? 'bg-bad' : 'bg-mute'
  return <span aria-hidden className={cx('inline-block h-1.5 w-1.5 rounded-full', c, state === true && 'pulse-dot')} />
}
const show = v => (v == null || v === '' ? 'UNKNOWN' : String(v))

/** Floating status panel. Every value comes from `system` (backend). Missing values render UNKNOWN. */
export function SystemHud({ system }) {
  const [open, setOpen] = useState(true), s = system || {}
  const rows = [['GPU', show(s.gpu)], ['VRAM', s.vram == null ? 'UNKNOWN' : `${s.vram} GB`], ['MODEL', show(s.model)], ['ENGINE', show(s.engine)]]
  return (
    <aside aria-label="System status" className="panel absolute right-3 top-3 z-10 w-44 text-xs [perspective:600px]" style={{ transform: 'rotateY(-4deg)', transformOrigin: 'right' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2">
        <span className="flex items-center gap-2"><StatusDot state={s.online ?? null} /><span className="label">SYSTEM {s.online == null ? 'UNKNOWN' : s.online ? 'ONLINE' : 'OFFLINE'}</span></span>
        <span aria-hidden className="text-mute">{open ? '–' : '+'}</span>
      </button>
      {open && <dl className="anim-fade space-y-1.5 border-t border-line/10 px-3 py-2">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="label">{k}</dt><dd className={cx('value truncate', v === 'UNKNOWN' && '!text-mute')} title={v}>{v}</dd></div>)}
        <div className="flex justify-between"><dt className="label">BACKEND</dt><dd className={cx('value', USE_MOCK && '!text-warn')}>{USE_MOCK ? 'MOCK' : 'LIVE'}</dd></div>
      </dl>}
    </aside>
  )
}
