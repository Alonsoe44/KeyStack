export type MidiConnectionStatus = {
  keyboard: { present: boolean; name?: string }
  synth: { present: boolean; name?: string }
  /** keyboard MIDI In port → synth port 0 subscription exists */
  routed: boolean
  /** ISO timestamp */
  lastChangedAt: string
}

export type KeyStackEvent =
  // full snapshot, always sent on change
  | { type: "midi.status"; status: MidiConnectionStatus }
  | { type: "midi.keyboard.connected"; name: string }
  | { type: "midi.keyboard.disconnected" }
  | { type: "midi.route.established" }
  | { type: "midi.route.failed"; reason: string }

export interface StatusResponse {
  midi: MidiConnectionStatus
}
