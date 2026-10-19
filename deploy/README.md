# Pi deployment

KeyStack runs as an appliance on a Raspberry Pi 5. This doc covers how to
develop against the real hardware and how to ship a build. For how the
services fit together, see [docs/architecture.md](../docs/architecture.md).

## Hardware & network

| | |
|---|---|
| SSH | Every script here reads the SSH target from `PI_HOST`, e.g. `export PI_HOST=pi` (a `Host pi` entry in `~/.ssh/config`) or the Pi's mDNS name, `export PI_HOST=emilianopolanco5@pekepi.local`, which keeps working when the Pi's IP changes. It logs in as the Pi's normal desktop user — no root access is needed |
| Screen | Freenove 5" 800x480 DSI touchscreen |
| Audio out | InnoMaker PCM5122 DAC HAT (ALSA card name `BossDAC`, device `hw:BossDAC,0`) into a PAM8403/PAM8406 amp |
| MIDI in | Novation Launchkey Mini MK4 37 over USB (ALSA seq client `Launchkey Mini MK4 37`, port `MIDI In`) |
| Synth | FluidSynth 2.4.4, soundfont `/usr/share/sounds/sf2/FluidR3_GM.sf2` |
| OS | Raspberry Pi OS (Debian 13 "trixie"), labwc Wayland desktop with auto-login |

## What runs on the Pi

Everything lives in the SSH user's home directory and runs as that user:

| | |
|---|---|
| `~/keystack/node/` | Node.js 22 (official linux-arm64 build) |
| `~/keystack/server/index.cjs` | The bundled server |
| `~/keystack/out/` | The static web export |
| `~/.config/systemd/user/` | `fluidsynth.service`, `keystack-server.service` |
| `~/.config/pipewire/pipewire.conf.d/10-keystack.conf` | Fixes PipeWire's clock at 48 kHz |
| `~/.config/wireplumber/wireplumber.conf.d/50-keystack-dac.conf` | Makes the DAC the default sink, never suspended, with a small hardware buffer |
| `~/keystack/kiosk.sh` | Opens the kiosk on a URL |
| `~/.config/labwc/autostart` | Runs `kiosk.sh` at desktop login |

| Service | What it does |
|---|---|
| `pipewire`, `wireplumber` | Raspberry Pi OS's own user services. PipeWire opens the DAC and mixes the piano with the kiosk's browser audio (the song player) |
| `fluidsynth.service` | The synth engine: ALSA sequencer in, PipeWire out. Independent of the server, so redeploying or crashing the server never stops the sound |
| `keystack-server.service` | Node: serves KeyStack's static build, the `/api` routes and `/ws` on port 3000, and keeps the keyboard routed to FluidSynth. `Wants=fluidsynth` (not `Requires=`), so it survives FluidSynth restarts |
| `keystack-kiosk` (transient) | Full-screen Chromium on `http://localhost:3000`, started by `~/keystack/kiosk.sh` — at desktop login via labwc's autostart, and again by every deploy |

Both services are systemd **user** units, so use `systemctl --user` and
`journalctl --user-unit`:

```bash
ssh $PI_HOST systemctl --user status fluidsynth keystack-server
ssh $PI_HOST journalctl --user-unit keystack-server -n 30
```

(`journalctl --user -u …` prints nothing on this OS; `--user-unit` is the
form that works.) Lingering is enabled for the user, so the services start
at boot, before the desktop logs in.

## First-time setup

Only needed once, on a fresh Pi:

```bash
./deploy/provision.sh
```

Downloads Node.js into `~/keystack/node` (checksum-verified), copies the
user units, `kiosk.sh` and the labwc autostart, enables lingering, then runs
`./deploy/audio.sh` (see [Audio](#audio)), which starts FluidSynth.

The one thing it can't do without root is install system packages. These
were already present on this Pi; on a fresh one, run on the Pi:

```bash
sudo apt-get install -y fluidsynth fluid-soundfont-gm alsa-utils chromium \
  pipewire pipewire-pulse wireplumber rtkit
```

`rtkit` was **not** installed on the current Pi. Without it PipeWire runs
without real-time priority, which is why the buffer is set to 256 frames
(see [Audio latency](#audio-latency)).

## Audio

PipeWire is the only process that opens the DAC. FluidSynth (`-a pipewire`)
and the kiosk's Chromium (the song player) are both its clients, so the
piano and a song play at the same time, each with its own volume.

```bash
./deploy/audio.sh
```

Installs `deploy/audio/` into `~/.config/pipewire` and
`~/.config/wireplumber`, installs the FluidSynth unit, stops anything
holding `hw:BossDAC,0`, restarts PipeWire and WirePlumber, sets PipeWire's
volume on the DAC to 100%, and starts FluidSynth. It's idempotent, and it's
how an existing Pi moves from the old direct-to-ALSA FluidSynth. Loudness
is still controlled by FluidSynth's gain (`-g 0.5`), the DAC's `Digital`
mixer control, and the amp.

Check it:

```bash
ssh $PI_HOST wpctl status        # Streams: FluidSynth (+ Chromium while a song plays) → Boss DAC
ssh $PI_HOST pw-top -b -n 3      # QUANT 256 at 48000; the ERR column counts xruns
```

### Audio latency

FluidSynth's `audio.period-size` becomes its PipeWire `node.latency`, which
sets the whole graph's quantum. Measured on this Pi without real-time
priority, over 30 s with a silent Chromium stream running alongside:

| Quantum | Per period | Idle | Chromium playing |
|---|---|---|---|
| 64 | 1.3 ms | xruns | xruns |
| 128 | 2.7 ms | clean | a few xruns |
| **256** (current) | 5.3 ms | clean | clean |

Chromium starting up still causes a few xruns at any size. The old
direct-ALSA setup used 64 frames x 2 periods. To get back toward that,
install RTKit (`sudo apt-get install -y rtkit`, then reboot), lower
`audio.period-size` in `deploy/systemd/fluidsynth.service`, run
`./deploy/audio.sh`, and watch the ERR column in `pw-top` while a song plays.

### Rolling back

The direct-ALSA unit is in git history; on the current Pi it was also saved
as `~/.config/systemd/user/fluidsynth.service.pre-pipewire.bak` before the
migration. To go back, run on the Pi:

```bash
cp ~/.config/systemd/user/fluidsynth.service.pre-pipewire.bak ~/.config/systemd/user/fluidsynth.service
rm ~/.config/pipewire/pipewire.conf.d/10-keystack.conf ~/.config/wireplumber/wireplumber.conf.d/50-keystack-dac.conf
systemctl --user daemon-reload && systemctl --user restart pipewire wireplumber fluidsynth
```

FluidSynth then holds the DAC again and the song player is silent.

## Everyday development

Set the SSH target once per shell: `export PI_HOST=pi`.

### 1. Real-time UI iteration (fastest — no build)

```bash
npm run pi:dev
```

Starts `next dev` on your Mac and points the Pi's kiosk at it
(`http://<your-mac-ip>:3000`). Fast Refresh pushes every saved change to the
physical screen. The page talks to the server **on the Pi**
(`NEXT_PUBLIC_API_BASE_URL=http://<pi-ip>:3000`), so it shows the real
keyboard/synth state, and the sound keeps working throughout.

Ctrl-C stops the dev server and puts the screen back on the deployed build.

- Port 3000 must be free on the Mac, and both machines on the same network.
- The Mac's IP is auto-detected from `en0`, the Pi's from your SSH config.
  Override either: `MAC_IP=x.x.x.x PI_IP=y.y.y.y npm run pi:dev`.
- The page and the API are on different origins in this mode, so `pi:dev`
  restarts the Pi's server with a temporary `CORS_ORIGIN` for your Mac (a
  systemd drop-in), and removes it again on Ctrl-C. The sound is unaffected.
- The power button really turns the Pi off in this mode too.
- This iterates on the frontend only. Server changes need `pi:deploy`.

### 2. Ship a build

```bash
npm run pi:deploy
```

Builds `packages/shared` → `apps/server` → `apps/web`, rsyncs the static
export, the server bundle and `kiosk.sh` to `~/keystack`, restarts
`keystack-server`, and reopens the kiosk on the new build. Restarting the
server does not interrupt the sound.

### Import release record (2026-10-19)

The approved Import release deployed the current SongStreamer source to the
server Pi as ARMv7 image `songstreamer:0.2.0`, digest
`sha256:74cccc013227ab696ffd4228ba3cad2bf76f877abf1fca123fef7aeb441a245e`.
The release archive is at
`/srv/keystack-data/songstreamer/releases/0.2.0/songstreamer-0.2.0.tar.gz`
with SHA-256
`4dedb76ee01176682b9c16fa37380439cb6642fbb3616ec8a1fbe61b555d5be7`. The
previous Compose/env files and `songstreamer:0.1.0` image remain available for
rollback. A pre-migration SQLite backup is retained on the server and in
`SongStreamer/.local-backups/`; the full record is in
`../../SongStreamer/docs/deployment-results.md` in the sibling SongStreamer
workspace.

The production container is healthy. Public `/health` and
`/api/v1/import/health` passed; public inspection returned All I Do metadata
with compatible native format 140 and did not create a production song. The
existing song's audio range returned `206 audio/mp4` with
`Content-Range: bytes 0-127/4961487`. The client Pi received the frontend
export only; its MIDI and local backend were preserved. The previous frontend
is at `~/keystack/releases/import-20261019/out.previous`, and the existing
`kiosk.sh` reload was run. Client UI, playback, and hardware acceptance remain
the user's responsibility.

## The kiosk

`~/keystack/kiosk.sh [url]` (source: `deploy/kiosk/kiosk.sh`) shows a URL
full-screen, replacing whatever the kiosk showed before; with no argument it
shows the deployed build. It waits for the URL to answer, then runs Chromium
as the transient user unit `keystack-kiosk` with its own profile
(`~/.config/keystack-kiosk`), so it never interferes with a normal Chromium
on the desktop. labwc's autostart, `pi:deploy` and `pi:dev` all go through
it.

```bash
ssh $PI_HOST keystack/kiosk.sh                        # show the deployed build
ssh $PI_HOST systemctl --user stop keystack-kiosk     # close it, back to the desktop
```

## Build output

`apps/web/next.config.ts` sets `output: "export"`, so building `apps/web`
produces a fully static site in `apps/web/out/`. `apps/server` builds to a
single self-contained bundle at `apps/server/dist/index.cjs`, so the Pi never
needs `npm install`.

## Troubleshooting

**No sound when playing.**
`journalctl --user-unit keystack-server -n 30` logs every state change
(keyboard connected/disconnected, synth detected/gone, route
established/failed), and `curl localhost:3000/api/status` shows the current
state. If the synth is "not running", check
`journalctl --user-unit fluidsynth` and `wpctl status`. If the only sink is
"Dummy Output", something else holds `hw:BossDAC,0` (usually a
`fluidsynth -a alsa` started by hand); stop it and run `./deploy/audio.sh`.

**Crackles or dropouts.**
`pw-top -b -n 3` on the Pi: a growing ERR column means xruns. Raise
`audio.period-size` in the FluidSynth unit, or install RTKit (see
[Audio latency](#audio-latency)).

**`fluidsynth: warning: Failed to set thread to high priority`.**
Expected without RTKit: the user has no realtime-priority allowance
(`ulimit -r` is 0). With the PipeWire driver, synthesis runs in PipeWire's
data thread, so what matters is PipeWire's priority: install `rtkit` (or
add `@audio - rtprio 95` and `@audio - memlock unlimited` in
`/etc/security/limits.d/`) and reboot.

**The kiosk doesn't appear.**
`journalctl --user-unit keystack-kiosk -n 30`. `kiosk.sh` waits up to a
minute for the URL to answer before opening it, so a server that isn't
running shows up as a delay followed by an error page.
