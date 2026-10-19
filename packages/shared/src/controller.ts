// The Launchkey's buttons, pads and knobs as the local server forwards them
// over /ws. Mirrors the launchkey-input package's events; the server checks
// at compile time that the two stay assignable.

export type ControllerButtonName =
  | "play"
  | "record"
  | "previous"
  | "next"
  | "up"
  | "down"
  | "select"
  | "back"

type PadNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
type KnobNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type ControllerControlEvent =
  | { type: "button"; name: ControllerButtonName; pressed: boolean; time: number }
  | {
      type: "pad"
      name: `pad-${PadNumber}`
      pressed: boolean
      /** 1-127 on press, 0 on release. */
      velocity: number
      time: number
    }
  | {
      type: "knob"
      name: `knob-${KnobNumber}`
      /** Clicks: positive clockwise, negative counter-clockwise. */
      delta: number
      time: number
    }

export type ControllerStatus =
  | { state: "connected"; port: string }
  | { state: "disconnected" }
  | { state: "error"; message: string }
  /** LAUNCHKEY_INPUT_ENABLED=false on the server. */
  | { state: "disabled" }
