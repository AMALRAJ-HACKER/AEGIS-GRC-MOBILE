#!/usr/bin/env bash
# One-command dev server: free Cloudflare tunnel (replaces ngrok) + shell export
# sync + QR codes + Metro.
#   ./start-dev.sh
# Safe to run from ANY state: if the Cloudflare URL has died server-side or Metro
# is running with a stale URL, both are detected and restarted automatically.
# Then scan EXPO-QR-CLOUDFLARE.png in Expo Go (works from any network).
set -e
cd "$(dirname "$0")"

# SDK 58 requires Node >= 22.13; prefer the local install when present.
if [ -d "$HOME/.local/node22/bin" ]; then
  export PATH="$HOME/.local/node22/bin:$PATH"
fi

CF=~/.local/bin/cloudflared
LOG=.cf-tunnel.log
mkdir -p /tmp/opencode

# Cloudflare kills idle quick tunnels server-side ("Unauthorized: Tunnel not
# found") while cloudflared keeps retrying forever. A live process therefore
# does NOT mean a live URL — probe the URL itself.
# Any HTTP status (even 5xx from a dead origin) means the tunnel is alive;
# 000 means DNS/connection failure, i.e. the URL is dead.
tunnel_alive() {
  local code=""
  for _ in 1 2 3; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$1/" 2>/dev/null || true)
    [ -n "$code" ] && [ "$code" != "000" ] && return 0
    sleep 2
  done
  return 1
}

# 1) tunnel — reuse if already running, otherwise start a fresh quick tunnel
URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
if ! pgrep -f "cloudflared tunnel" >/dev/null || [ -z "$URL" ] || ! tunnel_alive "$URL"; then
  if [ -n "$URL" ] && pgrep -f "cloudflared tunnel" >/dev/null; then
    echo "Tunnel $URL is unreachable — starting a fresh one"
  fi
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  sleep 1
  rm -f "$LOG"
  # Force HTTP/2 over TCP 443: this network drops egress UDP 7844, which makes
  # the default QUIC protocol flap and phones get Cloudflare error 1033.
  nohup "$CF" tunnel --url http://127.0.0.1:8081 --protocol http2 > "$LOG" 2>&1 &
  URL=""
  for i in $(seq 1 30); do
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
    [ -n "$URL" ] && break
    sleep 1
  done
fi
[ -z "$URL" ] && { echo "tunnel failed to start — see $LOG"; exit 1; }
echo "Tunnel: $URL"

# Keep the shell export in sync: Expo only reads EXPO_PACKAGER_PROXY_URL from
# the ORIGINAL shell environment (it ignores .env for security), so refresh
# the guarded block in the shell rc files whenever the tunnel URL changes.
BLOCK="# >>> aegis-grc dev tunnel >>>
export EXPO_PACKAGER_PROXY_URL=\"$URL\"
# <<< aegis-grc dev tunnel <<<"
for rc in "$HOME/.bashrc" "$HOME/.profile" "$HOME/.zshrc"; do
  [ -f "$rc" ] || continue
  if grep -q "aegis-grc dev tunnel" "$rc"; then
    awk -v url="$URL" '/aegis-grc dev tunnel >>>/{print "# >>> aegis-grc dev tunnel >>>"; print "export EXPO_PACKAGER_PROXY_URL=\"" url "\""; print "# <<< aegis-grc dev tunnel <<<"; skip=1; next} /aegis-grc dev tunnel <<</{skip=0; next} !skip' "$rc" > "$rc.tmp" && mv "$rc.tmp" "$rc"
  else
    printf '\n%s\n' "$BLOCK" >> "$rc"
  fi
done
echo "Shell export synced: $URL"

# 2) metro — MUST run with this tunnel URL in its environment, otherwise the
# manifest embeds a stale/dead URL (or leaks :8081) and Expo Go shows
# "Something went wrong". Restart it if its environment doesn't match.
metro_proxy_url() {
  local pid val
  for pid in $(pgrep -f "node_modules/.bin/exp[o]" 2>/dev/null || true); do
    val=$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | sed -n 's/^EXPO_PACKAGER_PROXY_URL=//p' || true)
    [ -n "$val" ] && { echo "$val"; return 0; }
  done
  return 0
}
METRO_PID=$(pgrep -f "node_modules/.bin/exp[o]" 2>/dev/null | head -1 || true)
METRO_URL=$(metro_proxy_url)
if [ -n "$METRO_PID" ] && curl -sf -o /dev/null http://127.0.0.1:8081/status && [ "$METRO_URL" = "$URL" ]; then
  echo "Metro already running with the current tunnel URL"
else
  if [ -n "$METRO_PID" ] || curl -sf -o /dev/null http://127.0.0.1:8081/status; then
    echo "Stopping stale Metro (proxy URL: ${METRO_URL:-none})"
    for P in $(pgrep -f "node_modules/.bin/exp[o]" 2>/dev/null || true; pgrep -f "npm exec exp[o]" 2>/dev/null || true; pgrep -f "sh -c exp[o]" 2>/dev/null || true); do kill $P 2>/dev/null || true; done
    sleep 2
  fi
  EXPO_PACKAGER_PROXY_URL="$URL" nohup npx expo start --port 8081 > /tmp/opencode/expo-lan.log 2>&1 &
  for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:8081/status && break; sleep 1; done
  echo "Metro started"
fi

# 3) QR codes
./make-qr.sh
echo
echo "Scan EXPO-QR-CLOUDFLARE.png in Expo Go (any network) or EXPO-QR-LAN.png (same Wi-Fi)."
