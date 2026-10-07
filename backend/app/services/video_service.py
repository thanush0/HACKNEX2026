from __future__ import annotations
import json
import logging
import secrets
import threading
import time
from pathlib import Path
from uuid import uuid4
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.core.exceptions import FileTooLargeError, InvalidMaskError, JobNotFoundError, ReconstructionError, SceneraError
from app.engines.ai.base import GenerationRequest
from app.engines.cv.compositor import composite_preserving_original
from app.engines.video.encoder import create_writer
from app.engines.video.frame_processor import metadata
from app.engines.video.temporal import stabilize_generated, temporal_metrics

logger = logging.getLogger(__name__)

class VideoService:
    def __init__(self, settings, model_manager, mask_service):
        self.settings = settings
        self.model_manager = model_manager
        self.mask_service = mask_service
        self._videos: dict[str, dict[str, Any]] = {}
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    async def upload(self, upload, mask_upload=None) -> dict:
        if not upload.filename:
            raise ReconstructionError("Video file is required.", code="INVALID_VIDEO", status_code=400)
        path = Path(self.settings.UPLOAD_DIR) / f"video_{uuid4().hex}.mp4"
        size = 0
        with path.open("wb") as out:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > self.settings.max_video_upload_bytes:
                    path.unlink(missing_ok=True)
                    raise FileTooLargeError("Video exceeds the configured maximum size.")
                out.write(chunk)
        try:
            meta = metadata(str(path))
        except Exception as exc:
            path.unlink(missing_ok=True)
            raise ReconstructionError("Uploaded file is not a readable video.", code="INVALID_VIDEO", status_code=400) from exc
        if meta["frame_count"] <= 0 or meta["fps"] <= 0:
            path.unlink(missing_ok=True)
            raise ReconstructionError("Video has no readable frames or a valid FPS.", code="INVALID_VIDEO", status_code=400)
        if meta["frame_count"] > self.settings.MAX_VIDEO_FRAMES or meta["duration"] > self.settings.MAX_VIDEO_DURATION_SECONDS:
            path.unlink(missing_ok=True)
            raise ReconstructionError("Video exceeds the configured duration/frame limit.", code="VIDEO_TOO_LARGE", status_code=413)
        if max(meta["width"], meta["height"]) > self.settings.MAX_DIMENSION:
            path.unlink(missing_ok=True)
            raise ReconstructionError("Video dimensions exceed the configured limit.", code="VIDEO_TOO_LARGE", status_code=413)

        video_id = uuid4().hex
        mask_path = None
        if mask_upload is not None:
            if not mask_upload.filename:
                raise InvalidMaskError("Mask file is empty.")
            raw = await mask_upload.read()
            if len(raw) > self.settings.max_upload_bytes:
                raise FileTooLargeError("Mask exceeds the configured maximum size.")
            try:
                im = Image.open(__import__("io").BytesIO(raw)).convert("L")
            except Exception as exc:
                raise InvalidMaskError("Mask must be a valid image.") from exc
            if im.size != (meta["width"], meta["height"]):
                # Normalize to video resolution using nearest-neighbor for binary masks.
                im = im.resize((meta["width"], meta["height"]), Image.Resampling.NEAREST)
            mask_path = Path(self.settings.MASK_DIR) / f"video_{video_id}.png"
            im.save(mask_path, format="PNG")

        self._videos[video_id] = {"path": str(path), "mask_path": str(mask_path) if mask_path else None,
                                  "filename": upload.filename, **meta}
        return {"video_id": video_id, "filename": upload.filename, **meta, "status": "uploaded", "mask_available": bool(mask_path)}

    def _new_job(self, video_id: str, params: dict) -> dict:
        job = {"job_id": uuid4().hex, "video_id": video_id, "status": "queued", "progress": 0.0,
               "current_frame": 0, "total_frames": self._videos[video_id]["frame_count"],
               "stage": "queued", "started": None, "elapsed_time": 0.0, "estimated_remaining": None,
               "output_url": None, "metrics_url": None, "verification_url": None, "error": None,
               "cancel": False, "params": params}
        with self._lock: self._jobs[job["job_id"]] = job
        return job

    def _update(self, job, **changes):
        with self._lock: job.update(changes)
        if job["started"]:
            job["elapsed_time"] = time.perf_counter() - job["started"]
            p = job["progress"] or 0
            if p > 0 and p < 1:
                job["estimated_remaining"] = job["elapsed_time"] * (1-p) / p

    def _check_cancel(self, job):
        if job["cancel"]:
            raise InterruptedError("Video reconstruction cancelled by user.")

    async def attach_mask(self, video_id: str, mask_upload) -> dict:
        video = self._videos.get(video_id)
        if not video:
            raise JobNotFoundError("Video was not found.")
        raw = await mask_upload.read()
        if len(raw) > self.settings.max_upload_bytes:
            raise FileTooLargeError("Mask exceeds the configured maximum size.")
        try:
            import io
            im = Image.open(io.BytesIO(raw)).convert("L")
        except Exception as exc:
            raise InvalidMaskError("Mask must be a valid image.") from exc
        im = im.resize((video["width"], video["height"]), Image.Resampling.NEAREST)
        mask_path = Path(self.settings.MASK_DIR) / f"video_{video_id}.png"
        im.save(mask_path, format="PNG")
        video["mask_path"] = str(mask_path)
        return {"video_id": video_id, "status": "mask_attached", "mask_url": f"/api/results/{mask_path.name}"}

    async def start_reconstruction(self, video_id: str, params: dict) -> dict:
        if video_id not in self._videos:
            raise JobNotFoundError("Video was not found.")
        if not self.settings.ENABLE_VIDEO:
            raise SceneraError("Video engine is disabled.", code="VIDEO_DISABLED", status_code=503)
        job = self._new_job(video_id, params)
        threading.Thread(target=self._run, args=(job,), daemon=True).start()
        return self.status(job["job_id"])

    def _load_mask(self, video: dict) -> np.ndarray:
        if not video["mask_path"]:
            raise InvalidMaskError("A static mask is required for video reconstruction.")
        mask = cv2.imread(video["mask_path"], cv2.IMREAD_GRAYSCALE)
        if mask is None: raise InvalidMaskError("Unable to read video mask.")
        if mask.shape[:2] != (video["height"], video["width"]):
            mask = cv2.resize(mask, (video["width"], video["height"]), interpolation=cv2.INTER_NEAREST)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        coverage = float(np.count_nonzero(mask)) / mask.size
        if coverage < self.settings.MIN_MASK_COVERAGE: raise InvalidMaskError("Mask contains too little reconstructable area.")
        if coverage > self.settings.MAX_MASK_COVERAGE: raise InvalidMaskError("Mask covers too much of the video.")
        return mask

    def _run(self, job):
        video = self._videos[job["video_id"]]
        start = time.perf_counter(); job["started"] = start
        output_path = Path(self.settings.RESULT_DIR) / f"video_{job['job_id']}.mp4"
        try:
            self._update(job, status="analyzing", stage="analyzing", progress=0.02)
            meta = metadata(video["path"])
            mask = self._load_mask(video)
            params = job["params"]
            seed = int(params.get("seed", -1))
            if seed < 0: seed = secrets.randbelow(2**31)
            job["seed"] = seed
            self._update(job, stage="processing", progress=0.05)
            cap = cv2.VideoCapture(video["path"])
            if not cap.isOpened(): raise ReconstructionError("Unable to reopen video for processing.", code="VIDEO_READ_FAILED")
            writer = create_writer(str(output_path), meta["fps"], meta["width"], meta["height"])
            prev_original = prev_output = None
            frame_index = 0
            masked_diffs=[]; original_masked_diffs=[]; unmasked_changed=[]; frame_diffs=[]
            model_name = params.get("mode","MEDIUM")
            try:
                while True:
                    self._check_cancel(job)
                    ok, frame = cap.read()
                    if not ok: break
                    original_bgr = frame.copy()
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    original_pil = Image.fromarray(rgb)
                    # Work at a diffusion-safe resolution; restore to original resolution before compositing.
                    target_side = int(params.get("resolution") or self.settings.VIDEO_MAX_WORKING_SIDE)
                    target_side = min(target_side, self.settings.VIDEO_MAX_WORKING_SIDE)
                    scale = min(1.0, target_side / max(original_pil.size))
                    if scale < 1:
                        work_size=(max(256,int(original_pil.width*scale)//8*8), max(256,int(original_pil.height*scale)//8*8))
                    else: work_size=original_pil.size
                    work_img=original_pil.resize(work_size, Image.Resampling.LANCZOS)
                    work_mask=Image.fromarray(mask).resize(work_size, Image.Resampling.NEAREST)
                    mode=str(params.get("mode","MEDIUM")).upper()
                    engine=self.model_manager.prepare(mode)
                    req=GenerationRequest(image=work_img, mask=work_mask,
                        prompt=params.get("prompt",""), negative_prompt=params.get("negative_prompt",""),
                        steps=int(params.get("steps",20)), guidance_scale=float(params.get("guidance_scale",7.5)),
                        strength=float(params.get("strength",0.8)), resolution=max(work_size),
                        seed=seed + frame_index, scheduler=params.get("scheduler","DPM++ 2M"))
                    with self.model_manager.inference_lock:
                        generated_pil=engine.generate(req).resize(original_pil.size, Image.Resampling.LANCZOS)
                    generated_bgr=cv2.cvtColor(np.asarray(generated_pil), cv2.COLOR_RGB2BGR)
                    strength=float(params.get("temporal_strength", self.settings.VIDEO_TEMPORAL_STRENGTH))
                    stabilized=stabilize_generated(generated_bgr, prev_output, prev_original, original_bgr, mask, strength)
                    final_bgr = composite_preserving_original(Image.fromarray(rgb), Image.fromarray(cv2.cvtColor(stabilized,cv2.COLOR_BGR2RGB)), Image.fromarray(mask)).copy()
                    final_bgr=cv2.cvtColor(np.asarray(final_bgr),cv2.COLOR_RGB2BGR)
                    writer.write(final_bgr)

                    m=mask>127
                    if prev_output is not None:
                        md=float(np.mean(np.abs(final_bgr[m].astype(np.float32)-prev_output[m].astype(np.float32)))/255.0) if np.any(m) else 0.0
                        om=float(np.mean(np.abs(original_bgr[m].astype(np.float32)-prev_original[m].astype(np.float32)))/255.0) if np.any(m) else 0.0
                        u=~m
                        uc=float(np.mean(np.max(np.abs(final_bgr[u].astype(np.int16)-original_bgr[u].astype(np.int16)),axis=1)>2)) if np.any(u) else 0.0
                        fd=float(np.mean(np.abs(final_bgr.astype(np.float32)-prev_output.astype(np.float32)))/255.0)
                        masked_diffs.append(md); original_masked_diffs.append(om); unmasked_changed.append(uc); frame_diffs.append(fd)
                    prev_original, prev_output = original_bgr, final_bgr
                    frame_index += 1
                    p=0.05 + 0.78*(frame_index/max(1,meta["frame_count"]))
                    self._update(job, status="processing", stage="temporal_consistency" if prev_output is not None else "processing",
                                 progress=p, current_frame=frame_index)
            finally:
                cap.release(); writer.release()
            if frame_index != meta["frame_count"]:
                raise ReconstructionError("Output frame count does not match the source video.", code="VIDEO_FRAME_MISMATCH")
            self._check_cancel(job)
            self._update(job, status="verification", stage="verification", progress=0.86, current_frame=frame_index)
            md=float(np.mean(masked_diffs)) if masked_diffs else 0.0
            baseline=float(np.mean(original_masked_diffs)) if original_masked_diffs else 0.0
            flicker=min(1.0,max(0.0,(md-baseline)*4))
            metrics={"frame_count": frame_index, "fps": meta["fps"], "resolution": f"{meta['width']}×{meta['height']}",
                     "temporal_consistency_score": 1.0-flicker, "flicker_score": flicker,
                     "frame_difference_score": float(np.mean(frame_diffs)) if frame_diffs else 0.0,
                     "unmasked_preservation_score": 1.0-float(np.mean(unmasked_changed)) if unmasked_changed else 1.0,
                     "masked_stability_score": max(0.0,1.0-min(1.0,md*2)),
                     "processing_time": time.perf_counter()-start, "mode": model_name, "seed": seed}
            report={"video_id":job["video_id"],"job_id":job["job_id"],"metrics":metrics,
                    "verification":{"frame_count_preserved":True,"fps_preserved":True,"resolution_preserved":True,
                                    "unmasked_pixel_change_rate":1.0-metrics["unmasked_preservation_score"]}}
            report_path=Path(self.settings.RESULT_DIR)/f"video_verification_{job['job_id']}.json"
            metrics_path=Path(self.settings.RESULT_DIR)/f"video_metrics_{job['job_id']}.json"
            report_path.write_text(json.dumps(report,indent=2),encoding="utf8")
            metrics_path.write_text(json.dumps(metrics,indent=2),encoding="utf8")
            mask_out=Path(self.settings.RESULT_DIR)/f"video_mask_{job['job_id']}.png"
            Image.fromarray(mask).save(mask_out)
            self._update(job, status="complete", stage="complete", progress=1.0,
                         output_url=f"/api/results/{output_path.name}", metrics_url=f"/api/results/{metrics_path.name}",
                         verification_url=f"/api/results/{report_path.name}")
            logger.info("Video job %s completed: %s", job["job_id"], metrics)
        except InterruptedError:
            output_path.unlink(missing_ok=True)
            self._update(job,status="cancelled",stage="cancelled",progress=None)
        except Exception as exc:
            output_path.unlink(missing_ok=True)
            logger.exception("Video job %s failed",job["job_id"])
            self._update(job,status="failed",stage="failed",progress=None,error={"code":getattr(exc,"code","VIDEO_RECONSTRUCTION_FAILED"),"message":getattr(exc,"message",str(exc))})

    def status(self, job_id: str) -> dict:
        with self._lock:
            job=self._jobs.get(job_id)
            if not job: raise JobNotFoundError("Video job was not found.")
            return {k:v for k,v in job.items() if k not in {"params","cancel","started","seed"}}

    def metrics(self, job_id: str) -> dict:
        job=self._jobs.get(job_id)
        if not job: raise JobNotFoundError("Video job was not found.")
        if not job.get("metrics_url"): return {"status":job["status"],"metrics":None}
        p=Path(job["metrics_url"].replace("/api/results/","")) # only filename from our own URL
        path=Path(self.settings.RESULT_DIR)/p.name
        return json.loads(path.read_text(encoding="utf8"))

    def cancel(self, job_id: str):
        with self._lock:
            job=self._jobs.get(job_id)
            if not job: raise JobNotFoundError("Video job was not found.")
            if job["status"] in {"complete","failed","cancelled"}: return self.status(job_id)
            job["cancel"]=True
        return self.status(job_id)
