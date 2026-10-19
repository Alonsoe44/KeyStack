export type ButtonName =
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

/** Top row is pad-1 to pad-8, bottom row pad-9 to pad-16, left to right. */
export type PadName = `pad-${PadNumber}`
/** Left to right. */
export type KnobName = `knob-${KnobNumber}`

export type ButtonEvent = {
  type: "button"
  name: ButtonName
  /** true when the finger goes down, false when it lifts. */
  pressed: boolean
  /** Milliseconds since the Unix epoch. */
  time: number
}

export type PadEvent = {
  type: "pad"
  name: PadName
  pressed: boolean
  /** How hard the pad was hit, 1 (soft) to 127 (hard); 0 on release. */
  velocity: number
  time: number
}

export type KnobEvent = {
  type: "knob"
  name: KnobName
  /** Clicks turned: positive is clockwise, negative counter-clockwise. */
  delta: number
  time: number
}

export type ControlEvent = ButtonEvent | PadEvent | KnobEvent

export type ConnectionStatus =
  | { state: "connected"; port: string }
  | { state: "disconnected" }
  | { state: "error"; message: string }

export type LaunchkeyInputEvents = {
  control: ControlEvent
  status: ConnectionStatus
}

export interface MidiConnection {
  send(bytes: Uint8Array): Promise<void>
  /** Stops receiving. Does not call the `closed` handler. */
  close(): Promise<void>
}

export type MidiConnectionHandlers = {
  /** Raw bytes in arrival order; may split or join MIDI messages. */
  data(bytes: Uint8Array): void
  /** The port went away on its own (for example, the controller was unplugged). */
  closed(reason: string): void
}

/** How the library reaches the Launchkey's DAW port on a given platform. */
export interface MidiTransport {
  /** The DAW port's address, or null when the controller is not connected. */
  findPort(): Promise<string | null>
  open(port: string, handlers: MidiConnectionHandlers): Promise<MidiConnection>
}
