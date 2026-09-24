"""Minimal IoU-based association so faces keep a stable ID across frames.

This is intentionally NOT a real tracker (no motion model, no re-ID). It
exists so Phase 1's HUD can show "Face #3" consistently while a person
stands in frame, and so the architecture already has a `tracking` seam for
Phase 2 to drop in something like ByteTrack/DeepSORT without touching the
detector or pipeline call sites.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.detection.face_detector import DetectedFace


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return inter / float(area_a + area_b - inter)


@dataclass
class TrackedFace:
    track_id: int
    face: DetectedFace
    frames_since_seen: int = 0
    name: str = "Unknown"
    name_confidence: float = 0.0
    # Activity mode only (app/detection/activity_detector.py) -- attached
    # post-hoc same as name/name_confidence above, not tracking-continuity
    # state, so they live here rather than on the generic DetectedFace shape
    # every other detector also uses.
    posture: str = "unknown"        # "sitting" | "standing" | "unknown"
    phone_in_use: bool = False
    computer_in_use: bool = False

    # OCR mode only (app/detection/ocr_detector.py) -- the text.face.bbox is
    # the axis-aligned box; text_quad (when set) is the original possibly-
    # rotated 4-point polygon DBNet found, for a tighter overlay outline.
    # text/text_confidence are the *voted* (temporally-consistent) reading,
    # not just the latest single-frame OCR pass -- see TextTracker.
    text: str = ""
    text_confidence: float = 0.0
    text_votes: int = 0
    text_quad: list | None = None   # [[x,y], [x,y], [x,y], [x,y]] or None
    text_moving: bool = False       # True if this text region is on a tracked moving carrier


class SimpleIouTracker:
    def __init__(self, iou_threshold: float = 0.3, max_missed_frames: int = 10) -> None:
        self._iou_threshold = iou_threshold
        self._max_missed = max_missed_frames
        self._next_id = 1
        self._tracks: list[TrackedFace] = []

    def update(self, faces: list[DetectedFace]) -> list[TrackedFace]:
        """Associate new detections with existing tracks by best IoU match."""
        unmatched_tracks = list(self._tracks)
        matched: list[TrackedFace] = []

        for face in faces:
            best_track, best_iou = None, 0.0
            for track in unmatched_tracks:
                score = _iou(face.bbox, track.face.bbox)
                if score > best_iou:
                    best_track, best_iou = track, score

            if best_track is not None and best_iou >= self._iou_threshold:
                best_track.face = face
                best_track.frames_since_seen = 0
                matched.append(best_track)
                unmatched_tracks.remove(best_track)
            else:
                new_track = TrackedFace(track_id=self._next_id, face=face)
                self._next_id += 1
                matched.append(new_track)

        # Keep recently-missed tracks alive briefly (helps across skipped
        # detection frames) but don't return them as "current" detections.
        for track in unmatched_tracks:
            track.frames_since_seen += 1

        self._tracks = matched + [
            t for t in unmatched_tracks if t.frames_since_seen <= self._max_missed
        ]
        return matched
