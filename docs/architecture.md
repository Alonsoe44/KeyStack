# KeyStack architecture

KeyStack is an appliance: power on the Pi and it boots straight into a
playable piano with a touchscreen UI. This doc covers how the pieces fit
together. For provisioning and shipping builds see
[deploy/README.md](../deploy/README.md); for UI tokens see
[design-system.md](design-system.md).

## Hardware and system environment

| Item | Value |
|---|---|
| Board | Raspberry Pi 5, Raspberry Pi OS (Debian 13 "trixie"), labwc Wayland desktop, auto-login as the normal user |
| Audio out | InnoMaker PCM5122 DAC HAT — ALSA card name **`BossDAC`**, device `hw:BossDAC,0` |
| Amplifier / speakers | Class D PAM8403/PAM8406 (5V) into 2x 4Ω / 3W |
| Keyboard | Novation **Launchkey Mini MK4 37** (USB, class-compliant) |
| Keyboard ALSA seq client | `'Launchkey Mini MK4 37'` — port `0 '… MIDI In'` is the playable one; port `1 '… DAW In'` is ignored |
| Synth engine | FluidSynth 2.4.4 — ALSA seq client `'FLUID Synth (<pid>)'`, port 0 |
| Soundfont | `/usr/share/sounds/sf2/FluidR3_GM.sf2` |
| Screen | Freenove 5" MIPI DSI, 800x480, touch |
| Status indicator | WS2812 RGB LED module (not driven by software yet) |
| Power | USB-C power bank (22.5W max), feeds the Pi and amp off the 5V rail |

Facts about this environment that the design depends on:

- **ALSA client numbers are not stable.** FluidSynth gets a new client id on
  every start, the keyboard can get a new one on replug, and card numbers can
  shuffle at boot. Everything is matched **by name**, never by number.
- **ALSA sequencer subscriptions live in the kernel.** Once created, MIDI
  flows keyboard → FluidSynth with no userspace process in between. The
  subscription disappears when either end goes away, so it has to be
  re-created.
- **PipeWire is installed** and may grab the DAC before FluidSynth does.
  KeyStack doesn't manage PipeWire.

## Signal path and processes

```
Launchkey ──USB──► ALSA sequencer ──────► FluidSynth ──► ALSA PCM ──► BossDAC ──► amp   [real-time, no JS]
                        ▲                (fluidsynth.service)
                        │ creates the subscription (aconnect)
                        │
                 apps/server  (keystack-server.service — Node + Express + ws)
                        │ REST + WebSocket, serves apps/web's static export
                        ▼
                 apps/web  (keystack-kiosk — Chromium --kiosk)
```

Three processes, each replaceable without the others. FluidSynth and the
server are systemd **user** units (`systemctl --user`), so nothing on the Pi
runs as root and deploying needs no sudo; lingering is enabled so they start
at boot rather than at login. The kiosk needs the desktop session, so labwc's
autostart launches it at login; deploys relaunch it.

| Service | Role | If it dies |
|---|---|---|
| `fluidsynth.service` | Turns MIDI into audio | No sound until systemd restarts it (2s); the server then re-creates the route to the new client id |
| `keystack-server.service` | Wires keyboard → synth, owns state, serves the UI and API | **Sound keeps playing** — the route is in the kernel. On restart it finds the existing route and leaves it alone |
| `keystack-kiosk` (transient unit, started by `~/keystack/kiosk.sh`) | Waits for the server, then displays the UI | Nothing audible; restarted if it crashes, and re-fetches state |

## Principles

1. **JavaScript is never on the real-time audio path.** The Node backend only
   creates the wiring, tracks state, and talks to the UI.
2. **Separate processes.** The synth and the server are managed by systemd. `keystack-server` declares
   `Wants=fluidsynth.service`, not `Requires=`, so neither restart takes the
   other down.
3. **The backend is the source of truth.** The frontend fetches the current
   state, then follows pushed events. It holds no state of its own that a
   reload could lose.
4. **Hexagonal architecture.** Domain logic doesn't know about `aconnect`,
   Express, or WebSockets; adapters are swappable.
5. **Reconciliation over event-catching.** Hot-plug is handled by a loop that
   compares desired state with actual state, rather than by trying to catch
   every plug/unplug event. It is idempotent and self-healing.

## Repository

npm workspaces monorepo:

```
apps/
  server/     Node + TypeScript + Express + ws (bundled to dist/index.cjs)
  web/        Next.js static export — the kiosk UI
packages/
  shared/     Types shared by server and web: DTOs and pushed events
deploy/       systemd user units, labwc kiosk autostart, provision/sync scripts
```

`packages/shared` is the compile-time contract between the two apps. The
MIDI types are in `packages/shared/src/midi.ts`:

```ts
type MidiConnectionStatus = {
  keyboard: { present: boolean; name?: string }
  synth: { present: boolean; name?: string }
  routed: boolean        // keyboard MIDI In → synth port 0 subscription exists
  lastChangedAt: string  // ISO timestamp
}

type KeyStackEvent =
  | { type: "midi.status"; status: MidiConnectionStatus }
  | { type: "midi.keyboard.connected"; name: string }
  | { type: "midi.keyboard.disconnected" }
  | { type: "midi.route.established" }
  | { type: "midi.route.failed"; reason: string }
```

## Backend (`apps/server`)

```
src/
  domain/midi-connection/
    types.ts          SeqClient, SeqPort, SeqAddress
    matching.ts       pure: find keyboard port, find synth port, isRouted
    reconciler.ts     MidiConnectionReconciler — the core logic, ports only
  ports/
    SequencerPort.ts        list clients, connect
    EventPublisherPort.ts   publish a KeyStackEvent
    ClockPort.ts            now + schedule (so tests control time)
    LoggerPort.ts           info / warn / error
    SystemPowerPort.ts      power the machine off
  adapters/
    alsa/AconnectSequencerAdapter.ts   SequencerPort via the `aconnect` CLI
    alsa/parseAconnectList.ts          pure parser for `aconnect -l`
    system/SystemctlPowerAdapter.ts    SystemPowerPort via `systemctl poweroff`
    ws/WebSocketEventPublisher.ts      EventPublisherPort, broadcasts to clients
    http/statusRoutes.ts               GET /api/status, /api/health
    http/systemRoutes.ts               POST /api/system/poweroff
  config.ts           env-based config, validated at startup
  main.ts             composition root
```

### The reconciler

Desired state: *if a keyboard and a synth matching the config are both
present, the keyboard's MIDI In port is subscribed to the synth's port 0.*

Every `POLL_INTERVAL_MS`:

1. List sequencer clients (`aconnect -l`).
2. Keyboard port = first port whose client name starts with
   `KEYBOARD_CLIENT_PREFIX` and whose port name contains
   `KEYBOARD_PORT_MATCH`. Matching on the port name is what skips "DAW In".
3. Synth port = port 0 of the first client whose name starts with
   `SYNTH_CLIENT_PREFIX`.
4. If both exist and the keyboard port isn't already connected to the synth
   port, run `aconnect <keyboard> <synth>`.
5. If the resulting status differs from the previous one, store it and
   publish a full `midi.status` snapshot plus the specific events.

Properties:

- **No overlapping ticks** — the next tick is scheduled only after the
  current one finishes.
- **Never throws out of the loop** — a failing `aconnect -l` or `connect` is
  logged and retried on the next tick.
- **Idempotent** — a tick with nothing to do connects nothing and publishes
  nothing.
- **Quiet on repeated failures** — an identical error is logged, and
  `midi.route.failed` published, once rather than twice a second. The retry
  itself still happens every tick.
- **Timeouts** — every `aconnect` call is an `execFile` (no shell) with
  `ACONNECT_TIMEOUT_MS`.

Cases this one loop covers: keyboard unplugged and replugged, FluidSynth
restarted with a new client id, server restarted while a route already
exists, keyboard without synth, synth without keyboard.

### API

HTTP and WebSocket share one server on `PORT`, which also serves the static
frontend from `STATIC_DIR`.

| | |
|---|---|
| `GET /api/status` | `{ midi: MidiConnectionStatus }` |
| `GET /api/health` | `{ ok: true }` |
| `POST /api/system/poweroff` | Shuts the Pi down (`systemctl poweroff`). Returns `{ ok: true }`, or `{ ok: false, error }` |
| WebSocket `/ws` | Sends a `midi.status` snapshot on connect, then broadcasts every `KeyStackEvent` as JSON |

A full snapshot accompanies every change, so a client that missed an event
still converges on the right state.

The power-off route only accepts `Content-Type: application/json`. Browsers
can't send that cross-origin without a CORS preflight, which the server
refuses, so a web page open on another device on the network can't switch
the Pi off. No sudo is involved: logind lets the user of the active desktop
session power off.

Not implemented yet: `POST /api/instruments/select`, which the
`/instruments` page already calls.

### Configuration

Environment variables, validated at startup — the server exits with a clear
message on an invalid value.

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP/WS port (`npm run dev:server` uses 4000) |
| `STATIC_DIR` | `../web/out` | Static frontend to serve |
| `KEYBOARD_CLIENT_PREFIX` | `Launchkey` | Keyboard client name prefix |
| `KEYBOARD_PORT_MATCH` | `MIDI In` | Substring identifying the playable port |
| `SYNTH_CLIENT_PREFIX` | `FLUID Synth` | Synth client name prefix |
| `POLL_INTERVAL_MS` | `500` | Reconcile interval |
| `ACONNECT_TIMEOUT_MS` | `2000` | Timeout per `aconnect` call |
| `CORS_ORIGIN` | unset | `Access-Control-Allow-Origin` for `/api`; only needed in dev, where `next dev` is a different origin |

To use a different keyboard, set `KEYBOARD_CLIENT_PREFIX` and
`KEYBOARD_PORT_MATCH` to match its names in `aconnect -l`.

## Frontend (`apps/web`)

A static Next.js export; it has no server-side code of its own. Feature
modules under `app/modules/` use the same layering as the backend, in
lighter form:

- `midi-connection/` — `adapters/midi-status-client.ts` does
  `GET /api/status`, then opens `/ws` and follows `midi.status` snapshots,
  reconnecting with backoff (0.5s doubling to 5s) and re-fetching on each
  attempt. `components/MidiStatusPanel.tsx` shows keyboard / synth / route on
  the home page.
- `system-power/` — the power button on the home page. It opens a
  confirmation dialog (`components/ui/alert-dialog.tsx`) and, on confirm,
  calls `POST /api/system/poweroff`.
- `basic-piano-instruments/` — the instrument picker (`core/`, `adapters/`,
  `components/`).

The scale trainer, fingering table and metronome run entirely in the
browser.

## Testing

`npm test` runs the server's Vitest suite, none of which touches ALSA:

- **Parser** — real `aconnect -l` output from the device (unrouted and
  routed fixtures), plus empty output, unknown lines, connection suffixes
  like `[real:0]`, padded port names.
- **Matching** — keyboard / synth / route detection, including ignoring the
  DAW In port.
- **Reconciler** — an in-memory fake `SequencerPort`, a spy publisher and a
  fake clock, covering each case listed above plus `connect` and
  `listClients` failures.

## Not built yet

- Instrument presets and volume (FluidSynth's TCP shell is already exposed
  on port 9800; volume would go through the ALSA mixer on `BossDAC`)
- A native ALSA binding or udev triggers in place of polling `aconnect`
- Other engines behind a `SoundEngine` port (sfizz, Pianoteq)
- PipeWire handling
- Reading MIDI notes in the backend for UI features such as chord detection
- Driving the WS2812 status LED
