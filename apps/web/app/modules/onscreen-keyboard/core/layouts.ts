/**
 * Key layouts for the on-screen keyboard, sized for the Pi's 800×480 touch
 * screen. Letters, then numbers/symbols, then accents for song titles in
 * Spanish and Portuguese.
 */

export type LayerId = "letters" | "symbols" | "accents"

export type KeySpec =
  | { kind: "char"; value: string }
  | { kind: "backspace" }
  | { kind: "enter" }
  | { kind: "shift" }
  | { kind: "space" }
  | { kind: "layer"; to: LayerId; label: string }
  | { kind: "hide" }

const chars = (row: string): KeySpec[] => Array.from(row).map((value) => ({ kind: "char", value }))

export const LAYERS: Record<LayerId, KeySpec[][]> = {
  letters: [
    [...chars("qwertyuiop"), { kind: "backspace" }],
    [...chars("asdfghjkl'"), { kind: "enter" }],
    [{ kind: "shift" }, ...chars("zxcvbnm,.-")],
    [
      { kind: "layer", to: "symbols", label: "123" },
      { kind: "layer", to: "accents", label: "áé" },
      { kind: "space" },
      { kind: "hide" },
    ],
  ],
  symbols: [
    [...chars("1234567890"), { kind: "backspace" }],
    [...chars("@#&/:;()\"?"), { kind: "enter" }],
    [...chars("!_=+%*,.-~")],
    [
      { kind: "layer", to: "letters", label: "ABC" },
      { kind: "layer", to: "accents", label: "áé" },
      { kind: "space" },
      { kind: "hide" },
    ],
  ],
  accents: [
    [...chars("áéíóúüñçãõ"), { kind: "backspace" }],
    [...chars("àèìòùâêôîû"), { kind: "enter" }],
    [{ kind: "shift" }, ...chars("¿¡«»ºª€$£")],
    [
      { kind: "layer", to: "letters", label: "ABC" },
      { kind: "layer", to: "symbols", label: "123" },
      { kind: "space" },
      { kind: "hide" },
    ],
  ],
}

/** Shift state: off, one capital letter, or caps lock (double tap). */
export type ShiftState = "off" | "once" | "lock"

export function nextShiftState(current: ShiftState, doubleTap: boolean): ShiftState {
  if (current === "off") return "once"
  if (current === "once") return doubleTap ? "lock" : "off"
  return "off"
}

export function charForShift(value: string, shift: ShiftState): string {
  return shift === "off" ? value : value.toLocaleUpperCase()
}
