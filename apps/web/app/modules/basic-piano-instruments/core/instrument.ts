import type { InstrumentId } from "keystack-shared"

export interface Instrument {
  id: InstrumentId
  name: string
  /** What it sounds like, in a few words. */
  description: string
}

export const INSTRUMENTS: Instrument[] = [
  { id: "piano", name: "Piano", description: "Concert grand. Full and even." },
  { id: "electric-piano", name: "Electric Piano", description: "Rhodes. Warm, round, a little bell." },
  { id: "stevie-wonder-piano", name: "Stevie Wonder Piano", description: "Clavinet. Funky and percussive." },
]
