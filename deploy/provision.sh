#!/bin/bash
# One-time setup on a fresh Pi, with no root access needed: installs Node.js
# into ~/keystack/node, installs the systemd user units and the labwc kiosk
# autostart, sets up PipeWire as the owner of the DAC (deploy/audio.sh), and
# starts FluidSynth. Run ./deploy/sync.sh afterwards (and on
# every subsequent code change) to actually ship the built app.
#
# FluidSynth, aconnect (alsa-utils), Chromium, PipeWire, RTKit and the
# FluidR3_GM soundfont must already be installed — that is the one step that
# needs sudo:
#   sudo apt-get install -y fluidsynth fluid-soundfont-gm alsa-utils chromium \
#     pipewire pipewire-pulse wireplumber rtkit

set -euo pipefail

PI_HOST="${PI_HOST:?Set PI_HOST to the SSH target of the Pi, e.g. PI_HOST=pi}"
NODE_MAJOR=22

cd "$(dirname "$0")"

ssh "$PI_HOST" "mkdir -p keystack/out keystack/server .config/systemd/user .config/labwc"

# Official Node.js build, checksum-verified. Debian's own package would need root.
ssh "$PI_HOST" "NODE_MAJOR=$NODE_MAJOR bash -s" <<'REMOTE'
set -euo pipefail
if [ -x ~/keystack/node/bin/node ]; then
  echo "Node.js already installed: $(~/keystack/node/bin/node -v)"
  exit 0
fi
base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
curl -fsSLO "$base/SHASUMS256.txt"
file="$(grep -o 'node-v[0-9.]*-linux-arm64\.tar\.xz' SHASUMS256.txt | head -1)"
curl -fsSLO "$base/$file"
grep " $file\$" SHASUMS256.txt | sha256sum -c -
mkdir -p ~/keystack/node
tar -xJf "$file" -C ~/keystack/node --strip-components=1
echo "Installed Node.js $(~/keystack/node/bin/node -v)"
REMOTE

scp systemd/keystack-server.service "$PI_HOST:.config/systemd/user/"
scp kiosk/labwc-autostart "$PI_HOST:.config/labwc/autostart"
scp kiosk/kiosk.sh "$PI_HOST:keystack/kiosk.sh"

ssh "$PI_HOST" '
  # Lets the services start at boot instead of at desktop login. Not fatal:
  # the Pi auto-logs in, which starts them too.
  loginctl enable-linger 2>/dev/null || echo "note: could not enable linger; services will start at login"
  systemctl --user daemon-reload
  systemctl --user enable keystack-server
'

# PipeWire config, the FluidSynth unit, and (re)starting the audio services.
./audio.sh

echo "Provisioned. Run ./deploy/sync.sh to build and deploy the app."
