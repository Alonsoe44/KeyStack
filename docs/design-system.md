# KeyStack display system

KeyStack is a local piano kiosk. Its display layer is deliberately loud and
physical: a paper-like off-white canvas, electric cobalt panels, punch yellow
actions, and heavy ink borders. The visual system gives the practice tools a
clear hierarchy while keeping hardware status and local controls easy to find.

## Tokens

The source of truth is [`apps/web/app/globals.css`](../apps/web/app/globals.css).

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#f7f4ea` | Off-white page canvas |
| `--foreground` | `#171927` | Ink, borders, and readable text |
| `--primary` | `#2934ff` | Cobalt hero panels, active cards, and links |
| `--accent` | `#ffe34e` | Selection, focus, stickers, and primary actions |
| `--card` | `#fffdf5` | Raised content panels |
| `--secondary` | `#e7e3d8` | Utility surfaces and inactive controls |
| `--destructive` | `#d84637` | Power-off and connection errors |

The base border is a 2px ink rule. Cards and buttons use square corners. The
`button-corners` class adds small selection-handle marks to every shared button,
which makes actions recognizable on the kiosk from a distance.

## Type

Headlines use a local system stack beginning with `Arial Black`, with very tight
tracking, a short line-height, and uppercase text. Body copy uses the regular
Arial stack for reliable rendering on Raspberry Pi images without a runtime
font download. Monospace labels identify device state, route numbers, and
small editorial metadata.

## Components

Shared building blocks live in `apps/web/components/`; feature UI that talks to
a backend lives in its module under `apps/web/app/modules/`.

| Component | Where | Use |
| --- | --- | --- |
| `AppShell` | `components/app-shell.tsx` | Header with navigation, the local Pi label, and power control on every route |
| `HeroKeys` | `components/hero-keys.tsx` | Decorative one-octave keyboard on the home hero; card-colored keys, ink black keys, hard offset shadow |
| `Piano` | `components/piano.tsx` | On-screen keyboard for the practice tools |
| `ChromaticPractice` | `components/chromatic-practice.tsx` | Two-column chromatic scale tool |
| `Metronome`, `CountdownTimer` | `components/` | Practice timing controls |
| `FingeringTable` | `components/fingering-table.tsx` | Finger numbers for the selected scale |
| `Button`, `AlertDialog`, `Popover`, `Slider` | `components/ui/` | shadcn primitives restyled with the tokens above |
| `MidiStatusPanel` | `app/modules/midi-connection/` | Live keyboard connection status |
| `PianoRackContainer`, `VolumeControl` | `app/modules/basic-piano-instruments/` | Voice selection and output volume, through the local backend adapter |
| `PowerOffButton` | `app/modules/system-power/` | Confirmed shutdown of the Pi |

Illustrations are inline SVG components rather than downloaded images, so they
scale crisply and follow the tokens. KeyStack has no mascot.

## Layout patterns

- The shared shell keeps navigation, the local Pi label, and power control in a
  consistent header on every route.
- The home route combines a product action area, live MIDI status, and direct
  links to the two working modes. It is an app surface, not a marketing-only
  landing page.
- Instrument cards remain real buttons and continue to call the local backend
  adapter. Their selected state is cobalt with a yellow action marker.
- Practice controls remain tied to the existing audio and scale modules. The
  chromatic route uses a responsive two-column tool layout that collapses to one
  column on small screens.

Every route keeps visible focus states, semantic headings, labels for live
status, and a `prefers-reduced-motion` fallback.
