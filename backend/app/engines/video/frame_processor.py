from pathlib import Path
from typing import Iterator
import cv2

def open_video(path: str) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Unable to open video.")
    return cap

def metadata(path: str) -> dict:
    cap = open_video(path)
    try:
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        codec_int = int(cap.get(cv2.CAP_PROP_FOURCC) or 0)
        codec = ''.join(chr((codec_int >> (8*i)) & 0xFF) for i in range(4)).strip() or None
        duration = count / fps if fps > 0 and count > 0 else 0.0
        if width < 2 or height < 2: raise ValueError("Video dimensions are invalid.")
        return {"width": width, "height": height, "fps": fps, "frame_count": count, "duration": duration, "codec": codec}
    finally:
        cap.release()

def iter_frames(path: str) -> Iterator[tuple[int, any]]:
    cap = open_video(path)
    i = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok: break
            yield i, frame
            i += 1
    finally:
        cap.release()

def extract_frames(video_path: str, output_dir: str) -> list[str]:
    # Kept for compatibility; sequentially writes frames and never stores them in RAM.
    out = Path(output_dir); out.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, frame in iter_frames(video_path):
        path = out / f"frame_{i:06d}.png"
        if not cv2.imwrite(str(path), frame): raise IOError(f"Failed to write frame {i}.")
        paths.append(str(path))
    return paths
