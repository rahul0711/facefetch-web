"""FastAPI app for the face-fetching website: upload/capture a selfie, get
back every photo you appear in.

Two modes share the same models:
  * Browser library (what the frontend uses): the user's photos live in
    their browser (IndexedDB). The browser sends each photo to /api/analyze
    once to get its faces + embeddings, and the selfie to /api/query; the
    matching itself happens in the browser. Nothing is stored server-side.
  * Server folder: photos in data/gallery are indexed here and searched
    with /api/search.

Separate from attendance_server.py on purpose -- that app starts the RTSP
camera recognition worker, which this site doesn't need.

    POST /api/analyze                 multipart image -> every face's box + embedding (stateless)
    POST /api/query                   multipart images[] (1-5 selfie frames) -> query embedding (stateless)
    GET  /api/status                  gallery size + scan progress (public)
    POST /api/search                  multipart images[] (1-5 selfie frames) -> matches
    GET  /api/photos/{id}/thumb       resized JPEG
    GET  /api/photos/{id}             original file (?download=1 to save)
    POST /api/photos/zip              form field ids=a,b,c -> zip of the originals
    POST /api/gallery/rescan          force a rescan now (admin token)

Run (from the project root, with the venv active) -- see scripts/run_face_search.sh:
    uvicorn app.web.face_search_server:app --host 0.0.0.0 --port 8002
"""
from __future__ import annotations

import base64
import logging
import tempfile
import zipfile
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.attendance.config import AttendanceConfig
from app.attendance.detector import ScrfdDetector
from app.attendance.embedder import AdaFaceEmbedder
from app.face_search.config import load_face_search_config
from app.face_search.engine import FaceEngine, NoFaceFound
from app.face_search.gallery import Gallery
from app.web.auth import require_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s: %(message)s")
logger = logging.getLogger("face_search_web")

ROOT = Path(__file__).resolve().parent.parent.parent
_FRONTEND_DIST = ROOT / "frontend" / "dist"
MAX_QUERY_IMAGES = 5

cfg = load_face_search_config()
_engine: FaceEngine | None = None
_gallery: Gallery | None = None


def engine() -> FaceEngine:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Server is still starting up")
    return _engine


def gallery() -> Gallery:
    if _gallery is None:
        raise HTTPException(status_code=503, detail="Server is still starting up")
    return _gallery


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _engine, _gallery
    logger.info("Loading SCRFD + AdaFace models...")
    model_cfg = AttendanceConfig()
    _engine = FaceEngine(cfg, ScrfdDetector(model_cfg), AdaFaceEmbedder(model_cfg))
    _gallery = Gallery(cfg, _engine)
    _gallery.start_background_scanner()
    logger.info("Face search ready. Gallery folder: %s", cfg.gallery_dir)
    yield
    _gallery.stop()


app = FastAPI(title="Face Fetch API", lifespan=lifespan)


@app.get("/api/status")
def status() -> dict:
    g = gallery()
    return {
        "photos": g.photo_count,
        "faces": g.face_count,
        "scan": asdict(g.status),
        "match_threshold": cfg.match_threshold,
    }


def _read_image(upload: UploadFile) -> np.ndarray | None:
    raw = upload.file.read(cfg.max_upload_bytes + 1)
    if len(raw) > cfg.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image is too large")
    return cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)


def _read_query_images(images: list[UploadFile]) -> list[np.ndarray]:
    if not images:
        raise HTTPException(status_code=400, detail="Send at least one image")
    decoded = [img for img in (_read_image(u) for u in images[:MAX_QUERY_IMAGES]) if img is not None]
    if not decoded:
        raise HTTPException(status_code=422, detail="That file isn't an image we can read")
    return decoded


def _embed_query(images: list[UploadFile]) -> np.ndarray:
    try:
        return engine().embed_query(_read_query_images(images))
    except NoFaceFound as e:
        raise HTTPException(status_code=422, detail=str(e))


def _b64(vec: np.ndarray) -> str:
    # float32 little-endian, base64 -- ~2.7KB per face vs ~9KB as a JSON list;
    # the browser decodes it straight into a Float32Array.
    return base64.b64encode(np.ascontiguousarray(vec, dtype="<f4").tobytes()).decode("ascii")


# All endpoints below are sync on purpose: FastAPI runs them in the
# threadpool, so GPU inference doesn't block the event loop.


@app.post("/api/analyze")
def analyze(image: UploadFile = File(...)) -> dict:
    img = _read_image(image)
    if img is None:
        raise HTTPException(status_code=422, detail="That file isn't an image we can read")
    faces = engine().analyze_photo(img)
    return {
        "width": faces.width,
        "height": faces.height,
        "faces": [
            {"box": box, "score": score, "embedding": _b64(emb)}
            for box, score, emb in zip(faces.boxes, faces.scores, faces.embeddings)
        ],
    }


@app.post("/api/query")
def query(images: list[UploadFile] = File(...)) -> dict:
    # The selfie itself is never written to disk.
    return {"embedding": _b64(_embed_query(images)), "match_threshold": cfg.match_threshold}


@app.post("/api/search")
def search(images: list[UploadFile] = File(...)) -> dict:
    g = gallery()
    q = _embed_query(images)
    # The selfie itself is never written to disk -- only its embedding is
    # used, and only for the duration of this request.
    matches = g.search(q)
    return {
        "matches": [asdict(m) for m in matches],
        "searched_photos": g.photo_count,
        "scanning": g.status.scanning,
    }


def _photo_or_404(photo_id: str):
    photo = gallery().get_photo(photo_id)
    if photo is None or not photo.readable:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


# POST (a plain form submit from the browser) rather than GET: hundreds of
# ids don't fit in a URL, and a form submit still hands the response to the
# browser's own download manager.
@app.post("/api/photos/zip")
def photos_zip(ids: str = Form(..., description="comma-separated photo ids")):
    g = gallery()
    wanted = [i for i in dict.fromkeys(ids.split(",")) if i][: cfg.max_zip_photos]
    photos = [p for p in (g.get_photo(i) for i in wanted) if p is not None and p.readable]
    if not photos:
        raise HTTPException(status_code=404, detail="No photos found")

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    used: set[str] = set()
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as zf:  # JPEGs don't compress
        for p in photos:
            name, n = p.name, 1
            while name in used:
                stem, suffix = Path(p.name).stem, Path(p.name).suffix
                name, n = f"{stem}_{n}{suffix}", n + 1
            used.add(name)
            path = g.photo_path(p)
            if path.exists():
                zf.write(path, arcname=name)
    tmp.close()
    return FileResponse(
        tmp.name,
        media_type="application/zip",
        filename="my-photos.zip",
        background=BackgroundTask(Path(tmp.name).unlink, missing_ok=True),
    )


@app.get("/api/photos/{photo_id}/thumb")
def photo_thumb(photo_id: str):
    thumb = gallery().thumbnail(_photo_or_404(photo_id))
    if thumb is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(thumb, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


@app.get("/api/photos/{photo_id}")
def photo_original(photo_id: str, download: bool = False):
    photo = _photo_or_404(photo_id)
    path = gallery().photo_path(photo)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(
        path,
        filename=photo.name,
        content_disposition_type="attachment" if download else "inline",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@app.post("/api/gallery/rescan", dependencies=[Depends(require_token)])
def rescan() -> dict:
    gallery().trigger_rescan()
    return {"ok": True}


class SpaStaticFiles(StaticFiles):
    """Serves the built React app; unknown non-API paths (client-side routes
    like /events/abc) get index.html so a refresh or deep link works."""

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            if e.status_code != 404 or path.startswith("api/"):
                raise
            return await super().get_response("index.html", scope)


if _FRONTEND_DIST.exists():
    app.mount("/", SpaStaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
    logger.info("Serving built frontend from %s", _FRONTEND_DIST)
else:
    logger.info("No frontend build at %s -- run `npm run build` in frontend/, or use `npm run dev`", _FRONTEND_DIST)
