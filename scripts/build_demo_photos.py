"""Build the demo photo set for the FaceFetch frontend prototype.

Downloads freely-licensed Unsplash photos (Unsplash License -- free to use,
no Unsplash+ / premium images) for each mock event, runs the project's own
SCRFD face detector on them to get REAL face boxes, and writes:

    frontend/public/demo/photos/<id>.jpg      ~1100px JPEGs
    frontend/public/demo/avatars/<id>.jpg     small portrait avatars
    frontend/src/app/data/demoPhotos.json     metadata + face boxes + credits

Run once (network required), from the project root, with the venv active:
    python scripts/build_demo_photos.py
Re-running skips files that already exist.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

PHOTO_DIR = ROOT / "frontend/public/demo/photos"
AVATAR_DIR = ROOT / "frontend/public/demo/avatars"
OUT_JSON = ROOT / "frontend/src/app/data/demoPhotos.json"

PER_EVENT = 20
PHOTO_WIDTH = 1100
MIN_FACE_PX = 26  # at PHOTO_WIDTH

# event key -> search queries (first ones preferred)
EVENT_QUERIES = {
    "wedding": ["indian wedding guests", "wedding reception guests", "wedding couple celebration", "wedding party friends"],
    "techfest": ["hackathon students", "students robotics competition", "college tech event students", "students coding"],
    "summit": ["business conference speaker", "conference audience", "business networking event", "panel discussion"],
    "collegefest": ["college festival students", "university students celebration", "students dancing festival"],
    "corporate": ["corporate team event", "business team celebration", "office team meeting"],
    "music": ["music festival crowd", "concert crowd friends", "festival friends"],
    "sports": ["football team celebration", "sports team huddle", "sports fans cheering", "basketball team"],
    "startup": ["startup pitch event", "tech meetup people", "startup team", "coworking people laptop"],
    "birthday": ["birthday party friends", "birthday celebration cake friends", "birthday party kids", "surprise party"],
    "party": ["rooftop party friends", "friends party celebration", "house party friends", "new year party"],
}
AVATAR_QUERIES = ["professional headshot portrait", "smiling person portrait"]
AVATARS = 12

UA = {"User-Agent": "curl/8.5.0", "Accept": "*/*"}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def download(url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            dest.write_bytes(r.read())
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  ! download failed {dest.name}: {e}")
        return False


def search(query: str, per_page: int = 30) -> list[dict]:
    q = urllib.parse.quote(query)
    data = get_json(f"https://unsplash.com/napi/search/photos?query={q}&per_page={per_page}")
    time.sleep(0.6)  # be polite
    return [r for r in data["results"] if not r.get("premium") and not r.get("plus")
            and r["urls"]["raw"].startswith("https://images.unsplash.com/")]


def sized(raw: str, w: int, extra: str = "") -> str:
    sep = "&" if "?" in raw else "?"
    return f"{raw}{sep}w={w}&q=68&fm=jpg&fit=max{extra}"


def main() -> None:
    from app.attendance.config import AttendanceConfig
    from app.attendance.detector import ScrfdDetector

    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    detector = ScrfdDetector(AttendanceConfig())

    used: set[str] = set()
    photos: list[dict] = []
    for event, queries in EVENT_QUERIES.items():
        kept = 0
        for query in queries:
            if kept >= PER_EVENT:
                break
            print(f"[{event}] searching: {query}")
            for r in search(query):
                if kept >= PER_EVENT:
                    break
                pid = r["id"]
                if pid in used:
                    continue
                dest = PHOTO_DIR / f"{pid}.jpg"
                if not download(sized(r["urls"]["raw"], PHOTO_WIDTH), dest):
                    continue
                img = cv2.imread(str(dest))
                if img is None:
                    dest.unlink(missing_ok=True)
                    continue
                h, w = img.shape[:2]
                faces = [f for f in detector.detect(img) if f.width_px >= MIN_FACE_PX and f.det_score >= 0.6]
                if not faces:
                    dest.unlink(missing_ok=True)  # every demo photo should have people in it
                    continue
                used.add(pid)
                kept += 1
                photos.append({
                    "id": pid,
                    "event": event,
                    "src": f"/demo/photos/{pid}.jpg",
                    "width": w,
                    "height": h,
                    "alt": (r.get("alt_description") or r.get("description") or "Event photo").strip().capitalize(),
                    "color": r.get("color") or "#1e293b",
                    "credit": {"name": r["user"]["name"], "url": r["user"]["links"]["html"]},
                    "faces": [
                        [round(float(f.bbox[0]) / w, 4), round(float(f.bbox[1]) / h, 4),
                         round(float(f.bbox[2]) / w, 4), round(float(f.bbox[3]) / h, 4)]
                        for f in faces
                    ],
                })
                print(f"  + {pid} {w}x{h} faces={len(faces)}")
        print(f"[{event}] kept {kept}")

    avatars: list[dict] = []
    for query in AVATAR_QUERIES:
        for r in search(query):
            if len(avatars) >= AVATARS:
                break
            pid = r["id"]
            if pid in used:
                continue
            dest = AVATAR_DIR / f"{pid}.jpg"
            if download(sized(r["urls"]["raw"], 160, "&h=160&fit=crop&crop=faces"), dest):
                used.add(pid)
                avatars.append({"id": pid, "src": f"/demo/avatars/{pid}.jpg",
                                "credit": {"name": r["user"]["name"], "url": r["user"]["links"]["html"]}})

    # Keep the demo to adults: face search shown on children is not a look we want.
    child = re.compile(r"\b(child|children|kid|kids|baby|toddler|boy|girl|little|infant)\b", re.I)
    for p in [p for p in photos if child.search(p["alt"])]:
        (ROOT / "frontend/public" / p["src"].lstrip("/")).unlink(missing_ok=True)
    photos = [p for p in photos if not child.search(p["alt"])]
    OUT_JSON.write_text(json.dumps({"photos": photos, "avatars": avatars}, separators=(",", ":")))
    total_kb = sum(p.stat().st_size for p in PHOTO_DIR.glob("*.jpg")) // 1024
    print(f"Wrote {len(photos)} photos ({total_kb} KB), {len(avatars)} avatars -> {OUT_JSON}")


if __name__ == "__main__":
    main()
