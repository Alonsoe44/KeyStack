#!/bin/bash
# Runs ON the Pi (installed as ~/keystack/kiosk.sh). Shows a URL full-screen
# on the Pi's display, replacing whatever the kiosk was showing before.
#
#   kiosk.sh                          the deployed build (http://localhost:3000)
#   kiosk.sh http://192.168.1.137:3000   e.g. a dev server on another machine
#
# Chromium runs as the transient user unit `keystack-kiosk`, with its own
# profile, so it never touches a normal Chromium session on the desktop.
# Close it with: systemctl --user stop keystack-kiosk

set -euo pipefail

URL="${1:-http://localhost:3000}"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Wait for the page to be reachable (the server at boot, a dev server that is
# still compiling) so the kiosk never opens on a connection error.
for _ in $(seq 60); do
  curl -sf -o /dev/null --max-time 2 "$URL" && break
  sleep 1
done

systemctl --user stop keystack-kiosk 2>/dev/null || true
systemctl --user reset-failed keystack-kiosk 2>/dev/null || true

systemd-run --user --unit=keystack-kiosk --collect --quiet \
  -E WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" \
  -p Restart=on-failure \
  chromium --kiosk --user-data-dir="$HOME/.config/keystack-kiosk" \
  --no-first-run --noerrdialogs --disable-infobars --password-store=basic \
  "$URL"
