from __future__ import annotations
import cv2
import numpy as np

def warp_previous(previous_bgr: np.ndarray, previous_original: np.ndarray, current_original: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Warp the previous reconstructed frame into the current frame using dense optical flow."""
    prev_gray = cv2.cvtColor(previous_original, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(current_original, cv2.COLOR_BGR2GRAY)
    flow = cv2.calcOpticalFlowFarneback(prev_gray, curr_gray, None, 0.5, 3, 21, 3, 5, 1.2, 0)
    h, w = curr_gray.shape
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    map_x, map_y = gx + flow[..., 0], gy + flow[..., 1]
    warped = cv2.remap(previous_bgr, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    magnitude = np.linalg.norm(flow, axis=2)
    # Conservative confidence: large/unstable motion gets less temporal influence.
    confidence = np.exp(-magnitude / 24.0).astype(np.float32)
    return warped, confidence

def stabilize_generated(current_generated: np.ndarray, previous_reconstructed: np.ndarray | None,
                        previous_original: np.ndarray | None, current_original: np.ndarray,
                        mask: np.ndarray, strength: float) -> np.ndarray:
    if previous_reconstructed is None or previous_original is None or strength <= 0:
        return current_generated
    warped, confidence = warp_previous(previous_reconstructed, previous_original, current_original)
    a = (np.asarray(mask, dtype=np.float32) / 255.0)
    weight = np.clip(a * float(strength) * confidence, 0.0, 0.5)[..., None]
    out = current_generated.astype(np.float32) * (1-weight) + warped.astype(np.float32) * weight
    return np.clip(out, 0, 255).astype(np.uint8)

def temporal_metrics(original_frames: list[np.ndarray], output_frames: list[np.ndarray], masks: list[np.ndarray]) -> dict:
    """Compute metrics from adjacent frames. Intended for small verification samples."""
    if len(output_frames) < 2:
        return {"temporal_consistency_score": 1.0, "flicker_score": 0.0, "frame_difference_score": 0.0, "masked_stability_score": 1.0}
    diffs, masked_diffs, unmasked_diffs = [], [], []
    for i in range(1, len(output_frames)):
        a = output_frames[i-1].astype(np.float32)
        b = output_frames[i].astype(np.float32)
        d = np.mean(np.abs(a-b))/255.0
        m = masks[i] > 127
        if np.any(m): masked_diffs.append(float(np.mean(np.abs(a[m]-b[m]))/255.0))
        u = ~m
        if np.any(u): unmasked_diffs.append(float(np.mean(np.abs(a[u]-b[u]))/255.0))
        diffs.append(float(d))
    md = float(np.mean(masked_diffs)) if masked_diffs else 0.0
    ud = float(np.mean(unmasked_diffs)) if unmasked_diffs else 0.0
    # Flicker is excess masked temporal variation over the original masked motion.
    orig_masked = []
    for i in range(1, len(original_frames)):
        m = masks[i] > 127
        if np.any(m):
            orig_masked.append(float(np.mean(np.abs(original_frames[i-1][m].astype(np.float32)-original_frames[i][m].astype(np.float32)))/255.0))
    baseline = float(np.mean(orig_masked)) if orig_masked else 0.0
    excess = max(0.0, md - baseline)
    flicker = min(1.0, excess * 4.0)
    stability = max(0.0, 1.0 - min(1.0, md * 2.0))
    consistency = max(0.0, 1.0 - flicker)
    return {"temporal_consistency_score": consistency, "flicker_score": flicker,
            "frame_difference_score": float(np.mean(diffs)), "masked_stability_score": stability,
            "unmasked_frame_difference_score": ud}
