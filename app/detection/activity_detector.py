"""Per-person activity tracking: sitting/standing posture, phone/computer use.

Two models per frame, both stock/pretrained (no fine-tuning, no new dataset):

  1. Object detection + tracking -- reuses the SAME stock COCO checkpoint as
     PersonDetector (models/yolo11m-person.pt), just widened to also look for
     laptop/mouse/keyboard/cell-phone classes, run via Ultralytics' built-in
     .track() (BoT-SORT) instead of .predict() so each person keeps a stable
     ID across frames without needing SimpleIouTracker.
  2. Pose estimation (models/yolo11n-pose.pt) -- a separate, untracked, per-
     frame pass giving 17 COCO keypoints per person, used only to classify
     sitting vs standing.

Unlike every other detector in this package, detect() returns already-tracked
list[TrackedFace] (BoT-SORT assigns the track_id), not list[DetectedFace] --
see PROVIDES_TRACK_IDS below and app/processing/process_detector.py, which
checks it to skip wrapping this detector's output in another tracker.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from app.detection.face_detector import DetectedFace
from app.tracking.simple_tracker import TrackedFace

logger = logging.getLogger(__name__)

_MODEL_DIR = Path(__file__).parent.parent.parent / "models"
_OBJ_MODEL = _MODEL_DIR / "yolo11m-person.pt"
_POSE_MODEL = _MODEL_DIR / "yolo11n-pose.pt"
_TRACKER_CFG = _MODEL_DIR / "activity_botsort.yaml"

# COCO class ids (stock Ultralytics checkpoint): person, laptop, mouse,
# keyboard, cell phone. tv/monitor (62) deliberately left out for now --
# laptop/keyboard/mouse are a strong enough "at a computer" signal on their
# own without pulling in a TV in the background as a false "computer" hit.
_CLASS_PERSON = 0
_CLASS_LAPTOP = 63
_CLASS_MOUSE = 64
_CLASS_KEYBOARD = 66
_CLASS_PHONE = 67
_ACTIVITY_CLASSES = [_CLASS_PERSON, _CLASS_LAPTOP, _CLASS_MOUSE, _CLASS_KEYBOARD, _CLASS_PHONE]
_COMPUTER_CLASSES = {_CLASS_LAPTOP, _CLASS_MOUSE, _CLASS_KEYBOARD}

# COCO-pose keypoint indices.
_KP_NOSE = 0
_KP_SHOULDER_L, _KP_SHOULDER_R = 5, 6
_KP_ELBOW_L, _KP_ELBOW_R = 7, 8
_KP_WRIST_L, _KP_WRIST_R = 9, 10
_KP_HIP_L, _KP_HIP_R = 11, 12
_KP_KNEE_L, _KP_KNEE_R = 13, 14
_KP_MIN_CONF = 0.25

_POSE_IOU_MATCH_THRESHOLD = 0.3

# Confidence thresholds per object class
_PHONE_CONF_THRESHOLD = 0.12        # Cell phones are small and hand-occluded; lower threshold catches them
_COMPUTER_CONF_THRESHOLD = 0.25     # Keyboards/mice/laptops on desks
_PROXIMITY_PHONE_CONTAINMENT = 0.20 # Phone containment ratio inside upper-body/hand zone
_PROXIMITY_COMPUTER_CONTAINMENT = 0.35 # Computer peripheral containment inside active workspace zone

# Ultralytics' default resizes the long side to 640px before inference. On a
# 1920x1080+ main-stream frame that's a ~3x downscale -- fine for a
# person-sized box, but it can shrink a phone or mouse past the point YOLO
# can find it at all. Bumping this to 960 costs more CPU per frame but is
# the difference between "sometimes sees the phone" and "never does."
_IMG_SIZE = 960


def _containment_ratio(inner: tuple[int, int, int, int], outer: tuple[int, int, int, int]) -> float:
    ix1, iy1, ix2, iy2 = inner
    ox1, oy1, ox2, oy2 = outer
    inner_area = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inner_area <= 0:
        return 0.0
    ix1c, iy1c = max(ix1, ox1), max(iy1, oy1)
    ix2c, iy2c = min(ix2, ox2), min(iy2, oy2)
    inter = max(0, ix2c - ix1c) * max(0, iy2c - iy1c)
    return inter / inner_area


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return inter / float(area_a + area_b - inter)


def _expand_box(
    bbox: tuple[int, int, int, int],
    mx: float,
    my: float,
    w: int,
    h: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    bw, bh = x2 - x1, y2 - y1
    dx, dy = int(bw * mx), int(bh * my)
    return (max(0, x1 - dx), max(0, y1 - dy), min(w, x2 + dx), min(h, y2 + dy))


def _posture_from_bbox(bbox: tuple[int, int, int, int]) -> str:
    """Fallback when no usable pose keypoints are available: a tall/narrow
    person box reads as standing, a shorter/wider one as sitting."""
    x1, y1, x2, y2 = bbox
    w, h = x2 - x1, y2 - y1
    if w <= 0 or h <= 0:
        return "unknown"
    return "standing" if (h / w) >= 1.6 else "sitting"


def _classify_posture(keypoints_xy: np.ndarray, keypoints_conf: np.ndarray, bbox: tuple[int, int, int, int]) -> str:
    """Heuristic sitting/standing classifier off hip/knee/shoulder keypoints.

    This camera is ceiling-mounted/top-down (see face_detector.py's module
    docstring), so hip/knee/ankle keypoints will often be occluded by desks
    and monitors -- not a rare edge case. When keypoint confidence is too low
    to trust, fall back to the person box's aspect ratio.
    """
    needed = (_KP_SHOULDER_L, _KP_SHOULDER_R, _KP_HIP_L, _KP_HIP_R, _KP_KNEE_L, _KP_KNEE_R)
    if keypoints_conf.shape[0] <= max(needed) or any(keypoints_conf[i] < _KP_MIN_CONF for i in needed):
        return _posture_from_bbox(bbox)

    shoulder_y = (keypoints_xy[_KP_SHOULDER_L][1] + keypoints_xy[_KP_SHOULDER_R][1]) / 2
    hip_y = (keypoints_xy[_KP_HIP_L][1] + keypoints_xy[_KP_HIP_R][1]) / 2
    knee_y = (keypoints_xy[_KP_KNEE_L][1] + keypoints_xy[_KP_KNEE_R][1]) / 2
    torso_len = abs(hip_y - shoulder_y)
    lower_leg_len = abs(knee_y - hip_y)
    if torso_len < 1:
        return _posture_from_bbox(bbox)
    ratio = lower_leg_len / torso_len
    return "sitting" if ratio < 0.5 else "standing"


def _is_phone_in_use(
    phone_bbox: tuple[int, int, int, int],
    person_bbox: tuple[int, int, int, int],
    pose: tuple[np.ndarray, np.ndarray] | None,
    img_w: int,
    img_h: int,
) -> bool:
    """Check if a phone detection belongs to and is being used by this person."""
    px1, py1, px2, py2 = person_bbox
    pw, ph = px2 - px1, py2 - py1
    if pw <= 0 or ph <= 0:
        return False

    ox1, oy1, ox2, oy2 = phone_bbox
    ox_c = (ox1 + ox2) / 2
    oy_c = (oy1 + oy2) / 2

    # Check 1: Keypoint proximity (wrists / chest)
    if pose is not None:
        kxy, kconf = pose
        for wrist_idx in (_KP_WRIST_L, _KP_WRIST_R):
            if wrist_idx < len(kconf) and kconf[wrist_idx] >= _KP_MIN_CONF:
                wx, wy = kxy[wrist_idx]
                dist = np.hypot(ox_c - wx, oy_c - wy)
                if dist <= max(45, ph * 0.35):
                    return True

    # Check 2: Phone is in front torso / hand zone of the person
    phone_expanded = _expand_box(person_bbox, mx=0.15, my=0.10, w=img_w, h=img_h)
    ratio = _containment_ratio(phone_bbox, phone_expanded)
    if ratio >= _PROXIMITY_PHONE_CONTAINMENT:
        if py1 + 0.10 * ph <= oy_c <= py2 + 0.15 * ph:
            return True

    return False


def _is_computer_in_use(
    comp_bbox: tuple[int, int, int, int],
    cls: int,
    person_bbox: tuple[int, int, int, int],
    pose: tuple[np.ndarray, np.ndarray] | None,
    phone_detected: bool,
    img_w: int,
    img_h: int,
) -> bool:
    """Check if a computer peripheral (laptop/keyboard/mouse) is actively in use."""
    px1, py1, px2, py2 = person_bbox
    pw, ph = px2 - px1, py2 - py1
    if pw <= 0 or ph <= 0:
        return False

    ox1, oy1, ox2, oy2 = comp_bbox
    ox_c = (ox1 + ox2) / 2
    oy_c = (oy1 + oy2) / 2

    # Check 1: Keypoint proximity (hands/wrists on keyboard/mouse/laptop)
    if pose is not None:
        kxy, kconf = pose
        wrists_valid = [
            idx for idx in (_KP_WRIST_L, _KP_WRIST_R)
            if idx < len(kconf) and kconf[idx] >= _KP_MIN_CONF
        ]
        if wrists_valid:
            for idx in wrists_valid:
                wx, wy = kxy[idx]
                if (ox1 - 30 <= wx <= ox2 + 30) and (oy1 - 30 <= wy <= oy2 + 30):
                    return True

    # Check 2: If phone is actively in use, ignore idle side-table keyboards
    if phone_detected:
        comp_expanded = _expand_box(person_bbox, mx=0.05, my=0.10, w=img_w, h=img_h)
        ratio = _containment_ratio(comp_bbox, comp_expanded)
        return (cls == _CLASS_LAPTOP and ratio >= 0.50) or ratio >= 0.65

    # Check 3: Active working workspace zone
    # Tighter horizontal margin (0.08) prevents idle side-table keyboards from false-triggering
    comp_expanded = _expand_box(person_bbox, mx=0.08, my=0.15, w=img_w, h=img_h)
    ratio = _containment_ratio(comp_bbox, comp_expanded)
    if ratio >= _PROXIMITY_COMPUTER_CONTAINMENT:
        if (px1 - 0.10 * pw <= ox_c <= px2 + 0.10 * pw) and (py1 + 0.20 * ph <= oy_c <= py2 + 0.20 * ph):
            return True

    return False


class ActivityDetector:
    """Stock YOLO11m (COCO, object+track) + YOLO11n-pose, both CPU.

    Not for identity -- track ids are anonymous and reset whenever this
    worker stops receiving frames for a while (e.g. switching to another
    mode and back), since BoT-SORT's internal state goes stale relative to
    wall-clock time during the gap.
    """

    PROVIDES_TRACK_IDS = True

    def __init__(self, conf_threshold: float = 0.35, pose_conf_threshold: float = 0.35) -> None:
        import torch
        from ultralytics import YOLO

        if not _OBJ_MODEL.exists():
            raise FileNotFoundError(f"Activity object model not found at {_OBJ_MODEL}.")
        if not _POSE_MODEL.exists():
            raise FileNotFoundError(
                f"Activity pose model not found at {_POSE_MODEL}. "
                "YOLO('yolo11n-pose.pt') auto-downloads it, then move/rename it "
                f"to {_POSE_MODEL}."
            )

        self._conf = conf_threshold
        self._pose_conf = pose_conf_threshold
        if torch.backends.mps.is_available():
            self._device = "mps"
        elif torch.cuda.is_available():
            self._device = "cuda"
        else:
            self._device = "cpu"
        self._track_smooth: dict[int, dict[str, list[bool]]] = {}

        logger.info("Loading Activity object+track model (YOLO11m/COCO) on device=%s ...", self._device)
        self._obj_model = YOLO(str(_OBJ_MODEL))
        logger.info("Loading Activity pose model (YOLO11n-pose) on device=%s ...", self._device)
        self._pose_model = YOLO(str(_POSE_MODEL))

        # Base track confidence: lower of person floor and phone floor
        self._track_conf = min(self._conf, _PHONE_CONF_THRESHOLD, _COMPUTER_CONF_THRESHOLD)

        blank = np.zeros((320, 320, 3), dtype=np.uint8)
        self._obj_model.track(
            blank, persist=True, tracker=str(_TRACKER_CFG), imgsz=_IMG_SIZE,
            classes=_ACTIVITY_CLASSES, conf=self._track_conf, device=self._device, verbose=False,
        )
        self._pose_model.predict(blank, conf=self._pose_conf, device=self._device, verbose=False)
        logger.info("Activity detector ready (conf=%.2f, pose_conf=%.2f)", conf_threshold, pose_conf_threshold)

    def detect(self, frame: np.ndarray) -> list[TrackedFace]:
        h, w = frame.shape[:2]

        obj_results = self._obj_model.track(
            frame, persist=True, tracker=str(_TRACKER_CFG), imgsz=_IMG_SIZE,
            classes=_ACTIVITY_CLASSES, conf=self._track_conf, device=self._device, verbose=False,
        )
        boxes = obj_results[0].boxes
        if boxes is None or boxes.id is None:
            return []

        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clss = boxes.cls.cpu().numpy().astype(int)
        ids = boxes.id.cpu().numpy().astype(int)

        person_boxes: list[tuple[int, tuple[int, int, int, int], float]] = []  # (track_id, bbox, conf)
        phone_boxes: list[tuple[int, int, int, int]] = []
        computer_boxes: list[tuple[int, tuple[int, int, int, int]]] = []  # (cls, bbox)

        for (x1f, y1f, x2f, y2f), score, cls, pid in zip(xyxy, confs, clss, ids):
            x1, y1 = max(0, int(x1f)), max(0, int(y1f))
            x2, y2 = min(w, int(x2f)), min(h, int(y2f))
            bbox = (x1, y1, x2, y2)

            if cls == _CLASS_PERSON:
                if score >= self._conf:
                    person_boxes.append((int(pid), bbox, float(score)))
            elif cls == _CLASS_PHONE:
                if score >= _PHONE_CONF_THRESHOLD:
                    phone_boxes.append(bbox)
            elif cls in _COMPUTER_CLASSES:
                if score >= _COMPUTER_CONF_THRESHOLD:
                    computer_boxes.append((cls, bbox))

        if not person_boxes:
            return []

        pose_results = self._pose_model.predict(frame, conf=self._pose_conf, device=self._device, verbose=False)
        pose_boxes: list[tuple[tuple[int, int, int, int], np.ndarray, np.ndarray]] = []
        pr = pose_results[0]
        if pr.boxes is not None and pr.keypoints is not None and len(pr.boxes) > 0:
            pxyxy = pr.boxes.xyxy.cpu().numpy()
            kxy = pr.keypoints.xy.cpu().numpy()
            kconf = pr.keypoints.conf.cpu().numpy() if pr.keypoints.conf is not None else None
            for i, (px1f, py1f, px2f, py2f) in enumerate(pxyxy):
                pbbox = (
                    max(0, int(px1f)), max(0, int(py1f)),
                    min(w, int(px2f)), min(h, int(py2f)),
                )
                conf_row = kconf[i] if kconf is not None else np.ones(kxy.shape[1], dtype=np.float32)
                pose_boxes.append((pbbox, kxy[i], conf_row))

        tracked: list[TrackedFace] = []
        active_track_ids = set()

        for track_id, bbox, score in person_boxes:
            active_track_ids.add(track_id)

            # Match pose
            best_iou, best_pose = _POSE_IOU_MATCH_THRESHOLD, None
            for pbbox, kxy, kconf in pose_boxes:
                score_iou = _iou(bbox, pbbox)
                if score_iou > best_iou:
                    best_iou, best_pose = score_iou, (kxy, kconf)

            posture = (
                _classify_posture(best_pose[0], best_pose[1], bbox)
                if best_pose is not None
                else _posture_from_bbox(bbox)
            )

            # Check phone use
            raw_phone = any(
                _is_phone_in_use(p_bbox, bbox, best_pose, w, h)
                for p_bbox in phone_boxes
            )

            # Check computer use
            raw_computer = any(
                _is_computer_in_use(c_bbox, c_cls, bbox, best_pose, raw_phone, w, h)
                for c_cls, c_bbox in computer_boxes
            )

            # Multi-frame smoothing (anti-flicker)
            history = self._track_smooth.setdefault(track_id, {"phone": [], "computer": []})
            history["phone"].append(raw_phone)
            history["computer"].append(raw_computer)
            if len(history["phone"]) > 5:
                history["phone"].pop(0)
            if len(history["computer"]) > 5:
                history["computer"].pop(0)

            # Output states with short hysteresis
            phone_in_use = sum(history["phone"]) >= 2 or (raw_phone and len(history["phone"]) < 3)
            computer_in_use = sum(history["computer"]) >= 3 or (raw_computer and len(history["computer"]) < 3)

            # If phone is actively detected in hands, suppress false computer triggers from side peripherals
            if phone_in_use and not any(cls == _CLASS_LAPTOP for cls, _ in computer_boxes):
                computer_in_use = False

            tracked.append(
                TrackedFace(
                    track_id=track_id,
                    face=DetectedFace(
                        bbox=bbox,
                        confidence=score,
                        landmarks=np.empty((0, 2), dtype=np.float32),
                    ),
                    posture=posture,
                    phone_in_use=phone_in_use,
                    computer_in_use=computer_in_use,
                )
            )

        # Cleanup stale smoothed tracks
        self._track_smooth = {tid: hist for tid, hist in self._track_smooth.items() if tid in active_track_ids}

        return tracked

    def close(self) -> None:
        self._track_smooth.clear()
