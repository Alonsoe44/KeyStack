export type * from "./midi"

export interface HealthResponse {
  ok: true
}

export type InstrumentId = "piano" | "electric-piano" | "stevie-wonder-piano"

export interface InstrumentSelectRequest {
  instrumentId: InstrumentId
}

export interface InstrumentSelectResponse {
  ok: boolean
  error?: string
}

export interface PowerOffResponse {
  ok: boolean
  error?: string
}
