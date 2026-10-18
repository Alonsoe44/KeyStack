export type { MidiConnectionStatus } from "keystack-shared"

export type SeqAddress = { clientId: number; portId: number }

export type SeqPort = {
  clientId: number
  portId: number
  clientName: string
  portName: string
  connectingTo: SeqAddress[]
}

export type SeqClient = {
  id: number
  name: string
  ports: SeqPort[]
}
