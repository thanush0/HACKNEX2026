from pathlib import Path
import cv2, numpy as np
from app.engines.video.frame_processor import metadata, iter_frames
from app.engines.video.temporal import stabilize_generated, temporal_metrics

def make_video(path: Path):
    w,h,fps,n=64,48,10,4
    writer=cv2.VideoWriter(str(path),cv2.VideoWriter_fourcc(*"mp4v"),fps,(w,h))
    for i in range(n):
        frame=np.zeros((h,w,3),np.uint8); cv2.rectangle(frame,(5+i*2,10),(20+i*2,25),(255,255,255),-1); writer.write(frame)
    writer.release()

def test_video_metadata_and_sequential_frames(tmp_path):
    p=tmp_path/"sample.mp4"; make_video(p)
    m=metadata(str(p))
    assert m["width"]==64 and m["height"]==48 and m["frame_count"]==4 and m["fps"]>0
    assert [i for i,_ in iter_frames(str(p))]==[0,1,2,3]

def test_temporal_stabilization_only_changes_masked_region():
    a=np.zeros((8,8,3),np.uint8); b=a.copy(); b[2:6,2:6]=200
    mask=np.zeros((8,8),np.uint8); mask[2:6,2:6]=255
    out=stabilize_generated(b,None,None,a,mask,.2)
    assert np.array_equal(out[mask==0],b[mask==0])

def test_temporal_metrics_are_data_derived():
    a=np.zeros((8,8,3),np.uint8); b=a.copy(); b[2:6,2:6]=20
    m=np.zeros((8,8),np.uint8); m[2:6,2:6]=255
    result=temporal_metrics([a,b],[a,b],[m,m])
    assert 0 <= result["temporal_consistency_score"] <= 1
    assert result["frame_difference_score"] > 0

class FakeEngine:
    def generate(self, request):
        out=request.image.copy()
        # deterministic reconstruction color inside the mask
        arr=np.asarray(out).copy(); mm=np.asarray(request.mask)>127; arr[mm]=[30,120,220]
        return __import__("PIL").Image.fromarray(arr)

class FakeManager:
    class _Lock:
        def __enter__(self): return self
        def __exit__(self,*a): pass
    inference_lock=_Lock()
    def prepare(self,mode): return FakeEngine()

class FakeMaskService: pass

def test_video_pipeline_end_to_end_without_ai_model(tmp_path):
    from app.services.video_service import VideoService
    class S:
        UPLOAD_DIR=str(tmp_path/"uploads"); MASK_DIR=str(tmp_path/"masks"); RESULT_DIR=str(tmp_path/"results")
        FRAME_DIR=str(tmp_path/"frames"); MAX_VIDEO_FRAMES=100; MAX_VIDEO_DURATION_SECONDS=30
        MAX_DIMENSION=8192; MIN_MASK_COVERAGE=.001; MAX_MASK_COVERAGE=.99
        MAX_VIDEO_UPLOAD_SIZE_MB=10; MAX_UPLOAD_SIZE_MB=2; ENABLE_VIDEO=True; VIDEO_TEMPORAL_STRENGTH=.1; VIDEO_MAX_WORKING_SIDE=64
    for d in [S.UPLOAD_DIR,S.MASK_DIR,S.RESULT_DIR,S.FRAME_DIR]: Path(d).mkdir(parents=True,exist_ok=True)
    src=Path(S.UPLOAD_DIR)/"source.mp4"; make_video(src)
    mask=Path(S.MASK_DIR)/"mask.png"; Image=__import__("PIL").Image
    Image.fromarray(np.pad(np.ones((20,20),np.uint8)*255,((10,18),(22,22)))).save(mask)
    svc=VideoService(S(),FakeManager(),FakeMaskService())
    svc._videos["v"]={"path":str(src),"mask_path":str(mask),"filename":"source.mp4",**metadata(str(src))}
    job=svc._new_job("v",{"mode":"FAST","prompt":"","negative_prompt":"","steps":1,"guidance_scale":1,"strength":.8,"resolution":64,"temporal_strength":.1,"seed":1})
    svc._run(job)
    assert job["status"]=="complete"
    out=Path(S.RESULT_DIR)/Path(job["output_url"]).name
    assert out.exists()
    assert metadata(str(out))["frame_count"]==4
