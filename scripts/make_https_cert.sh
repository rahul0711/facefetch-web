#!/usr/bin/env bash
# Generate a self-signed HTTPS certificate for the face-search website.
#
# Why: browsers only allow live camera access (getUserMedia) on https:// or
# localhost. A phone opening http://<server-ip>:8001 cannot use the live
# camera (the "Phone camera app" and upload options still work).
#
# The cert covers localhost plus every IPv4 address of this machine. Phones
# will show a one-time "connection not private" warning for a self-signed
# cert -- tap Advanced -> Proceed. For a public deployment use a real
# certificate (e.g. Let's Encrypt behind nginx) instead.
#
# Usage: scripts/make_https_cert.sh [extra-hostname-or-ip ...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/data/certs"
mkdir -p "$OUT"

SAN="DNS:localhost,IP:127.0.0.1"
for ip in $(hostname -I 2>/dev/null); do
  [[ "$ip" == *:* ]] && continue  # skip IPv6
  SAN="$SAN,IP:$ip"
done
for extra in "$@"; do
  if [[ "$extra" =~ ^[0-9.]+$ ]]; then SAN="$SAN,IP:$extra"; else SAN="$SAN,DNS:$extra"; fi
done

openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$OUT/key.pem" -out "$OUT/cert.pem" \
  -subj "/CN=FaceFetch local" \
  -addext "subjectAltName=$SAN" 2>/dev/null
chmod 600 "$OUT/key.pem"

echo "Wrote $OUT/cert.pem and key.pem"
echo "Valid for: $SAN"
