# Pi deployment

KeyStack runs as an appliance on a Raspberry Pi 5. This doc covers how to
develop against the real hardware and how to ship a build. For how the
services fit together, see [docs/architecture.md](../docs/architecture.md).

## Hardware & network

| | |
|---|---|
| SSH | Every script here reads the SSH target from `PI_HOST`, e.g. `export PI_HOST=pi` (a `Host pi` entry in `~/.ssh/config`). It logs in as the Pi's normal desktop user — no root access is needed |
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
| `~/keystack/kiosk.sh` | Opens the kiosk on a URL |
| `~/.config/labwc/autostart` | Runs `kiosk.sh` at desktop login |

| Service | What it does |
|---|---|
| `fluidsynth.service` | The synth engine: ALSA sequencer in, `hw:BossDAC,0` out. Independent of the server, so redeploying or crashing the server never stops the sound |
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
user units, `kiosk.sh` and the labwc autostart, enables lingering, and starts FluidSynth.
If a `fluidsynth` was started by hand it is stopped first, since it would be
holding the DAC.

The one thing it can't do without root is install system packages. These
were already present on this Pi; on a fresh one, run on the Pi:

```bash
sudo apt-get install -y fluidsynth fluid-soundfont-gm alsa-utils chromium
```

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
`journalctl --user-unit fluidsynth` — something else holding the DAC
(PipeWire, or a `fluidsynth` started by hand) is the usual suspect.

**`fluidsynth: warning: Failed to set thread to high priority`.**
Expected: the user has no realtime-priority allowance (`ulimit -r` is 0), so
FluidSynth runs at normal priority. If you hear crackles under load, grant it
on the Pi with a file in `/etc/security/limits.d/` (`@audio - rtprio 95`,
`@audio - memlock unlimited`) and reboot.

**The kiosk doesn't appear.**
`journalctl --user-unit keystack-kiosk -n 30`. `kiosk.sh` waits up to a
minute for the URL to answer before opening it, so a server that isn't
running shows up as a delay followed by an error page.
