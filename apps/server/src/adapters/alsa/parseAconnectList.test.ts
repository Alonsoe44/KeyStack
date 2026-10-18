import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  findKeyboardPort,
  findSynthPort,
  isRouted,
} from "../../domain/midi-connection/matching"
import { parseAconnectList } from "./parseAconnectList"

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8")

const keyboardMatch = { clientPrefix: "Launchkey", portMatch: "MIDI In" }

describe("parseAconnectList", () => {
  it("parses the unrouted device output", () => {
    const clients = parseAconnectList(fixture("aconnect-unrouted.txt"))

    expect(clients.map((c) => [c.id, c.name])).toEqual([
      [0, "System"],
      [14, "Midi Through"],
      [20, "Launchkey Mini MK4 37"],
      [128, "FLUID Synth (2547)"],
      [142, "PipeWire-System"],
      [143, "PipeWire-RT-Event"],
    ])
    expect(clients[2].ports).toEqual([
      {
        clientId: 20,
        portId: 0,
        clientName: "Launchkey Mini MK4 37",
        portName: "Launchkey Mini MK4 37 MIDI In",
        connectingTo: [],
      },
      {
        clientId: 20,
        portId: 1,
        clientName: "Launchkey Mini MK4 37",
        portName: "Launchkey Mini MK4 37 DAW In",
        connectingTo: [],
      },
    ])

    const keyboard = findKeyboardPort(clients, keyboardMatch)!
    const synth = findSynthPort(clients, "FLUID Synth")!
    expect(isRouted(keyboard, synth)).toBe(false)
  })

  it("parses the routed device output", () => {
    const clients = parseAconnectList(fixture("aconnect-routed.txt"))
    const keyboard = findKeyboardPort(clients, keyboardMatch)!
    const synth = findSynthPort(clients, "FLUID Synth")!

    expect(keyboard.connectingTo).toEqual([{ clientId: 128, portId: 0 }])
    expect(clients[2].ports[1].connectingTo).toEqual([])
    expect(isRouted(keyboard, synth)).toBe(true)
  })

  it("trims padded port names", () => {
    const clients = parseAconnectList(fixture("aconnect-unrouted.txt"))
    expect(clients[0].ports.map((p) => p.portName)).toEqual([
      "Timer",
      "Announce",
    ])
  })

  it("attaches connections to the most recent port, not the client", () => {
    const clients = parseAconnectList(fixture("aconnect-unrouted.txt"))
    expect(clients[0].ports[0].connectingTo).toEqual([
      { clientId: 142, portId: 0 },
    ])
    expect(clients[0].ports[1].connectingTo).toEqual([
      { clientId: 142, portId: 0 },
    ])
    // "Connected From:" is not an outgoing connection
    expect(clients[4].ports[0].connectingTo).toEqual([])
  })

  it("returns no clients for empty output", () => {
    expect(parseAconnectList("")).toEqual([])
    expect(parseAconnectList("\n\n")).toEqual([])
  })

  it("strips suffixes from connection entries", () => {
    const clients = parseAconnectList(
      [
        "client 20: 'Keys' [type=kernel,card=1]",
        "    0 'Keys MIDI 1'",
        "\tConnecting To: 128:0[real:0], 129:1 [queue:1], 130:2",
      ].join("\n")
    )
    expect(clients[0].ports[0].connectingTo).toEqual([
      { clientId: 128, portId: 0 },
      { clientId: 129, portId: 1 },
      { clientId: 130, portId: 2 },
    ])
  })

  it("ignores unknown lines", () => {
    const clients = parseAconnectList(
      [
        "some banner we have never seen",
        "\tConnecting To: 1:1",
        "    0 'orphan port before any client'",
        "client 20: 'Keys' [type=kernel]",
        "\tConnecting To: 9:9",
        "    0 'Keys MIDI 1'",
        "\tSomething New: 5:5",
        "\tConnecting To: garbage, 128:0",
        "client broken line",
      ].join("\n")
    )
    expect(clients).toEqual([
      {
        id: 20,
        name: "Keys",
        ports: [
          {
            clientId: 20,
            portId: 0,
            clientName: "Keys",
            portName: "Keys MIDI 1",
            connectingTo: [{ clientId: 128, portId: 0 }],
          },
        ],
      },
    ])
  })

  it("handles client names containing quotes and CRLF line endings", () => {
    const clients = parseAconnectList(
      "client 24: 'Bob's Keys' [type=kernel]\r\n    0 'Bob's Keys MIDI 1'\r\n"
    )
    expect(clients[0].name).toBe("Bob's Keys")
    expect(clients[0].ports[0].portName).toBe("Bob's Keys MIDI 1")
  })
})
