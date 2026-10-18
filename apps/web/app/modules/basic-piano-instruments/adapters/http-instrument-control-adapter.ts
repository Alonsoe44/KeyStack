import type { InstrumentId, InstrumentSelectRequest, InstrumentSelectResponse } from "keystack-shared"
import type { InstrumentControlPort } from "../core/instrument-control-port"

const DEFAULT_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export function createHttpInstrumentControlAdapter(basePath: string = DEFAULT_BASE_PATH): InstrumentControlPort {
  return {
    async selectInstrument(instrumentId: InstrumentId): Promise<InstrumentSelectResponse> {
      try {
        const res = await fetch(`${basePath}/api/instruments/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrumentId } satisfies InstrumentSelectRequest),
        })
        const body = (await res.json()) as InstrumentSelectResponse
        if (!res.ok || !body.ok) {
          return { ok: false, error: body.error ?? `Request failed (${res.status})` }
        }
        return body
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Network error" }
      }
    },
  }
}
