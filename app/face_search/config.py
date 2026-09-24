"""Config for the face-fetching (photo search) website.

Everything is overridable from the environment so the photo folder and the
match threshold can be changed without touching code.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".bmp"})


def _float(name: str, default: float) -> float:
    val = os.getenv(name)
    return float(val) if val else default


def _int(name: str, default: int) -> int:
    val = os.getenv(name)
    return int(val) if val else default


def _path(name: str, default: str) -> Path:
    p = Path(os.getenv(name, default))
    return p if p.is_absolute() else ROOT / p


@dataclass(frozen=True)
class FaceSearchConfig:
    # The folder of photos to search. Drop images in here (subfolders are
    # fine); the background scanner picks up new/changed/deleted files.
    gallery_dir: Path = field(default_factory=lambda: _path("PHOTO_GALLERY_DIR", "data/gallery"))
    # Embedding cache + generated thumbnails. Safe to delete -- it's rebuilt
    # on the next scan.
    cache_dir: Path = field(default_factory=lambda: _path("FACE_SEARCH_CACHE_DIR", "data/face_search"))

    # Cosine similarity (AdaFace) above which a gallery face counts as the
    # same person as the selfie. Lower = more results but more false
    # matches. Calibrate on your own photos with scripts/calibrate_threshold.py.
    match_threshold: float = field(default_factory=lambda: _float("SEARCH_MATCH_THRESHOLD", 0.35))

    # Faces narrower than this in a gallery photo are skipped -- too few
    # pixels for a trustworthy embedding (distant faces in crowd shots).
    min_gallery_face_px: int = field(default_factory=lambda: _int("MIN_GALLERY_FACE_PX", 28))
    # The selfie's face must be at least this wide.
    min_query_face_px: int = field(default_factory=lambda: _int("MIN_QUERY_FACE_PX", 48))
    min_det_score: float = field(default_factory=lambda: _float("MIN_FACE_DET_SCORE", 0.5))

    # How often the background scanner re-walks the gallery folder.
    rescan_interval_s: float = field(default_factory=lambda: _float("GALLERY_RESCAN_INTERVAL_S", 60.0))

    max_upload_bytes: int = field(default_factory=lambda: _int("MAX_UPLOAD_MB", 15) * 1024 * 1024)
    thumb_max_side: int = field(default_factory=lambda: _int("THUMB_MAX_SIDE", 640))
    max_zip_photos: int = field(default_factory=lambda: _int("MAX_ZIP_PHOTOS", 500))

    @property
    def thumbs_dir(self) -> Path:
        return self.cache_dir / "thumbs"


def load_face_search_config() -> FaceSearchConfig:
    return FaceSearchConfig()
