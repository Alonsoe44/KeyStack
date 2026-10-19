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
| `AppShell` | `components/app-shell.tsx` | Full-height side rail (Voices, Practice, Songs, Settings) on every route; the current route is cobalt. No top bar or footer |
| `Piano` | `components/piano.tsx` | On-screen keyboard for the practice tools |
| `ChromaticPractice` | `components/chromatic-practice.tsx` | Two-column chromatic scale tool |
| `Metronome`, `CountdownTimer` | `components/` | Practice timing controls |
| `FingeringTable` | `components/fingering-table.tsx` | Finger numbers for the selected scale |
| `Button`, `AlertDialog`, `Popover`, `Slider` | `components/ui/` | shadcn primitives restyled with the tokens above |
| `ScrollArea` | `components/ui/scroll-area.tsx` | **The only way to scroll.** Wraps every scrolling region (the route area in `AppShell`, YouTube results, lyrics editor lists, the practice piano and fingering table) with a thick 24 px square bar: an ink thumb with grip lines that turns cobalt while dragged, on a `--secondary` track. Touch-draggable, and it reserves its gutter only while content overflows. `orientation` is `vertical` (default), `horizontal` or `both`; frame styles go in `className`, content layout in `viewportClassName`, and accessible names and live regions in `viewportProps`. Native scrollbars that remain (textareas) get the same look from `globals.css`. Size: `--scrollbar-size` |
| `MidiStatusPanel` | `app/modules/midi-connection/` | Live keyboard connection status |
| `PianoRackContainer`, `PianoCard`, `VoiceArt` | `app/modules/basic-piano-instruments/` | Voice cards. `VoiceArt` draws each voice in the tokens: an ink grand with its lid propped, a cobalt Rhodes on thin legs, a pink wedge Clavinet with knobs. The selected card turns cobalt with a yellow art panel and a `PLAYING` tag |
| `VolumeControl` | `app/modules/basic-piano-instruments/` | The piano's volume (FluidSynth gain); sends on release. Songs keep their own level. Not placed on any screen at the moment: the piano plays at the server's volume (63 by default) |
| `PowerOffButton` | `app/modules/system-power/` | Confirmed shutdown of the Pi, on the Settings route |
| `SongsScreen`, `SongList`, `SongPlayerScreen` | `app/modules/song-player/` | Song cards (title, artist, `PLAYING` chip) and the player: ±10 buttons, yellow play toggle, ink-framed timeline. On short screens (the 800x480 kiosk) the player drops the page heading so the controls stay visible |

Illustrations are inline SVG components rather than downloaded images, so they
scale crisply and follow the tokens. KeyStack has no mascot.

## Layout patterns

- The kiosk is one screen, not a website: a side rail on the left and the
  route's content filling the rest of the viewport. There is no top bar,
  footer, or full-screen hero title.
- Each route opens with a compact panel heading (an eyebrow plus a
  `panel-heading`, e.g. "Pick a voice."), not a display-size title.
- Voices, Practice and Songs are sized to fit the 800x480 kiosk without
  scrolling. Settings is the one route that scrolls: device label and power
  control, live MIDI status, then the cobalt "Play louder." banner at the
  bottom.
- `/` renders the Voices screen (the static export can't redirect), so the
  kiosk boots straight into the voice picker.
- Instrument cards remain real buttons and continue to call the local backend
  adapter. Their selected state is cobalt with a yellow action marker.
- Practice controls remain tied to the existing audio and scale modules. The
  chromatic route uses a responsive two-column tool layout that collapses to one
  column on small screens.

Every route keeps visible focus states, semantic headings, labels for live
status, and a `prefers-reduced-motion` fallback.
