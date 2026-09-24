"""Stateless face analysis: detect every face in an image and embed it with
AdaFace, or build a search query from a selfie. Shared by the server-side
folder gallery (gallery.py) and the browser-library endpoints, which keep
nothing on the server.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass

import cv2
import numpy as np

from app.attendance.detector import DetectedFace, ScrfdDetector
from app.attendance.embedder import AdaFaceEmbedder
from app.face_search.config import FaceSearchConfig

EMBEDDING_DIM = 512
# Photos bigger than this (longest side) are downscaled before detection --
# 24MP phone photos gain nothing over this but cost memory/time.
MAX_PROCESS_SIDE = 3000
MAX_QUERY_SIDE = 1600


class NoFaceFound(ValueError):
    pass


@dataclass
class PhotoFaces:
    width: int
    height: int
    # Per face: normalized [x1, y1, x2, y2] (0..1 of width/height).
    boxes: list[list[float]]
    scores: list[float]
    embeddings: np.ndarray  # (N, 512) float32, L2-normalized


def _largest_face(faces: list[DetectedFace]) -> DetectedFace:
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def downscale(img: np.ndarray, max_side: int) -> np.ndarray:
    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale >= 1:
        return img
    return cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


class FaceEngine:
    def __init__(self, cfg: FaceSearchConfig, detector: ScrfdDetector, embedder: AdaFaceEmbedder) -> None:
        self._cfg = cfg
        self._detector = detector
        self._embedder = embedder
        # One SCRFD + one AdaFace session shared by every request thread and
        # the folder scanner -- serialize inference on them.
        self._lock = threading.Lock()

    def analyze_photo(self, img: np.ndarray) -> PhotoFaces:
        """Every usable face in a library photo, embedded."""
        img = downscale(img, MAX_PROCESS_SIDE)
        h, w = img.shape[:2]
        with self._lock:
            faces = [
                f
                for f in self._detector.detect(img)
                if f.width_px >= self._cfg.min_gallery_face_px and f.det_score >= self._cfg.min_det_score
            ]
            emb = self._embedder.embed_from_detections(img, faces) if faces else np.zeros((0, EMBEDDING_DIM), np.float32)
        return PhotoFaces(
            width=w,
            height=h,
            boxes=[
                [
                    round(max(0.0, float(f.bbox[0]) / w), 5),
                    round(max(0.0, float(f.bbox[1]) / h), 5),
                    round(min(1.0, float(f.bbox[2]) / w), 5),
                    round(min(1.0, float(f.bbox[3]) / h), 5),
                ]
                for f in faces
            ],
            scores=[round(f.det_score, 4) for f in faces],
            embeddings=emb.astype(np.float32),
        )

    def embed_query(self, images_bgr: list[np.ndarray]) -> np.ndarray:
        """Embed the most prominent face in each query image and average
        them (several webcam frames of the same person make a steadier query
        than one). Raises NoFaceFound if no image has a usable face."""
        vecs = []
        too_small = False
        for img in images_bgr:
            img = downscale(img, MAX_QUERY_SIDE)
            with self._lock:
                faces = [f for f in self._detector.detect(img) if f.det_score >= self._cfg.min_det_score]
                if not faces:
                    # SCRFD misses faces that fill the whole frame (tight
                    # crops, extreme close-ups) -- retry with a border.
                    pad = max(img.shape[:2]) // 2
                    img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
                    faces = [f for f in self._detector.detect(img) if f.det_score >= self._cfg.min_det_score]
                if not faces:
                    continue
                face = _largest_face(faces)
                if face.width_px < self._cfg.min_query_face_px:
                    too_small = True
                    continue
                vecs.append(self._embedder.embed_from_detections(img, [face])[0])
        if not vecs:
            if too_small:
                raise NoFaceFound("The face is too small. Move closer to the camera or use a closer photo.")
            raise NoFaceFound("We couldn't find a face. Face the camera in good light and try again.")
        q = np.mean(vecs, axis=0)
        return (q / (np.linalg.norm(q) or 1.0)).astype(np.float32)
