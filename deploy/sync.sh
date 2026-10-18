#!/bin/bash
# Build KeyStack (shared -> server -> web) and deploy both the static web
# export and the bundled server to the Pi.
# Run ./deploy/provision.sh once first, on a fresh Pi, before using this.

set -euo pipefail

PI_HOST="${PI_HOST:?Set PI_HOST to the SSH target of the Pi, e.g. PI_HOST=pi}"
# Relative to the SSH user's home directory.
PI_DIR="keystack"

cd "$(dirname "$0")/.."

npm run build

rsync -avz --delete ./apps/web/out/ "$PI_HOST:$PI_DIR/out/" &&
rsync -avz ./apps/server/dist/index.cjs "$PI_HOST:$PI_DIR/server/index.cjs" &&
rsync -avz ./deploy/kiosk/kiosk.sh "$PI_HOST:$PI_DIR/kiosk.sh" &&
# Restarting the server never interrupts the sound: the keyboard -> synth
# route lives in the kernel, and fluidsynth is a separate service.
ssh "$PI_HOST" "
  systemctl --user restart keystack-server &&
  # (Re)opens the kiosk on the fresh build, once the server answers.
  keystack/kiosk.sh &&
  systemctl --user status fluidsynth keystack-server keystack-kiosk --no-pager
"
