#!/usr/bin/env bash
# Puts Genesis Hub live on https://<this-machine>:9006, replacing the KailVarn
# AR test site on that port. Run once with sudo:
#   sudo bash deploy/install-genesis-hub-9006.sh
# Before running: build the site and publish the backend (see the end of this file).
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Run this with sudo: sudo bash deploy/install-genesis-hub-9006.sh" >&2; exit 1; }
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$DIR")"
[ -f "$ROOT/genisis_Hub/publish/genisis_Hub.dll" ] || { echo "Missing backend build: run 'dotnet publish -c Release -o publish' in genisis_Hub first." >&2; exit 1; }
[ -f "$ROOT/frontend/dist/index.html" ] || { echo "Missing website build: run 'npm run build' in frontend first." >&2; exit 1; }

echo "1/4 Taking the KailVarn AR test site off port 9006 (kept, just disabled)..."
if [ -f /etc/nginx/sites-enabled/kailvarn-ar-9006 ]; then
  mv /etc/nginx/sites-enabled/kailvarn-ar-9006 /etc/nginx/sites-available/kailvarn-ar-9006.disabled
fi

echo "2/4 Stopping hand-started dev servers on ports 5044 / 8002 (the services take over)..."
fuser -k 5044/tcp 8002/tcp 2>/dev/null || true
sleep 2

echo "3/4 Installing and starting the services..."
cp "$DIR/genesis-hub-face.service" "$DIR/genesis-hub-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now genesis-hub-face genesis-hub-backend

echo "4/4 Installing the nginx site on port 9006..."
cp "$DIR/genesis-hub-9006.nginx.conf" /etc/nginx/sites-available/genesis-hub-9006
ln -sf /etc/nginx/sites-available/genesis-hub-9006 /etc/nginx/sites-enabled/genesis-hub-9006
if ! nginx -t; then
  echo "nginx config test failed; putting KailVarn back." >&2
  rm -f /etc/nginx/sites-enabled/genesis-hub-9006
  mv /etc/nginx/sites-available/kailvarn-ar-9006.disabled /etc/nginx/sites-enabled/kailvarn-ar-9006 2>/dev/null || true
  exit 1
fi
systemctl reload nginx

echo -n "Waiting for the site"
for i in $(seq 60); do
  curl -sk -m 3 https://127.0.0.1:9006/api/health | grep -q '"faceEngine":"ok"' && break
  echo -n "."; sleep 2
done
echo
curl -sk https://127.0.0.1:9006/api/health; echo
echo
echo "Live on: https://$(hostname -I | awk '{print $1}'):9006/   (and https://localhost:9006/)"
echo "Logs:    sudo journalctl -u genesis-hub-backend -f   |   sudo journalctl -u genesis-hub-face -f"
echo "Undo:    sudo rm /etc/nginx/sites-enabled/genesis-hub-9006"
echo "         sudo mv /etc/nginx/sites-available/kailvarn-ar-9006.disabled /etc/nginx/sites-enabled/kailvarn-ar-9006"
echo "         sudo systemctl reload nginx"

# Updating later:
#   website only:  cd frontend && npm run build              (live at once, no restart)
#   backend code:  cd genisis_Hub && dotnet publish -c Release -o publish
#                  sudo systemctl restart genesis-hub-backend
