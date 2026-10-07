from pathlib import Path
import cv2

def _fourcc_candidates():
    return [cv2.VideoWriter_fourcc(*"mp4v"), cv2.VideoWriter_fourcc(*"avc1")]

def create_writer(output_path: str, fps: float, width: int, height: int):
    fps = fps if fps > 0 else 24.0
    for fourcc in _fourcc_candidates():
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if writer.isOpened(): return writer
        writer.release()
    raise RuntimeError("No compatible MP4 video codec is available to OpenCV.")

def encode_frames(frames, output_path: str, fps: float = 24.0, width: int | None = None, height: int | None = None) -> str:
    iterator = iter(frames)
    first = next(iterator, None)
    if first is None: raise ValueError("No frames were provided.")
    h, w = first.shape[:2]
    width, height = width or w, height or h
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    writer = create_writer(output_path, fps, width, height)
    try:
        writer.write(first)
        for frame in iterator:
            writer.write(frame)
    finally:
        writer.release()
    return output_path
