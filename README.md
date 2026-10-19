# KeyStack

A portable DIY digital piano built on a Raspberry Pi 5. Power it on and it
boots straight into a playable instrument: a USB MIDI keyboard drives
FluidSynth through a DAC HAT, and a 5" touchscreen shows a practice UI
with a side rail for Voices (instrument picker), Practice
(chromatic scale trainer, fingering table, metronome), Songs, Import, and Settings
(power off and connection status).

## Hardware

| | |
|---|---|
| Compute | Raspberry Pi 5, Raspberry Pi OS (Debian 13 "trixie", labwc desktop) |
| DAC | InnoMaker PCM5122 DAC HAT (ALSA card `BossDAC`, device `hw:BossDAC,0`) |
| Amplifier | Class D, PAM8403/PAM8406 (5V) |
| Speakers | 2x 4Ω / 3W |
| MIDI keyboard | Novation Launchkey Mini MK4 37 (USB, class-compliant) |
| Synth engine | FluidSynth 2.4.4 with the `FluidR3_GM.sf2` soundfont |
| Screen | Freenove 5" MIPI DSI, 800x480, touch |
| Status indicator | WS2812 RGB LED module |
| Power | USB-C power bank (22.5W max), feeds the Pi and amp off the 5V rail |

## Architecture

```
Launchkey ──USB──► ALSA sequencer ──► FluidSynth ──► ALSA PCM ──► DAC   [real-time, no JS]
                        ▲
                        │ creates the subscription
                 apps/server (Node + Express + ws)
                        │ REST + WebSocket
                        ▼
                 apps/web (Chromium kiosk)
```

- **JavaScript is never on the audio path.** Notes go keyboard → kernel →
  FluidSynth. `apps/server` only creates that wiring, by finding both ends
  **by name** in `aconnect -l` and connecting them.
- **FluidSynth and the server are separate systemd user services**, and the
  kiosk is a Chromium started by the desktop session.
  Restarting or crashing the server never stops the sound.
- **Reconciliation, not event-catching.** Every 500ms the server compares
  the wiring that should exist with what does, and fixes the difference.
  That one loop handles hot-plug, FluidSynth restarts, and its own restarts.
- **The server is the source of truth.** The UI fetches `GET /api/status`,
  then follows events pushed over the `/ws` WebSocket.

Full detail — the reconciler, API, configuration, backend layering — is in
[docs/architecture.md](docs/architecture.md).

## Repo structure

This is an npm workspaces monorepo (no Turborepo — two apps deploying to one
Pi doesn't need build-graph caching, just shared installs):

```
apps/
  web/      Next.js 16 / React 19 frontend, statically exported (Tailwind v4,
            shadcn/ui on Base UI primitives) — the kiosk UI itself
  server/   Node + Express + ws backend: keeps the MIDI keyboard wired to
            FluidSynth, exposes status over REST + WebSocket, and serves
            web's static export in production
packages/
  shared/   TypeScript types shared between web and server (API request/
            response contracts and pushed events, e.g. MidiConnectionStatus,
            KeyStackEvent, InstrumentSelectRequest/Response)
deploy/     Pi-specific provisioning, sync, and systemd units — see
            deploy/README.md
docs/       architecture.md (how it all fits together) and design-system.md
            (the UI's design tokens)
```

## How instrument selection works

The `/instruments` page calls `POST /api/instruments/select`
(`{ "instrumentId": "piano" | "electric-piano" | "stevie-wonder-piano" }`)
when you click a piano card. The request/response types live in
`packages/shared`; `apps/server` doesn't implement this endpoint yet.

The frontend module (`apps/web/app/modules/basic-piano-instruments`) follows
a lightweight hexagonal layering: `core/` (domain + port interfaces + use
cases, no I/O), `adapters/` (the only place `fetch` calls live), and
`components/` (the React UI, wired to `core/` through the hook in
`components/usePianoRack.tsx`).

## Development

Requires Node.js and npm. Install once at the repo root — this installs all
workspaces:

```bash
npm install
```

### Frontend (`apps/web`)

```bash
npm run dev       # next dev, http://localhost:3000
npm run dev:lan   # same, reachable from other devices on your network
```

In dev, the frontend sends API calls to `NEXT_PUBLIC_API_BASE_URL`
(`http://localhost:4000`, set in `apps/web/.env.development`).

The song library (`/songs`) talks to the SongStreamer API on the server Pi
at `NEXT_PUBLIC_SONGS_API_BASE_URL`. It is read at build time: production
builds (`npm run build`, `npm run pi:deploy`) take it from
`apps/web/.env.production` (`https://serverpi.taild695c4.ts.net`); for
`next dev`, set it in `apps/web/.env.development.local` (see
`apps/web/.env.example`).

### Backend (`apps/server`)

```bash
npm run dev:server   # tsx watch, http://localhost:4000
npm test             # vitest: parser, matching, reconciler
```

`aconnect` only exists on Linux, so on a Mac the server logs one "could not
list ALSA sequencer clients" error and reports everything as absent.

### Build

```bash
npm run build
```

Builds `packages/shared` → `apps/server` → `apps/web`, in that order
(dependency order, since there's no Turborepo graph to infer it).
`apps/web` builds to a static site in `apps/web/out/` (`next.config.ts` sets
`output: "export"`).

### Lint, typecheck, format

```bash
npm run lint        # all workspaces
npm run typecheck   # all workspaces
npm run format      # prettier, whole repo
```

### Script reference

| Script | What it does |
|---|---|
| `npm run dev` | `apps/web` dev server (localhost) |
| `npm run dev:lan` | `apps/web` dev server reachable from your network |
| `npm run dev:server` | `apps/server` dev server |
| `npm run build` | Builds `packages/shared` → `apps/server` → `apps/web` |
| `npm run lint` / `typecheck` / `test` | Runs across all workspaces |
| `npm run format` | `prettier --write` across the repo |
| `npm run pi:deploy` | Build, ship to the Pi, restart the server, show the new build on the Pi's screen |
| `npm run pi:dev` | Run `next dev` here and point the Pi's screen at it; Ctrl-C puts the deployed build back |

## Deploying to the Pi

See [deploy/README.md](deploy/README.md) for first-time provisioning, the
systemd services, and troubleshooting.

## Design system

See [docs/design-system.md](docs/design-system.md) for the UI's design
tokens and component conventions.
