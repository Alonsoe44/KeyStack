import type { SeqAddress, SeqClient } from "./types"

type PortSpec = { id: number; name: string; to?: SeqAddress[] }

export function client(id: number, name: string, ports: PortSpec[]): SeqClient {
  return {
    id,
    name,
    ports: ports.map((p) => ({
      clientId: id,
      portId: p.id,
      clientName: name,
      portName: p.name,
      connectingTo: p.to ?? [],
    })),
  }
}

export const launchkey = (id = 20) =>
  client(id, "Launchkey Mini MK4 37", [
    { id: 0, name: "Launchkey Mini MK4 37 MIDI In" },
    { id: 1, name: "Launchkey Mini MK4 37 DAW In" },
  ])

export const fluid = (id = 128, pid = 2547) =>
  client(id, `FLUID Synth (${pid})`, [
    { id: 0, name: `Synth input port (${pid}:0)` },
  ])
