"""Indexed photo gallery: every face in every photo under gallery_dir,
embedded with AdaFace and searchable by cosine similarity (FAISS).

Scanning is incremental: each photo's faces/embeddings are cached keyed by
(relative path, mtime, size), so only new or changed files are re-embedded
on a rescan and a server restart doesn't re-process the whole folder.

Photo ids are random tokens (kept stable through the cache), not derived
from file paths -- the only way to get a photo's URL is to be shown it in a
search result.
"""
from __future__ import annotations

import json
import logging
import os
import secrets
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

import cv2
import faiss
import numpy as np

from app.face_search.config import IMAGE_EXTENSIONS, FaceSearchConfig
from app.face_search.engine import EMBEDDING_DIM, FaceEngine, downscale

logger = logging.getLogger(__name__)

# While a long first scan is running, publish what's been indexed so far
# every this-many photos so searches work before the scan finishes.
PUBLISH_EVERY = 50
CACHE_VERSION = 1


@dataclass
class Photo:
    photo_id: str
    rel_path: str
    mtime: float
    size: int
    width: int = 0
    height: int = 0
    # Per face: normalized [x1, y1, x2, y2] (0..1 of width/height) + det score.
    boxes: list[list[float]] = field(default_factory=list)
    scores: list[float] = field(default_factory=list)
    embeddings: np.ndarray = field(default_factory=lambda: np.zeros((0, EMBEDDING_DIM), np.float32))
    readable: bool = True

    @property
    def name(self) -> str:
        return Path(self.rel_path).name


@dataclass
class Match:
    photo_id: str
    name: str
    score: float
    width: int
    height: int
    box: list[float]  # the matched face, normalized
    face_count: int


@dataclass
class ScanStatus:
    scanning: bool = False
    done: int = 0
    total: int = 0
    last_scan_at: float | None = None
    last_error: str | None = None


class Gallery:
    def __init__(self, cfg: FaceSearchConfig, engine: FaceEngine) -> None:
        self._cfg = cfg
        self._engine = engine

        # Guards _photos / _index / _face_owner (swapped wholesale on publish).
        self._lock = threading.Lock()
        # Only one scan at a time (periodic scanner vs. manual rescan).
        self._scan_lock = threading.Lock()

        self._photos: dict[str, Photo] = {}  # rel_path -> Photo
        self._by_id: dict[str, Photo] = {}
        self._index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self._face_owner: list[tuple[str, int]] = []  # index row -> (photo_id, face_idx)
        self.status = ScanStatus()

        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

        cfg.gallery_dir.mkdir(parents=True, exist_ok=True)
        cfg.thumbs_dir.mkdir(parents=True, exist_ok=True)
        self._load_cache()

    # ---------------------------------------------------------------- cache

    @property
    def _meta_path(self) -> Path:
        return self._cfg.cache_dir / "gallery_meta.json"

    @property
    def _emb_path(self) -> Path:
        return self._cfg.cache_dir / "gallery_embeddings.npy"

    def _load_cache(self) -> None:
        if not self._meta_path.exists() or not self._emb_path.exists():
            return
        try:
            meta = json.loads(self._meta_path.read_text())
            if meta.get("version") != CACHE_VERSION:
                logger.info("Gallery cache version mismatch -- rebuilding from scratch")
                return
            all_emb = np.load(self._emb_path, allow_pickle=False)
            photos = {}
            for p in meta["photos"]:
                start, count = p.pop("emb_start"), len(p["boxes"])
                photos[p["rel_path"]] = Photo(**p, embeddings=all_emb[start : start + count].astype(np.float32))
        except Exception:
            logger.exception("Gallery cache unreadable -- rebuilding from scratch")
            return
        self._publish(photos)
        logger.info("Loaded gallery cache: %d photos, %d faces", len(photos), self._index.ntotal)

    def _save_cache(self, photos: dict[str, Photo]) -> None:
        rows, entries, offset = [], [], 0
        for photo in photos.values():
            d = asdict(photo)
            d.pop("embeddings")
            d["emb_start"] = offset
            entries.append(d)
            rows.append(photo.embeddings)
            offset += len(photo.embeddings)
        all_emb = np.concatenate(rows) if rows else np.zeros((0, EMBEDDING_DIM), np.float32)

        # write-then-rename so a crash mid-save never leaves a torn cache
        tmp_emb = self._emb_path.with_suffix(".tmp.npy")
        tmp_meta = self._meta_path.with_suffix(".tmp")
        np.save(tmp_emb, all_emb.astype(np.float32))
        tmp_meta.write_text(json.dumps({"version": CACHE_VERSION, "photos": entries}))
        os.replace(tmp_emb, self._emb_path)
        os.replace(tmp_meta, self._meta_path)

    def _publish(self, photos: dict[str, Photo]) -> None:
        index = faiss.IndexFlatIP(EMBEDDING_DIM)
        owner: list[tuple[str, int]] = []
        vecs = []
        for photo in photos.values():
            for i in range(len(photo.embeddings)):
                owner.append((photo.photo_id, i))
            if len(photo.embeddings):
                vecs.append(photo.embeddings)
        if vecs:
            index.add(np.concatenate(vecs).astype(np.float32))
        with self._lock:
            self._photos = dict(photos)
            self._by_id = {p.photo_id: p for p in photos.values()}
            self._index = index
            self._face_owner = owner

    # ----------------------------------------------------------------- scan

    def _list_files(self) -> dict[str, tuple[Path, float, int]]:
        root = self._cfg.gallery_dir
        found = {}
        for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]
            for fn in filenames:
                if fn.startswith(".") or Path(fn).suffix.lower() not in IMAGE_EXTENSIONS:
                    continue
                path = Path(dirpath) / fn
                try:
                    st = path.stat()
                except OSError:
                    continue
                found[path.relative_to(root).as_posix()] = (path, st.st_mtime, st.st_size)
        return found

    def _process(self, rel: str, path: Path, mtime: float, size: int, photo_id: str) -> Photo:
        photo = Photo(photo_id=photo_id, rel_path=rel, mtime=mtime, size=size)
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)  # applies EXIF orientation
        if img is None:
            logger.warning("Unreadable image, skipping: %s", rel)
            photo.readable = False
            return photo
        faces = self._engine.analyze_photo(img)
        photo.width, photo.height = faces.width, faces.height
        photo.boxes, photo.scores, photo.embeddings = faces.boxes, faces.scores, faces.embeddings
        return photo

    def _drop_thumbs(self, photo_id: str) -> None:
        for t in self._cfg.thumbs_dir.glob(f"{photo_id}_*.jpg"):
            t.unlink(missing_ok=True)

    def scan(self) -> None:
        """Bring the index in line with the gallery folder. Blocks; call from
        a background thread."""
        if not self._scan_lock.acquire(blocking=False):
            return  # a scan is already running
        try:
            files = self._list_files()
            with self._lock:
                current = dict(self._photos)

            todo = [
                rel
                for rel, (_, mtime, size) in files.items()
                if rel not in current or (current[rel].mtime, current[rel].size) != (mtime, size)
            ]
            removed = [rel for rel in current if rel not in files]
            if not todo and not removed:
                self.status.last_scan_at = time.time()
                return

            logger.info("Gallery scan: %d new/changed, %d removed", len(todo), len(removed))
            self.status.scanning, self.status.done, self.status.total = True, 0, len(todo)

            photos = {rel: p for rel, p in current.items() if rel in files and rel not in todo}
            for rel in removed:
                self._drop_thumbs(current[rel].photo_id)

            for i, rel in enumerate(todo, 1):
                path, mtime, size = files[rel]
                old = current.get(rel)
                if old is not None:
                    self._drop_thumbs(old.photo_id)
                photo_id = old.photo_id if old else secrets.token_urlsafe(12)
                try:
                    photos[rel] = self._process(rel, path, mtime, size, photo_id)
                except Exception:
                    logger.exception("Failed to process %s", rel)
                self.status.done = i
                if i % PUBLISH_EVERY == 0:
                    self._publish(photos)

            self._publish(photos)
            self._save_cache(photos)
            self.status.last_error = None
            logger.info("Gallery scan done: %d photos, %d faces indexed", len(photos), self.face_count)
        except Exception as e:
            logger.exception("Gallery scan failed")
            self.status.last_error = str(e)
        finally:
            self.status.scanning = False
            self.status.last_scan_at = time.time()
            self._scan_lock.release()

    def start_background_scanner(self) -> None:
        def loop() -> None:
            while not self._stop.is_set():
                self.scan()
                self._stop.wait(self._cfg.rescan_interval_s)

        self._thread = threading.Thread(target=loop, name="gallery-scanner", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def trigger_rescan(self) -> None:
        threading.Thread(target=self.scan, name="gallery-rescan", daemon=True).start()

    # --------------------------------------------------------------- search

    def search(self, query: np.ndarray, threshold: float | None = None) -> list[Match]:
        threshold = self._cfg.match_threshold if threshold is None else threshold
        with self._lock:
            index, owner, by_id = self._index, self._face_owner, self._by_id
        if index.ntotal == 0:
            return []
        # IP range search returns every face scoring above the threshold --
        # no arbitrary top-k cap on how many photos someone can be in.
        lims, scores, idxs = index.range_search(query.reshape(1, -1), float(threshold))
        best: dict[str, tuple[float, int]] = {}
        for score, idx in zip(scores[lims[0] : lims[1]], idxs[lims[0] : lims[1]]):
            photo_id, face_idx = owner[idx]
            if photo_id not in best or score > best[photo_id][0]:
                best[photo_id] = (float(score), face_idx)

        matches = []
        for photo_id, (score, face_idx) in best.items():
            p = by_id.get(photo_id)
            if p is None:
                continue
            matches.append(
                Match(
                    photo_id=photo_id,
                    name=p.name,
                    score=round(score, 4),
                    width=p.width,
                    height=p.height,
                    box=p.boxes[face_idx],
                    face_count=len(p.boxes),
                )
            )
        matches.sort(key=lambda m: m.score, reverse=True)
        return matches

    # ---------------------------------------------------------------- files

    def get_photo(self, photo_id: str) -> Photo | None:
        with self._lock:
            return self._by_id.get(photo_id)

    def photo_path(self, photo: Photo) -> Path:
        return self._cfg.gallery_dir / photo.rel_path

    def thumbnail(self, photo: Photo) -> Path | None:
        thumb = self._cfg.thumbs_dir / f"{photo.photo_id}_{int(photo.mtime)}.jpg"
        if thumb.exists():
            return thumb
        img = cv2.imread(str(self.photo_path(photo)), cv2.IMREAD_COLOR)
        if img is None:
            return None
        img = downscale(img, self._cfg.thumb_max_side)
        # unique temp name: two requests may render the same thumb at once
        tmp = thumb.with_name(f".{thumb.stem}.{secrets.token_hex(4)}.jpg")
        cv2.imwrite(str(tmp), img, [cv2.IMWRITE_JPEG_QUALITY, 82])
        os.replace(tmp, thumb)
        return thumb

    @property
    def photo_count(self) -> int:
        with self._lock:
            return sum(1 for p in self._photos.values() if p.readable)

    @property
    def face_count(self) -> int:
        with self._lock:
            return self._index.ntotal
