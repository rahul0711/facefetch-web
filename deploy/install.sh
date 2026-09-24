#!/usr/bin/env bash
# Installs the attendance backend as a systemd service and adds an nginx
# site on port 9003 in front of it. Run with sudo from anywhere:
#   sudo bash deploy/install.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Run this with sudo: sudo bash deploy/install.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing systemd service..."
cp "$SCRIPT_DIR/attendance-backend.service" /etc/systemd/system/attendance-backend.service
systemctl daemon-reload
systemctl enable --now attendance-backend

echo "Installing nginx site (port 9003)..."
cp "$SCRIPT_DIR/nginx-attendance-9003.conf" /etc/nginx/sites-available/attendance-9003
ln -sf /etc/nginx/sites-available/attendance-9003 /etc/nginx/sites-enabled/attendance-9003
nginx -t
systemctl reload nginx

echo
echo "Done. Backend status:"
systemctl --no-pager status attendance-backend | head -8
echo
echo "Dashboard: http://<this-machine's-LAN-IP>:9003/"
echo "Logs:      sudo journalctl -u attendance-backend -f"
