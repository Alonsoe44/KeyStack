export type * from "./midi"
export type * from "./songs"
export type * from "./imports"
export type * from "./lyrics"
export type * from "./lyrics-lookup"
export type * from "./network"

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

/** GET /api/instruments */
export interface InstrumentStateResponse {
  selected: InstrumentId
  /** Piano (FluidSynth) volume, 0-100. Songs have their own volume. */
  volume: number
}

export interface VolumeRequest {
  volume: number
}

export interface PowerOffResponse {
  ok: boolean
  error?: string
}
