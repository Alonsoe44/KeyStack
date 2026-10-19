#!/bin/bash
# Installs KeyStack's audio routing on the Pi: PipeWire owns the DAC, and
# FluidSynth (the piano) and Chromium (the song player) both play into it.
# Idempotent; run by provision.sh, and on its own to migrate a Pi that still
# has FluidSynth opening hw:BossDAC directly. No root needed.

set -euo pipefail

PI_HOST="${PI_HOST:?Set PI_HOST to the SSH target of the Pi, e.g. PI_HOST=pi}"

cd "$(dirname "$0")"

ssh "$PI_HOST" "mkdir -p .config/pipewire/pipewire.conf.d .config/wireplumber/wireplumber.conf.d .config/systemd/user"
scp audio/pipewire.conf.d/10-keystack.conf "$PI_HOST:.config/pipewire/pipewire.conf.d/"
scp audio/wireplumber.conf.d/50-keystack-dac.conf "$PI_HOST:.config/wireplumber/wireplumber.conf.d/"
scp systemd/fluidsynth.service "$PI_HOST:.config/systemd/user/"

ssh "$PI_HOST" '
  set -e
  systemctl --user daemon-reload
  # Release the DAC first (an old unit or a hand-started fluidsynth may hold
  # hw:BossDAC), so PipeWire can open it when it restarts.
  systemctl --user stop fluidsynth || true
  pkill -x fluidsynth || true
  systemctl --user enable --now pipewire.socket pipewire-pulse.socket wireplumber.service
  systemctl --user restart pipewire.service wireplumber.service
  # WirePlumber creates the DAC sink asynchronously.
  for _ in $(seq 20); do
    wpctl inspect @DEFAULT_AUDIO_SINK@ 2>/dev/null | grep -q "alsa_output" && break
    sleep 0.5
  done
  # PipeWire software volume at unity: loudness is set by FluidSynth gain,
  # the DAC Digital control and the amp. WirePlumber remembers this.
  wpctl set-volume @DEFAULT_AUDIO_SINK@ 1.0
  systemctl --user enable --now fluidsynth
  sleep 2
  wpctl status | sed -n "/^Audio/,/^Video/p"
'
