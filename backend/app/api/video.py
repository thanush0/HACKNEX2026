import json
from fastapi import APIRouter, Depends, File, Form, UploadFile
from app.core.dependencies import get_video_service
from app.schemas.video import VideoReconstructionParams
from app.services.video_service import VideoService

router=APIRouter(tags=["video"])

def parse_params(payload: str|None, **fields):
    data={}
    if payload:
        try: data=json.loads(payload)
        except json.JSONDecodeError:
            from fastapi import HTTPException
            raise HTTPException(status_code=422,detail="params must be valid JSON")
    data.update({k:v for k,v in fields.items() if v is not None})
    return VideoReconstructionParams.from_payload(data).model_dump()

@router.post("/video/upload",summary="Upload a video and optionally its static mask")
async def video_upload(video:UploadFile=File(...), mask:UploadFile|None=File(default=None), service:VideoService=Depends(get_video_service)):
    return await service.upload(video,mask)

@router.post("/video/{video_id}/mask",summary="Attach or replace a static video mask")
async def video_mask(video_id:str, mask:UploadFile=File(...), service:VideoService=Depends(get_video_service)):
    return await service.attach_mask(video_id,mask)

@router.post("/video/reconstruct",summary="Queue video reconstruction")
async def video_reconstruct(video_id:str=Form(...), params:str|None=Form(default=None),
    prompt:str|None=Form(default=None), negative_prompt:str|None=Form(default=None), mode:str|None=Form(default=None),
    seed:int|None=Form(default=None), steps:int|None=Form(default=None), guidance_scale:float|None=Form(default=None),
    strength:float|None=Form(default=None), resolution:int|None=Form(default=None), temporal_strength:float|None=Form(default=None),
    service:VideoService=Depends(get_video_service)):
    p=parse_params(params,prompt=prompt,negative_prompt=negative_prompt,mode=mode,seed=seed,steps=steps,
                   guidance_scale=guidance_scale,strength=strength,resolution=resolution,temporal_strength=temporal_strength)
    return await service.start_reconstruction(video_id,p)

@router.get("/video/jobs/{job_id}",summary="Get video reconstruction status")
async def video_status(job_id:str,service:VideoService=Depends(get_video_service)): return service.status(job_id)

@router.get("/video/jobs/{job_id}/metrics",summary="Get video metrics")
async def video_metrics(job_id:str,service:VideoService=Depends(get_video_service)): return service.metrics(job_id)

@router.post("/video/jobs/{job_id}/cancel",summary="Cancel video reconstruction")
async def video_cancel(job_id:str,service:VideoService=Depends(get_video_service)): return service.cancel(job_id)

# Existing route retained as a status alias.
@router.get("/video/{job_id}",include_in_schema=False)
async def video_status_legacy(job_id:str,service:VideoService=Depends(get_video_service)): return service.status(job_id)
