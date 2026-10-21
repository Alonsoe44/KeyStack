import type { ButtonName, ControlEvent, KnobName, PadName } from "./types"

// Measured on a Launchkey Mini MK4 37 in DAW mode on 2026-10-19; see
// src/__fixtures__. Several differ from Novation's programmer's guide
// (buttons arrive on channel 1, Up/Down are CC 51/52).

/** Enter DAW mode, then switch the knobs to relative output. */
export const DAW_MODE_SETUP = Uint8Array.of(0x9f, 0x0c, 0x7f, 0xb6, 0x45, 0x7f)
/** Back to standalone mode, as the controller powers up. */
export const DAW_MODE_EXIT = Uint8Array.of(0x9f, 0x0c, 0x00)

const BUTTON_CC: Record<number, ButtonName> = {
  0x73: "play",
  0x75: "record",
  0x6a: "previous",
  0x6b: "next",
  0x33: "up",
  0x34: "down",
  0x68: "select",
  0x69: "back",
}

const BUTTON_STATUS = 0xb0 // Control Change, channel 1
const PAD_ON = 0x90 // Note On, channel 1
const PAD_OFF = 0x80 // Note Off, channel 1
const KNOB_STATUS = 0xbf // Control Change, channel 16
const KNOB_FIRST_CC = 0x55
const RELATIVE_PIVOT = 0x40

function padName(note: number): PadName | null {
  if (note >= 0x60 && note <= 0x67) return `pad-${note - 0x60 + 1}` as PadName
  if (note >= 0x70 && note <= 0x77) return `pad-${note - 0x70 + 9}` as PadName
  return null
}

/**
 * One whole MIDI message from the DAW port → a control event, or null for
 * everything the library ignores (Shift, mode reports, pad pressure, echoes).
 */
export function decodeLaunchkeyMessage(
  message: ArrayLike<number>,
  time: number
): ControlEvent | null {
  const [status, data1, data2] = Array.from(message)
  if (data1 === undefined || data2 === undefined) return null

  if (status === BUTTON_STATUS) {
    const name = BUTTON_CC[data1]
    return name ? { type: "button", name, pressed: data2 > 0, time } : null
  }

  if (status === PAD_ON || status === PAD_OFF) {
    const name = padName(data1)
    if (!name) return null
    const velocity = status === PAD_ON ? data2 : 0
    return { type: "pad", name, pressed: velocity > 0, velocity, time }
  }

  if (status === KNOB_STATUS && data1 >= KNOB_FIRST_CC && data1 < KNOB_FIRST_CC + 8) {
    const delta = data2 - RELATIVE_PIVOT
    if (delta === 0) return null
    const name = `knob-${data1 - KNOB_FIRST_CC + 1}` as KnobName
    return { type: "knob", name, delta, time }
  }

  return null
}
