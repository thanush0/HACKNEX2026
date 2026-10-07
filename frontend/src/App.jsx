import { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useScenera } from './hooks/useScenera'
import { Ambient, EmptyState, ErrorToast, RightPanel, SettingsModal, Sidebar, TopNav } from './components/layout/Shell'
import { ImageWorkspace } from './components/workspace/Workspace'
import { ProcessingOverlay } from './components/ai/AiPanels'
import { SystemHud } from './components/system/Hud'
import { AnalyticsView, ResultsView } from './components/results/Results'
import { Button } from './components/ui'
import { VideoWorkspace } from './components/video/VideoWorkspace'

export default function App() {
  const editor = useRef()
  const S = useScenera(editor)
  const { image, tool, brush, run, result, system, ui, stats, error, setUi, pickTool } = S
  const [space, setSpace] = useState(false), [drag, setDrag] = useState(false)
  const session = useMemo(() => Math.random().toString(36).slice(2, 7).toUpperCase(), [])

  useEffect(() => {
    const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
    const down = e => {
      if (typing(e) || ui.view !== 'workspace' || !image) return
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') { if (e.target.tagName !== 'BUTTON') { e.preventDefault(); setSpace(true) } return }
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? editor.current?.redo() : editor.current?.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); editor.current?.redo(); return }
      if (mod || e.altKey) return
      const map = { v: 'select', b: 'brush', e: 'eraser', h: 'pan', z: 'zoom' }
      if (map[k]) pickTool(map[k]); else if (k === 'm') setUi({ maskVisible: !ui.maskVisible }); else if (k === 'g') setUi({ grid: !ui.grid })
    }
    const up = e => e.code === 'Space' && setSpace(false)
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [ui.view, ui.maskVisible, ui.grid, image, pickTool, setUi])

  const onAction = id => {
    if (id === 'undo') editor.current?.undo(); else if (id === 'redo') editor.current?.redo(); else if (id === 'reset') editor.current?.clear()
    else if (id === 'mask') setUi({ maskVisible: !ui.maskVisible })
    else if (id === 'feather') { setUi({ drawer: true }); requestAnimationFrame(() => document.getElementById('mask-settings')?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }
  }
  const onDrop = e => { e.preventDefault(); setDrag(false); S.loadFile(e.dataTransfer.files[0]) }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden" onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={e => e.currentTarget === e.target && setDrag(false)} onDrop={onDrop}>
      <Ambient />
      <TopNav view={ui.view} hasResult={!!result} onView={view => setUi({ view })} system={system} onSettings={() => setUi({ settings: true })} session={session} />
      <main className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        {ui.view === 'workspace' && !image && <EmptyState onFile={S.loadFile} />}
        {ui.view === 'workspace' && image && (<>
          <Sidebar tool={tool} ui={ui} stats={stats} onTool={pickTool} onAction={onAction} />
          <ImageWorkspace editorRef={editor} image={image} tool={tool} spacePan={space} brush={brush} ui={ui} setUi={setUi} stats={stats} onStats={S.setStats}>
            <SystemHud system={system} />
            {run.status !== 'idle' && <ProcessingOverlay run={run} />}
          </ImageWorkspace>
          <RightPanel S={S} open={ui.drawer} onClose={() => setUi({ drawer: false })} />
          <Button variant="solid" aria-label="Open controls" onClick={() => setUi({ drawer: true })} className="fixed bottom-24 right-3 z-30 shadow-lg lg:hidden"><SlidersHorizontal size={14} />Controls</Button>
        </>)}
        {ui.view === 'reconstruct' && result && <ResultsView result={result} onBack={() => setUi({ view: 'workspace' })} onPick={i => S.setResult(r => ({ ...r, active: i }))} onError={S.setError} />}
        {ui.view === 'analytics' && result && <AnalyticsView result={result} />}
        {ui.view === 'video' && <VideoWorkspace onError={setError} />}
      </main>
      {drag && <div aria-hidden className="anim-fade pointer-events-none fixed inset-0 z-50 grid place-items-center border-2 border-dashed border-accent bg-bg/70 backdrop-blur-sm"><p className="font-display text-xl tracking-[.3em] text-accent">DROP TO IMPORT</p></div>}
      <ErrorToast error={error} onClose={() => S.setError(null)} />
      <SettingsModal open={ui.settings} onClose={() => setUi({ settings: false })} />
    </div>
  )
}
