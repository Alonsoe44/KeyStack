import type { SeqClient, SeqPort } from "./types"

export type KeyboardMatch = { clientPrefix: string; portMatch: string }

// Keep each keyboard paired with its musical port so DAW ports are skipped.
export function findKeyboardPort(
  clients: SeqClient[],
  configuredMatch: KeyboardMatch
): SeqPort | undefined {
  const matches: KeyboardMatch[] = [
    configuredMatch,
    { clientPrefix: "KOMPLETE KONTROL", portMatch: "MIDI 1" },
  ]
  for (const { clientPrefix, portMatch } of matches) {
    for (const client of clients) {
      if (!client.name.startsWith(clientPrefix)) continue
      const port = client.ports.find((p) => p.portName.includes(portMatch))
      if (port) return port
    }
  }
  return undefined
}

export function findSynthPort(
  clients: SeqClient[],
  clientPrefix: string
): SeqPort | undefined {
  const client = clients.find((c) => c.name.startsWith(clientPrefix))
  return client?.ports.find((p) => p.portId === 0)
}

export function isRouted(keyboardPort: SeqPort, synthPort: SeqPort): boolean {
  return keyboardPort.connectingTo.some(
    (to) => to.clientId === synthPort.clientId && to.portId === synthPort.portId
  )
}
