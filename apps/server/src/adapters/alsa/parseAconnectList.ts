import type {
  SeqAddress,
  SeqClient,
  SeqPort,
} from "../../domain/midi-connection/types"

const CLIENT_LINE = /^client (\d+): '(.*)'(?:\s+\[.*\])?\s*$/
const PORT_LINE = /^\s+(\d+) '(.*)'\s*$/
const CONNECTING_TO_LINE = /^\s+Connecting To:\s*(.*)$/

// Entries look like `128:0` or `128:0[real:0]`; anything after the address
// is dropped.
function parseAddresses(list: string): SeqAddress[] {
  const addresses: SeqAddress[] = []
  for (const entry of list.split(",")) {
    const match = /^\s*(\d+):(\d+)/.exec(entry)
    if (match) {
      addresses.push({ clientId: Number(match[1]), portId: Number(match[2]) })
    }
  }
  return addresses
}

/** Parses `aconnect -l` output. Unknown lines are ignored. */
export function parseAconnectList(output: string): SeqClient[] {
  const clients: SeqClient[] = []
  let client: SeqClient | undefined
  let port: SeqPort | undefined

  for (const line of output.split(/\r?\n/)) {
    const clientMatch = CLIENT_LINE.exec(line)
    if (clientMatch) {
      client = { id: Number(clientMatch[1]), name: clientMatch[2], ports: [] }
      clients.push(client)
      port = undefined
      continue
    }

    const portMatch = PORT_LINE.exec(line)
    if (portMatch && client) {
      port = {
        clientId: client.id,
        portId: Number(portMatch[1]),
        clientName: client.name,
        // System ports are padded, e.g. 'Timer           '
        portName: portMatch[2].trimEnd(),
        connectingTo: [],
      }
      client.ports.push(port)
      continue
    }

    // Belongs to the most recent port. "Connected From:" is the same
    // subscription seen from the other end, so it isn't needed.
    const connectingMatch = CONNECTING_TO_LINE.exec(line)
    if (connectingMatch && port) {
      port.connectingTo.push(...parseAddresses(connectingMatch[1]))
    }
  }

  return clients
}
