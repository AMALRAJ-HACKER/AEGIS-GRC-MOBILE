#!/usr/bin/env bash
# Regenerate Expo Go QR codes for this project's dev server.
# - EXPO-QR-LAN.png        -> LAN URL (same Wi-Fi only; blocked by firewall on this network)
# - EXPO-QR-CLOUDFLARE.png -> Cloudflare tunnel URL (works from ANY network)
# Run it whenever the tunnel restarts (URL changes), then re-scan the PNG.
set -e
cd "$(dirname "$0")"

IP=$(hostname -I | awk '{print $1}')
python3 -c "
import qrcode
if '$IP':
    qrcode.make('exp://$IP:8081', box_size=12, border=4).save('EXPO-QR-LAN.png')
    print('EXPO-QR-LAN.png -> exp://$IP:8081 (same Wi-Fi only)')
"

# Cloudflare quick tunnel (started by ./start-dev.sh) — no account, no session limits
CFTUN=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' .cf-tunnel.log 2>/dev/null | head -1 | sed 's|https://||')
if [ -n "$CFTUN" ] && pgrep -f "cloudflared tunnel" >/dev/null; then
  python3 -c "
import qrcode
qrcode.make('exp://$CFTUN', box_size=12, border=4).save('EXPO-QR-CLOUDFLARE.png')
print('EXPO-QR-CLOUDFLARE.png -> exp://$CFTUN (works from ANY network)')
"
else
  echo "No active cloudflare tunnel — run ./start-dev.sh to enable it."
fi
