import type { InstrumentId, InstrumentSelectResponse } from "keystack-shared"

export interface InstrumentControlPort {
  selectInstrument(instrumentId: InstrumentId): Promise<InstrumentSelectResponse>
}
