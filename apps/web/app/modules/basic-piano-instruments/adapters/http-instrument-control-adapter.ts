import type {
  InstrumentId,
  InstrumentSelectRequest,
  InstrumentSelectResponse,
  InstrumentStateResponse,
  VolumeRequest,
} from "keystack-shared"
import type { InstrumentControlPort } from "../core/instrument-control-port"

const DEFAULT_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

async function postJson(url: string, body: unknown): Promise<InstrumentSelectResponse> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = (await res.json().catch(() => ({ ok: false }))) as InstrumentSelectResponse
    if (!res.ok || !result.ok) {
      return { ok: false, error: result.error ?? `Request failed (${res.status})` }
    }
    return result
  } catch {
    return { ok: false, error: "Can't reach the piano server" }
  }
}

export function createHttpInstrumentControlAdapter(basePath: string = DEFAULT_BASE_PATH): InstrumentControlPort {
  return {
    async getState() {
      try {
        const res = await fetch(`${basePath}/api/instruments`)
        if (!res.ok) return null
        return (await res.json()) as InstrumentStateResponse
      } catch {
        return null
      }
    },
    selectInstrument(instrumentId: InstrumentId) {
      return postJson(`${basePath}/api/instruments/select`, { instrumentId } satisfies InstrumentSelectRequest)
    },
    setVolume(volume: number) {
      return postJson(`${basePath}/api/instruments/volume`, { volume } satisfies VolumeRequest)
    },
  }
}
