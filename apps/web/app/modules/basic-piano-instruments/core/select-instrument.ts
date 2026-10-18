import type { InstrumentId, InstrumentSelectResponse } from "keystack-shared"
import type { InstrumentControlPort } from "./instrument-control-port"

export function selectInstrument(
  port: InstrumentControlPort,
  instrumentId: InstrumentId,
): Promise<InstrumentSelectResponse> {
  return port.selectInstrument(instrumentId)
}
