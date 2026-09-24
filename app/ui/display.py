"""Minimal OpenCV window renderer: HUD text + face/head boxes.

HEAD_COUNT_SOURCE (set in .env) controls what is detected and shown:
  face   -- only green face boxes + "Faces detected: N"
  head   -- only cyan body/head boxes + "Heads detected: N"  (people
            looking down at desks are captured that face-only misses)
  both   -- green face boxes AND cyan body/head boxes, HUD shows both counts

Deliberately not a web UI for Phase 1 — cv2.imshow is the fastest way to
visually prove the pipeline works. This module only reads a PipelineResult
and draws; a Phase 2 FastAPI/WebSocket MJPEG endpoint can reuse
`draw_overlay()` and just skip the imshow/waitKey part.
"""
from __future__ import annotations

import cv2
import numpy as np

from app.camera.rtsp_stream import ConnectionState
from app.processing.pipeline import PipelineResult

WINDOW_NAME = "CCTV Face Detection - Phase 1"

_STATE_COLORS = {
    ConnectionState.CONNECTED: (0, 200, 0),
    ConnectionState.CONNECTING: (0, 200, 200),
    ConnectionState.RECONNECTING: (0, 140, 255),
    ConnectionState.STOPPED: (0, 0, 200),
}

# Colours for detection types
_FACE_COLOR = (0, 255, 0)        # bright green (YOLO Face)
_HEAD_COLOR = (255, 220, 0)      # cyan / teal (Person Body)
_ATTENDANCE_COLOR = (255, 120, 0)  # orange / purple (InsightFace Face Attendance)

# Activity mode: box color keyed by posture (BGR).
_POSTURE_COLORS = {
    "sitting": (0, 165, 255),   # orange
    "standing": (0, 255, 0),    # green
    "unknown": (150, 150, 150),  # gray
}

# OCR mode: magenta for a confirmed (multi-frame-voted) reading, dim gray
# for a region that's been seen but hasn't voted-in a stable string yet.
_OCR_CONFIRMED_COLOR = (255, 0, 255)
_OCR_PENDING_COLOR = (120, 120, 120)
_OCR_MIN_VOTES_TO_CONFIRM = 2


def draw_overlay(
    result: PipelineResult,
    camera_name: str,
    head_count_source: str = "face",
    show_hud: bool = True,
) -> np.ndarray:
    """Render bounding boxes and HUD onto a copy of result.frame.

    head_count_source controls which boxes are drawn and what the HUD says:
      'face'           -- green face boxes only (YOLO)
      'head'/'person'  -- cyan body/head boxes only (YOLO Person)
      'attendance'     -- orange/violet face boxes (InsightFace SCRFD + ArcFace)
      'activity'       -- boxes colored by posture, labeled with phone/PC use
      'ocr'            -- magenta once a text region's reading is voted-stable,
                          gray while still accumulating votes; label shows the
                          recognized text + confidence (+ vote count once confirmed)
    """
    frame = result.frame.copy()
    source = head_count_source.lower().strip()

    # --- Draw face boxes (green - YOLO Face) ---
    if source == "face":
        for t in result.tracked_faces:
            x1, y1, x2, y2 = t.face.bbox
            cv2.rectangle(frame, (x1, y1), (x2, y2), _FACE_COLOR, 2)
            if t.name != "Unknown":
                label = f"{t.name} (#{t.track_id})"
            else:
                label = f"Face #{t.track_id} {t.face.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), _FACE_COLOR, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # --- Draw attendance face boxes (InsightFace SCRFD + ArcFace) ---
    elif source == "attendance":
        for t in result.tracked_faces:
            x1, y1, x2, y2 = t.face.bbox
            cv2.rectangle(frame, (x1, y1), (x2, y2), _ATTENDANCE_COLOR, 2)
            if t.name != "Unknown":
                label = f"✓ {t.name} (#{t.track_id})"
            else:
                label = f"Att Face #{t.track_id} {t.face.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), _ATTENDANCE_COLOR, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # --- Draw head/body boxes (cyan) ---
    elif source in ("head", "person"):
        for t in result.tracked_heads:
            x1, y1, x2, y2 = t.face.bbox  # bbox field reused for body bbox
            cv2.rectangle(frame, (x1, y1), (x2, y2), _HEAD_COLOR, 2)
            label = f"Head #{t.track_id}  {t.face.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), _HEAD_COLOR, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # --- Draw activity boxes, colored by posture (Activity mode) ---
    elif source == "activity":
        for t in result.tracked_activity:
            x1, y1, x2, y2 = t.face.bbox
            color = _POSTURE_COLORS.get(t.posture, _POSTURE_COLORS["unknown"])
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            # Plain ASCII only -- cv2.putText's Hershey fonts can't render
            # emoji/Unicode and will draw garbled glyphs instead.
            label = f"#{t.track_id} {t.posture}"
            if t.phone_in_use:
                label += " PHONE"
            if t.computer_in_use:
                label += " PC"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # --- Draw OCR text regions (magenta once voted-stable, gray while pending) ---
    elif source == "ocr":
        for t in result.tracked_ocr:
            x1, y1, x2, y2 = t.face.bbox
            confirmed = t.text_votes >= _OCR_MIN_VOTES_TO_CONFIRM and bool(t.text)
            color = _OCR_CONFIRMED_COLOR if confirmed else _OCR_PENDING_COLOR
            if t.text_quad:
                pts = np.array(t.text_quad, dtype=np.int32).reshape(-1, 1, 2)
                cv2.polylines(frame, [pts], True, color, 2)
            else:
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            if confirmed:
                label = f"\"{t.text}\" {t.text_confidence:.2f} (x{t.text_votes})"
            elif t.text:
                label = f"...{t.text}? {t.text_confidence:.2f}"
            else:
                label = "..."
            if t.text_moving:
                label = "[moving] " + label
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            label_y = max(th + 8, y1)
            cv2.rectangle(frame, (x1, label_y - th - 8), (x1 + tw + 4, label_y), color, -1)
            text_color = (0, 0, 0) if confirmed else (255, 255, 255)
            cv2.putText(frame, label, (x1 + 2, label_y - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, text_color, 1)

    if show_hud:
        _draw_hud(frame, result, camera_name, source)
    return frame


def to_square(frame: np.ndarray, size: int = 1080, pad_color: tuple[int, int, int] = (0, 0, 0)) -> np.ndarray:
    """Letterbox `frame` into a size x size square for display, preserving
    aspect ratio (pads with `pad_color` instead of cropping or stretching --
    a stretched or cropped feed reads as unpolished in front of a client).

    Independent of the camera's native capture resolution -- call this last,
    after draw_overlay(), so boxes/HUD scale with the image for free instead
    of needing their own coordinate math.
    """
    h, w = frame.shape[:2]
    scale = size / max(h, w)
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
    resized = cv2.resize(frame, (new_w, new_h), interpolation=interp)

    canvas = np.full((size, size, 3), pad_color, dtype=np.uint8)
    y_off = (size - new_h) // 2
    x_off = (size - new_w) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized
    return canvas


def _draw_hud(
    frame: np.ndarray,
    result: PipelineResult,
    camera_name: str,
    source: str,
) -> None:
    color = _STATE_COLORS.get(result.connection_state, (255, 255, 255))

    lines = [
        (f"Camera: {camera_name}", (255, 255, 255)),
        (f"Connection: {result.connection_state.upper()}", color),
        (f"Resolution: {result.resolution[0]}x{result.resolution[1]}", (255, 255, 255)),
        (f"Capture FPS: {result.capture_fps:.1f}  Process FPS: {result.process_fps:.1f}", (255, 255, 255)),
        (f"Latency: {result.latency_ms:.0f} ms", (255, 255, 255)),
    ]

    if source == "face":
        lines.append((f"Faces detected: {len(result.tracked_faces)}", _FACE_COLOR))
    elif source == "attendance":
        lines.append((f"Attendance faces: {len(result.tracked_faces)}", _ATTENDANCE_COLOR))
    elif source in ("head", "person"):
        lines.append((f"Heads/bodies: {len(result.tracked_heads)}", _HEAD_COLOR))
    elif source == "activity":
        lines.append((f"Activity: {len(result.tracked_activity)} people", _POSTURE_COLORS["sitting"]))
    elif source == "ocr":
        confirmed = sum(1 for t in result.tracked_ocr if t.text_votes >= _OCR_MIN_VOTES_TO_CONFIRM and t.text)
        lines.append((f"OCR: {confirmed}/{len(result.tracked_ocr)} regions confirmed", _OCR_CONFIRMED_COLOR))

    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (370, 18 + 22 * len(lines)), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    y = 22
    for text, col in lines:
        cv2.putText(frame, text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 1, cv2.LINE_AA)
        y += 22


class Display:
    def __init__(self, window_name: str = WINDOW_NAME) -> None:
        self._window_name = window_name
        cv2.namedWindow(self._window_name, cv2.WINDOW_NORMAL)

    def show(self, frame: np.ndarray) -> None:
        cv2.imshow(self._window_name, frame)

    def poll_quit(self) -> bool:
        """Returns True if the user pressed 'q' or Esc, or closed the window."""
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            return True
        try:
            if cv2.getWindowProperty(self._window_name, cv2.WND_PROP_VISIBLE) < 1:
                return True
        except cv2.error:
            return True
        return False

    def close(self) -> None:
        cv2.destroyWindow(self._window_name)
