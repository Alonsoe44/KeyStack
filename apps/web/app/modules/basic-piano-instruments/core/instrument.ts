import type { InstrumentId } from "keystack-shared"

export interface Instrument {
  id: InstrumentId
  name: string
  image: string
}

export const INSTRUMENTS: Instrument[] = [
  { id: "piano", name: "Piano", image: "/images/piano.svg" },
  { id: "electric-piano", name: "Electric Piano", image: "/images/piano-rhodes.svg" },
  { id: "stevie-wonder-piano", name: "Stevie Wonder Piano", image: "/images/piano-stevie.svg" },
]
