#!/usr/bin/env bash
# Start the face-search website (API + built frontend) on one port.
#
#   scripts/run_face_search.sh            # port 8002 (or $PORT)
#
# Serves https:// automatically if scripts/make_https_cert.sh has been run,
# so phones on the LAN get the live camera. Photos to search go in
# data/gallery/ (or $PHOTO_GALLERY_DIR) -- new files are picked up
# automatically every $GALLERY_RESCAN_INTERVAL_S seconds (default 60).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PY="${PYTHON:-$ROOT/.venv/bin/python}"
if [[ ! -x "$PY" ]]; then
  echo "No venv at $ROOT/.venv -- create it (see README 'Face search website'), or set PYTHON=/path/to/python" >&2
  exit 1
fi

# pip's CUDA 12/13 wheels ship their .so files inside site-packages/nvidia/*;
# onnxruntime-gpu needs them on the loader path to use the GPU.
SITE="$("$PY" -c 'import site; print(site.getsitepackages()[0])')"
for d in "$SITE"/nvidia/*/lib; do
  [[ -d "$d" ]] && LD_LIBRARY_PATH="$d:${LD_LIBRARY_PATH:-}"
done
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-}"

if [[ ! -d frontend/dist ]]; then
  echo "Building frontend..."
  (cd frontend && npm install && npm run build)
fi

# 8002, not 8001: 8001 is the attendance backend (deploy/nginx-attendance-9003.conf).
PORT="${PORT:-8002}"
SSL_ARGS=()
SCHEME=http
if [[ -f data/certs/cert.pem && -f data/certs/key.pem ]]; then
  SSL_ARGS=(--ssl-certfile data/certs/cert.pem --ssl-keyfile data/certs/key.pem)
  SCHEME=https
fi

echo "FaceFetch starting on $SCHEME://0.0.0.0:$PORT"
for ip in $(hostname -I 2>/dev/null); do
  [[ "$ip" == *:* ]] || echo "  open on your phone: $SCHEME://$ip:$PORT"
done
[[ $SCHEME == http ]] && echo "  (live camera on phones needs https -- run scripts/make_https_cert.sh first)"

exec "$PY" -m uvicorn app.web.face_search_server:app --host 0.0.0.0 --port "$PORT" "${SSL_ARGS[@]}"
