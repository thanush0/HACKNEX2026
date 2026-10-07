import { useEffect, useRef, useState } from 'react'
import { Upload, Eraser, Play, Square, RotateCcw } from 'lucide-react'
import { Button, Panel, Slider, cx } from '../ui'
import * as api from '../../services/api'
import { toUserError } from '../../lib/errors'

const API = api.API_BASE
const abs = u => !u ? '' : (u.startsWith('http') ? u : (u.startsWith(API) ? u : `${API.replace(/\/$/,'')}${u.startsWith('/') ? u : '/'+u}`))

export function VideoWorkspace({ onError }) {
  const videoRef=useRef(), canvasRef=useRef(), inputRef=useRef(), [file,setFile]=useState(null)
  const [meta,setMeta]=useState(null), [videoId,setVideoId]=useState(null), [maskReady,setMaskReady]=useState(false)
  const [drawing,setDrawing]=useState(false), [brush,setBrush]=useState(36), [temporal,setTemporal]=useState(.12)
  const [params,setParams]=useState({mode:'MEDIUM',prompt:'',negative_prompt:'',steps:20,guidance_scale:7.5,strength:.8,temporal_strength:.12,seed:-1,resolution:768})
  const [job,setJob]=useState(null), [result,setResult]=useState(null), [busy,setBusy]=useState(false)
  const [localUrl,setLocalUrl]=useState(null)

  useEffect(()=>()=>localUrl&&URL.revokeObjectURL(localUrl),[localUrl])
  const drawFrame=()=>{
    const v=videoRef.current,c=canvasRef.current;if(!v||!c||!v.videoWidth)return
    c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').clearRect(0,0,c.width,c.height)
  }
  const pick=async f=>{
    if(!f)return
    if(!/^video\/(mp4|quicktime|webm|x-msvideo)$/.test(f.type) && !/\.(mp4|mov|webm|avi)$/i.test(f.name)){onError({title:'Unsupported video',message:'Use MP4, MOV, WEBM, or AVI.'});return}
    setFile(f);setMeta(null);setVideoId(null);setMaskReady(false);setJob(null);setResult(null)
    const u=URL.createObjectURL(f);setLocalUrl(u)
    const v=videoRef.current; if(v){v.src=u;v.load()}
    try { const m=await api.uploadVideo(f);setMeta(m);setVideoId(m.video_id) } catch(e){onError(toUserError(e))}
  }
  const pos=e=>{const c=canvasRef.current,r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
  const paint=e=>{
    if(!drawing)return; const c=canvasRef.current,p=pos(e),x=c.getContext('2d')
    x.fillStyle='white';x.beginPath();x.arc(p.x,p.y,brush,0,Math.PI*2);x.fill();setMaskReady(true)
  }
  const clear=()=>{const c=canvasRef.current;c.getContext('2d').clearRect(0,0,c.width,c.height);setMaskReady(false)}
  const maskBlob=()=>new Promise(r=>canvasRef.current.toBlob(r,'image/png'))
  const start=async()=>{
    if(!videoId||!maskReady||busy)return
    setBusy(true);setJob({status:'queued',progress:0,stage:'queued'})
    try{
      const mask=await maskBlob(); await api.attachVideoMask(videoId,mask)
      const p={...params,temporal_strength:temporal}
      const j=await api.startVideoReconstruction({videoId,params:p})
      let s=j
      for(;;){await new Promise(r=>setTimeout(r,700));s=await api.getVideoJobStatus(j.job_id);setJob(s);if(['complete','failed','cancelled'].includes(s.status))break}
      if(s.status==='failed') throw Object.assign(new Error(s.error?.message||'Video reconstruction failed'),{code:s.error?.code})
      if(s.status==='cancelled') return
      const metrics=await api.getVideoMetrics(j.job_id)
      setResult({url:abs(s.output_url),metrics});setBusy(false)
    }catch(e){setBusy(false);onError(toUserError(e))}
  }
  const cancel=async()=>{if(job?.job_id)try{await api.cancelVideoJob(job.job_id)}catch{}}
  return <div className="anim-fade flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
    <div className="grid min-h-0 gap-3 lg:grid-cols-[1fr_22rem]">
      <section className="panel min-h-[28rem] overflow-hidden p-3">
        {!file && <div className="grid h-full min-h-[28rem] place-items-center"><div className="text-center"><p className="font-display text-xl tracking-[.25em]">VIDEO RECONSTRUCTION</p><p className="mt-2 text-sm text-dim">Upload a video, then paint the object/removal region on its first frame.</p><Button variant="solid" onClick={()=>inputRef.current?.click()} className="mt-5"><Upload size={14}/>IMPORT VIDEO</Button><input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo" className="sr-only" onChange={e=>pick(e.target.files[0])}/></div></div>}
        {file && <div className="relative h-full min-h-[28rem] overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} controls className="h-full w-full object-contain" onLoadedMetadata={()=>{drawFrame();}} />
          <canvas ref={canvasRef} className="pointer-events-auto absolute inset-0 h-full w-full cursor-crosshair opacity-55" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDrawing(true);paint(e)}} onPointerMove={paint} onPointerUp={()=>setDrawing(false)} />
          <div className="absolute left-3 top-3 flex gap-2"><span className="label rounded bg-bg/80 px-2 py-1">MASK: {maskReady?'READY':'PAINT REGION'}</span><span className="label rounded bg-bg/80 px-2 py-1">{meta?`${meta.width}×${meta.height} · ${meta.fps.toFixed(1)} FPS · ${meta.frame_count} FRAMES`:'ANALYZING'}</span></div>
        </div>}
      </section>
      <aside className="space-y-3">
        <Panel title="Video controls">
          <div className="grid gap-2">
            <div className="grid grid-cols-3 gap-1">{['FAST','MEDIUM','MAX'].map(m=><button key={m} onClick={()=>setParams(p=>({...p,mode:m}))} className={cx('rounded border px-2 py-2 text-xs',params.mode===m?'border-accent/70 bg-accent/10 text-accent':'border-line/20 text-dim')}>{m}</button>)}</div>
            <label className="label">Prompt<input className="mt-1 w-full rounded border border-line/20 bg-bg px-2 py-2 text-sm text-ink" value={params.prompt} onChange={e=>setParams(p=>({...p,prompt:e.target.value}))}/></label>
            <label className="label">Negative prompt<input className="mt-1 w-full rounded border border-line/20 bg-bg px-2 py-2 text-sm text-ink" value={params.negative_prompt} onChange={e=>setParams(p=>({...p,negative_prompt:e.target.value}))}/></label>
            <Slider label="Temporal strength" value={temporal} min={0} max={.3} step={.01} onChange={v=>setTemporal(v)} format={v=>v.toFixed(2)}/>
            <div className="grid grid-cols-2 gap-2"><Button onClick={()=>setBrush(v=>Math.max(4, v-8))}>Brush −</Button><Button onClick={()=>setBrush(v=>Math.min(150, v+8))}>Brush +</Button></div>
            <div className="grid grid-cols-2 gap-2"><Button onClick={clear}><Eraser size={14}/>Clear mask</Button><Button onClick={()=>{setFile(null);setMeta(null);setVideoId(null)}}><RotateCcw size={14}/>New video</Button></div>
            {!busy?<Button variant="solid" disabled={!videoId||!maskReady} onClick={start}><Play size={14}/>START RECONSTRUCTION</Button>:<Button variant="solid" onClick={cancel}><Square size={14}/>CANCEL JOB</Button>}
          </div>
        </Panel>
        {job&&<Panel title="Processing"><div className="space-y-2"><div className="flex justify-between value"><span>{job.stage}</span><span>{job.progress==null?'—':Math.round(job.progress*100)+'%'}</span></div><div className="h-2 overflow-hidden rounded bg-line/15"><div className="h-full bg-accent transition-all" style={{width:`${(job.progress||0)*100}%`}}/></div><p className="label">FRAME {job.current_frame||0} / {job.total_frames||meta?.frame_count||0}</p></div></Panel>}
        {result&&<Panel title="Result"><video controls className="w-full rounded border border-line/15" src={result.url}/><div className="mt-3 grid gap-1 text-xs">{Object.entries(result.metrics||{}).map(([k,v])=><div key={k} className="flex justify-between border-b border-line/10 py-1"><span className="label">{k.replaceAll('_',' ')}</span><span className="value">{typeof v==='number'?v.toFixed(4):String(v)}</span></div>)}</div></Panel>}
      </aside>
    </div>
  </div>
}
