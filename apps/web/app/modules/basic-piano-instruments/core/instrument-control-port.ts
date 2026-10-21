import type { InstrumentId, InstrumentSelectResponse, InstrumentStateResponse } from "keystack-shared"

export interface InstrumentControlPort {
  /** The voice and volume the synth is on now. Null when the backend can't be reached. */
  getState(): Promise<InstrumentStateResponse | null>
  selectInstrument(instrumentId: InstrumentId): Promise<InstrumentSelectResponse>
  setVolume(volume: number): Promise<InstrumentSelectResponse>
}
