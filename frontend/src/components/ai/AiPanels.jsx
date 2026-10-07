import { Zap, Hexagon, Gem, Dices, X } from 'lucide-react'
import { MODES, RESOLUTIONS, SCHEDULERS, STAGES, BUTTON_PHASE } from '../../lib/constants'
import { Accordion, Button, Panel, ProgressBar, Select, Slider, Toggle, cx } from '../ui'

const ICON = { zap: Zap, hex: Hexagon, gem: Gem }

export function ModeSelector({ mode, onChange }) {
  return (
    <Panel title="Reconstruction mode">
      <div role="radiogroup" aria-label="Reconstruction mode" className="space-y-2">
        {MODES.map(m => {
          const I = ICON[m.icon], on = mode === m.id
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(m.id)}
              className={cx('relative flex w-full items-center gap-3 rounded-lg border p-3 text-left transition duration-200', on ? 'energy-border scale-[1.015] border-transparent bg-accent/10 shadow-[0_0_24px_rgb(var(--accent)/.15)]' : 'border-line/15 bg-bg/40 hover:border-accent/40 hover:bg-accent/5')}>
              <span className={cx('grid h-9 w-9 place-items-center rounded-md border', on ? 'border-accent/60 text-accent' : 'border-line/20 text-dim')}><I size={17} /></span>
              <span className="min-w-0"><span className="block font-display text-sm tracking-[.12em]">{m.title}</span>
                <span className="block text-[12px] text-dim">{m.model}</span><span className="block text-[11px] text-mute">{m.note}</span></span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

export function PromptPanel({ gen, setG, history }) {
  return (
    <Panel title="Prompt" aside={<Button aria-label="Clear prompts" onClick={() => setG({ prompt: '', negativePrompt: '' })} className="!px-2 !py-1 !text-[11px]"><X size={12} />Clear</Button>}>
      <label htmlFor="prompt" className="sr-only">Prompt</label>
      <textarea id="prompt" rows={4} className="field resize-none" placeholder="Describe the desired reconstruction..." value={gen.prompt} onChange={e => setG({ prompt: e.target.value })} />
      <label htmlFor="neg" className="label mb-1 mt-3 block">Negative prompt</label>
      <textarea id="neg" rows={2} className="field resize-none" placeholder="blur, artifacts, distortion..." value={gen.negativePrompt} onChange={e => setG({ negativePrompt: e.target.value })} />
      {history.length > 0 && <div className="mt-3"><span className="label">History</span>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">{history.slice(0, 5).map(h => <li key={h}><button type="button" title={h} onClick={() => setG({ prompt: h })} className="max-w-[10rem] truncate rounded-full border border-line/20 px-2.5 py-1 text-[11px] text-dim transition hover:border-accent/60 hover:text-ink">{h}</button></li>)}</ul></div>}
    </Panel>
  )
}

export function ParameterPanel({ gen, setG }) {
  return (
    <Panel title="Generation parameters">
      <div className="space-y-3">
        <div className="space-y-1"><label htmlFor="seed" className="label">Seed <span className="text-mute">(-1 = random)</span></label>
          <div className="flex gap-2"><input id="seed" type="number" className="field value" value={gen.seed} onChange={e => setG({ seed: Math.max(-1, Math.floor(+e.target.value || 0)) })} />
            <Button aria-label="Randomize seed" disabled={gen.seedLock} onClick={() => setG({ seed: Math.floor(Math.random() * 2 ** 31) })} className="!px-2.5"><Dices size={15} /></Button></div></div>
        <Slider label="Steps" value={gen.steps} min={10} max={80} onChange={v => setG({ steps: v })} />
        <Slider label="Guidance" value={gen.guidanceScale} min={1} max={20} step={0.5} onChange={v => setG({ guidanceScale: v })} format={v => v.toFixed(1)} />
        <Slider label="Strength" value={gen.strength} min={0.1} max={1} step={0.05} onChange={v => setG({ strength: v })} format={v => v.toFixed(2)} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Resolution" value={gen.resolution} options={RESOLUTIONS} onChange={v => setG({ resolution: +v })} />
          <Select label="Batch" value={gen.batch} options={[1, 2, 3, 4]} onChange={v => setG({ batch: +v })} />
        </div>
      </div>
    </Panel>
  )
}

export function MaskSettings({ brush, setBrush }) {
  return (
    <Panel id="mask-settings" title="Mask settings">
      <div className="space-y-3">
        <Slider label="Brush size" value={brush.size} min={4} max={300} onChange={v => setBrush({ size: v })} format={v => v + ' px'} />
        <Slider label="Mask opacity" value={brush.opacity} min={0.1} max={1} step={0.05} onChange={v => setBrush({ opacity: v })} format={v => Math.round(v * 100) + '%'} />
        <Slider label="Feather" value={brush.feather} min={0} max={40} onChange={v => setBrush({ feather: v })} format={v => v + ' px'} />
        <Slider label="Blur" value={brush.blur} min={0} max={32} onChange={v => setBrush({ blur: v })} format={v => v + ' px'} />
        <Slider label="Edge expansion" value={brush.expansion} min={0} max={64} onChange={v => setBrush({ expansion: v })} format={v => v + ' px'} />
      </div>
    </Panel>
  )
}

export function AdvancedPanel({ gen, setG }) {
  const T = (key, label, hint) => <Toggle label={label} hint={hint} checked={gen[key]} onChange={v => setG({ [key]: v })} />
  return (
    <Accordion title="Advanced">
      <Select label="Scheduler" value={gen.scheduler} options={SCHEDULERS} onChange={v => setG({ scheduler: v })} />
      <div className="pt-2">
        {T('seedLock', 'Seed locking', 'Reuse the same seed every run')}
        {T('preserveOriginal', 'Preserve original pixels', 'Composite outside the mask')}
        {T('highQuality', 'High quality mode')}
        {T('faceProtection', 'Face protection')}
        {T('edgeRefinement', 'Edge refinement')}
        {T('colorMatching', 'Color matching')}
        {T('lightingMatching', 'Lighting matching')}
      </div>
      <p className="pt-1 text-[11px] text-mute">Sent to the backend as parameters. The backend decides which it supports.</p>
    </Accordion>
  )
}

export function GenerateButton({ run, onClick }) {
  const busy = run.status === 'running' || run.status === 'done'
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-busy={busy}
      className={cx('energy-border group relative isolate w-full overflow-hidden rounded-xl bg-gradient-to-b from-accent/20 to-violet/10 px-4 py-3.5 text-center transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_0_34px_rgb(var(--accent)/.35)] enabled:active:scale-[.97]', busy && 'fast')}>
      <span aria-hidden className="absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-all duration-700 group-enabled:group-hover:left-[150%]" />
      <span className="relative block font-display text-lg tracking-[.28em]">{busy ? BUTTON_PHASE[run.stage] || 'PROCESSING' : '✦ RECONSTRUCT'}</span>
      <span className="label relative mt-1 block !text-accent/80">{busy ? 'PROCESSING' : 'GENERATE SCENE'}</span>
    </button>
  )
}

/** Reusable: feed it { stage, progress (0..1|null), message, simulated } from the backend. */
export function ProcessingOverlay({ run }) {
  const idx = Math.max(0, STAGES.findIndex(s => s[0] === run.stage))
  return (
    <div role="status" aria-live="polite" className="anim-fade absolute inset-0 z-20 grid place-items-center overflow-hidden bg-bg/75 backdrop-blur-[3px]">
      <div className="holo-grid" /><div className="scan-beam" />
      <div className="panel anim-rise relative w-[min(92%,26rem)] p-5">
        <ProgressBar value={run.progress} label={run.message || STAGES[idx][1]} simulated={run.simulated} />
        <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {STAGES.map(([id, name], i) => (
            <li key={id} className={cx('flex items-center gap-2 font-mono text-[10.5px] tracking-wider transition-colors duration-300', i < idx ? 'text-ok' : i === idx ? 'text-accent' : 'text-mute')}>
              <span aria-hidden className={cx('h-1.5 w-1.5 rounded-full', i < idx ? 'bg-ok' : i === idx ? 'pulse-dot bg-accent' : 'bg-mute/50')} />{name}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
