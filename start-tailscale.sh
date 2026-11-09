#!/usr/bin/env bash
# Start (or stop) the Expo dev server for access over Tailscale.
# Works when the phones and the laptop are on different networks
# (no cable, no Cloudflare tunnel).
#
#   ./start-tailscale.sh          start Metro + Tailscale + QR
#   ./start-tailscale.sh --stop   stop Metro
set -u
cd "$(dirname "$0")" || exit 1

# SDK 58 requires Node >= 22.13; prefer the local install when present.
if [ -d "$HOME/.local/node22/bin" ]; then
  export PATH="$HOME/.local/node22/bin:$PATH"
fi

PORT=8081
QR="EXPO-QR-TAILSCALE.png"
LOG="/tmp/opencode/expo-tailscale.log"
mkdir -p /tmp/opencode

stop_metro() {
  for pat in "node_modules/.bin/exp[o]" "npm exec exp[o]" "sh -c exp[o]"; do
    for p in $(pgrep -f "$pat" 2>/dev/null); do kill "$p" 2>/dev/null; done
  done
  sleep 1
}

if [ "${1:-}" = "--stop" ]; then
  stop_metro
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/status"; then
    echo "WARNING: Metro still answering on port $PORT"
    exit 1
  fi
  echo "Metro stopped (port $PORT free)."
  exit 0
fi

# --- 1. Tailscale must be connected on the laptop -------------------------
if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not installed."
  exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale daemon is not running."
  echo "Start it with:  sudo systemctl start tailscaled"
  exit 1
fi

if tailscale status 2>/dev/null | head -1 | grep -q "offline"; then
  echo "Tailscale is offline — connecting..."
  tailscale up >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do
    tailscale status 2>/dev/null | head -1 | grep -q "offline" || break
    sleep 1
  done
fi

TSIP=$(tailscale ip -4 2>/dev/null | head -1)
if [ -z "$TSIP" ]; then
  echo "No Tailscale IPv4 address found."
  exit 1
fi
echo "Tailscale IP: $TSIP"

# --- 2. Metro in Tailscale mode ------------------------------------------
stop_metro

echo "Starting Metro (minified bundle) on $TSIP:$PORT ..."
EXPO_PACKAGER_PROXY_URL="http://$TSIP:$PORT" \
  nohup npx expo start --no-dev --minify --port "$PORT" > "$LOG" 2>&1 &

for _ in $(seq 1 90); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/status" && break
  sleep 1
done

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/status"; then
  echo "Metro failed to start. Last log lines:"
  tail -20 "$LOG"
  exit 1
fi

# --- 3. Verify what the phone will be told, then make the QR --------------
URL=$(curl -s -H 'expo-platform: android' \
  -H 'Accept: application/expo+json,application/json' \
  --max-time 30 "http://127.0.0.1:$PORT/" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['launchAsset']['url'])" 2>/dev/null)

case "$URL" in
  "http://$TSIP:$PORT/"*) echo "Manifest OK: advertises $TSIP:$PORT" ;;
  *) echo "WARNING: manifest does not point at $TSIP"; echo "  $URL" ;;
esac

python3 - "$TSIP" "$PORT" "$QR" <<'PY'
import sys, qrcode
ip, port, out = sys.argv[1], sys.argv[2], sys.argv[3]
qrcode.make(f"exp://{ip}:{port}", box_size=12, border=4).save(out)
print(f"QR: {out}  ->  exp://{ip}:{port}")
PY

cat <<TXT

Metro is running.  Log: $LOG

On each phone:
  1. Tailscale ON (same account: mrscriptkiddieraj@)
  2. Force-quit Expo Go, then scan $QR
     (or "Enter URL manually": exp://$TSIP:$PORT)

Stop the server with:  ./start-tailscale.sh --stop
TXT
