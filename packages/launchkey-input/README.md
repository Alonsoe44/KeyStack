# launchkey-input

Use a Novation **Launchkey Mini MK4 37** as an input device: its buttons,
pads and knobs become named events any Node app can listen to.

```ts
import { createLaunchkeyInput } from "launchkey-input"

const launchkey = createLaunchkeyInput()

launchkey.on("control", (event) => {
  if (event.type === "button" && event.name === "select" && event.pressed) {
    openSelectedSong()
  }
  if (event.type === "knob" && event.name === "knob-1") {
    changeVolume(event.delta)
  }
})
launchkey.on("status", (status) => console.log(status.state))

await launchkey.start() // never throws for a missing controller
// …
await launchkey.stop() // puts the controller back in standalone mode
```

Input only: it does not light LEDs or write to the screen. The piano keys are
not touched; route them to a synth as usual.

## Requirements

- Linux with ALSA and `amidi` (Debian/Raspberry Pi OS package `alsa-utils`).
- The user running the app must be able to open `/dev/snd/midi*` (on
  Raspberry Pi OS, the `audio` group, or the active desktop session).

## Events

`control` — one per press, release or knob click:

| `type` | `name` | Fields |
|---|---|---|
| `button` | `play`, `record`, `previous`, `next`, `up`, `down`, `select`, `back` | `pressed` |
| `pad` | `pad-1` … `pad-16` | `pressed`, `velocity` |
| `knob` | `knob-1` … `knob-8` | `delta` |

- `pressed` is `true` when the finger goes down and `false` when it lifts,
  so every press is two events.
- `velocity` is how hard a pad was hit, 1–127, and 0 on release.
- `delta` is the clicks turned: positive clockwise, negative
  counter-clockwise.
- `time` is milliseconds since the Unix epoch.
- Nothing repeats while a button is held; repeat in the app if you need it.

Pads are numbered top row first, left to right (`pad-1` … `pad-8`, then
`pad-9` … `pad-16`). Knobs are numbered left to right.

`status` — on every change:

| `state` | Meaning |
|---|---|
| `connected` | Listening; `port` is the ALSA device, for example `hw:1,0,1` |
| `disconnected` | Not found, unplugged, or stopped. The library keeps looking every 2 s |
| `error` | Looking failed, for example `amidi` is missing; `message` says why. Reported once per distinct message; retried every 2 s |

`getStatus()` returns the current one.

## Where each control is

| Name | Control on the Launchkey | MIDI on the DAW port |
|---|---|---|
| `play` | ▶, below Shift | `B0 73` (CC 115, ch 1) |
| `record` | ●, beside ▶ | `B0 75` (CC 117, ch 1) |
| `previous` | Track ^, left of the pads | `B0 6A` (CC 106, ch 1) |
| `next` | Track v, left of the pads | `B0 6B` (CC 107, ch 1) |
| `up` | ^ beside the knobs, top right | `B0 33` (CC 51, ch 1) |
| `down` | v beside the knobs, top right | `B0 34` (CC 52, ch 1) |
| `select` | >, right of the pads | `B0 68` (CC 104, ch 1) |
| `back` | Func, right of the pads | `B0 69` (CC 105, ch 1) |
| `pad-1` … `pad-8` | top row of pads | Note On `90 60`–`90 67` |
| `pad-9` … `pad-16` | bottom row of pads | Note On `90 70`–`90 77` |
| `knob-1` … `knob-8` | the eight knobs | `BF 55`–`BF 5C` (CC 85–92, ch 16), 64 ± clicks |

Not reported: Shift, Arp, Scale, Settings, Octave −/+ (the controller
handles them), and pad pressure (aftertouch).

These numbers were measured on the device, and some differ from Novation's
[programmer's reference guide](https://fael-downloads-prod.focusrite.com/customer/prod/downloads/launchkey_mk4_programmer_s_reference_guide_v2_en.pdf):
buttons arrive on channel 1, not 16, and the top-right arrows are CC 51/52,
not 55/56.

## How it works

The Launchkey has two USB MIDI interfaces. The first (`MIDI`) carries the
keys. The second (`DAW`) carries every other control once the controller is
in **DAW mode**, which also stops the pads from playing notes.

1. Every 2 s, run `amidi -l` and look for a port named
   `Launchkey Mini MK4 37 DAW`.
2. Start `amidi -p <port> -d`, which opens the input side only and prints
   every byte as hex.
3. Send `9F 0C 7F` (enter DAW mode) and `B6 45 7F` (relative knobs) with
   `amidi -p <port> -S`.
4. Split the byte stream into MIDI messages and decode each into an event.
5. When `amidi` exits on its own, the controller was unplugged: report
   `disconnected` and go back to step 1.
6. `stop()` sends `9F 0C 00` (standalone mode) and ends `amidi`.

The ALSA sequencer (`aconnect -l`) does not list the DAW port, which is why
this goes through raw MIDI with `amidi` instead.

## Options

```ts
createLaunchkeyInput({
  portMatch: "Launchkey Mini MK4 37 DAW", // substring of the name in `amidi -l`
  binary: "amidi",
  timeoutMs: 2000,        // per `amidi -l` / `amidi -S` call
  searchIntervalMs: 2000, // how often to look while disconnected
})
```

## Portable core

`launchkey-input/core` has no Node APIs (checked by `tsconfig.core.json`).
It exports `LaunchkeyInput`, which takes any `MidiTransport`, plus the
decoder, the stream parser and `FakeTransport` for tests. A browser app
could use it with a Web MIDI transport on a platform where Web MIDI can see
the DAW port.

```ts
import { FakeTransport, LaunchkeyInput } from "launchkey-input/core"

const transport = new FakeTransport()
transport.port = "hw:1,0,1"
const launchkey = new LaunchkeyInput({ transport })
await launchkey.start()
transport.play([0xb0, 0x73, 0x7f]) // → { type: "button", name: "play", pressed: true }
transport.unplug()                 // → status disconnected
```

## Tests

```bash
npm test --workspace packages/launchkey-input
npm run typecheck --workspace packages/launchkey-input
```

- `src/captures.test.ts` replays the five hardware captures in
  `src/__fixtures__/` (see its README) through the real parsing path.
- `src/core/LaunchkeyInput.test.ts` covers start, missing controller,
  unplug and replug, errors and stop against `FakeTransport`.
- `src/node/AmidiTransport.test.ts` runs the transport against a fake
  `amidi` script, so the spawn, send and kill code runs without hardware.

## Checking a controller by hand

These are the commands the captures came from. Run them on the machine the
controller is plugged into, with the app stopped:

```bash
amidi -l
```

Both `… MIDI Out` and `… DAW Out` should be listed. Then enter DAW mode with
relative knobs, press controls, and stop with Ctrl+C:

```bash
amidi -p hw:1,0,1 -S '9F 0C 7F B6 45 7F' -d
```

Leave DAW mode afterwards:

```bash
amidi -p hw:1,0,1 -S '9F 0C 00'
```

Still to confirm on hardware: that CC 51 is the top-right ^ (and 52 the v),
knobs 2–8, and the `delta` a fast turn produces.
