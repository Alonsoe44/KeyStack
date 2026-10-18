#!/bin/bash
# Real-time UI iteration on the actual hardware: runs `next dev` on THIS
# machine and points the Pi's kiosk at it. Edit and save — Fast Refresh
# updates the physical screen. No build, no rsync.
#
# The page talks to the server running on the Pi, so it shows the real
# keyboard/synth state. Ctrl-C stops the dev server and puts the Pi's screen
# back on the deployed build.

set -euo pipefail

PI_HOST="${PI_HOST:?Set PI_HOST to the SSH target of the Pi, e.g. PI_HOST=pi}"
MAC_IP="${MAC_IP:-$(ipconfig getifaddr en0)}"
# The address the Pi's own server is reachable at, from the SSH config.
PI_IP="${PI_IP:-$(ssh -G "$PI_HOST" | awk '$1 == "hostname" { print $2 }')}"

if [ -z "$MAC_IP" ]; then
  echo "Could not detect this Mac's LAN IP. Pass it manually: MAC_IP=x.x.x.x npm run pi:dev"
  exit 1
fi

cd "$(dirname "$0")/.."

# While developing, the page (served by this Mac) calls the API on the Pi, a
# different origin. A temporary drop-in lets the Pi's server accept that.
# Restarting the server does not interrupt the sound.
DROPIN=".config/systemd/user/keystack-server.service.d/dev-cors.conf"

restore() {
  echo "Putting the Pi's screen back on the deployed build..."
  ssh "$PI_HOST" "
    rm -f $DROPIN
    systemctl --user daemon-reload
    systemctl --user restart keystack-server
    keystack/kiosk.sh
  " || true
}
trap restore EXIT

ssh "$PI_HOST" "
  mkdir -p \$(dirname $DROPIN)
  printf '[Service]\nEnvironment=CORS_ORIGIN=http://$MAC_IP:3000\n' > $DROPIN
  systemctl --user daemon-reload
  systemctl --user restart keystack-server
"

# kiosk.sh waits until the dev server answers before opening the page.
echo "Pi kiosk -> http://$MAC_IP:3000 (API: http://$PI_IP:3000)"
ssh "$PI_HOST" keystack/kiosk.sh "http://$MAC_IP:3000" &

NEXT_PUBLIC_API_BASE_URL="http://$PI_IP:3000" DEV_ORIGIN="$MAC_IP" \
  npm run dev:lan
