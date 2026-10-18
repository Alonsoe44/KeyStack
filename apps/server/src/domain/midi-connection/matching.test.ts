import { describe, expect, it } from "vitest"
import { findKeyboardPort, findSynthPort, isRouted } from "./matching"
import { client, fluid, launchkey } from "./testing"

const match = { clientPrefix: "Launchkey", portMatch: "MIDI In" }

describe("findKeyboardPort", () => {
  it("accepts the Komplete Kontrol musical port and skips its DAW port", () => {
    const keyboard = client(24, "KOMPLETE KONTROL A49", [
      { id: 1, name: "KOMPLETE KONTROL A49 DAW" },
      { id: 0, name: "KOMPLETE KONTROL A49 MIDI 1" },
    ])
    expect(findKeyboardPort([fluid(), keyboard], match)).toMatchObject({
      clientId: 24,
      portId: 0,
    })
    expect(
      findKeyboardPort(
        [
          client(24, "KOMPLETE KONTROL A49", [
            { id: 1, name: "KOMPLETE KONTROL A49 DAW" },
          ]),
        ],
        match
      )
    ).toBeUndefined()
  })

  it("prefers the configured Launchkey when both keyboards are present", () => {
    const komplete = client(24, "KOMPLETE KONTROL A49", [
      { id: 0, name: "KOMPLETE KONTROL A49 MIDI 1" },
    ])
    expect(findKeyboardPort([komplete, launchkey()], match)?.clientId).toBe(20)
  })

  it("finds the MIDI In port by name", () => {
    const port = findKeyboardPort([fluid(), launchkey()], match)
    expect(port).toMatchObject({ clientId: 20, portId: 0 })
  })

  it("ignores the DAW In port even when it comes first", () => {
    const keyboard = client(20, "Launchkey Mini MK4 37", [
      { id: 0, name: "Launchkey Mini MK4 37 DAW In" },
      { id: 1, name: "Launchkey Mini MK4 37 MIDI In" },
    ])
    expect(findKeyboardPort([keyboard], match)).toMatchObject({ portId: 1 })
  })

  it("returns undefined when only the DAW In port exists", () => {
    const keyboard = client(20, "Launchkey Mini MK4 37", [
      { id: 1, name: "Launchkey Mini MK4 37 DAW In" },
    ])
    expect(findKeyboardPort([keyboard], match)).toBeUndefined()
  })

  it("requires the client name to start with the prefix", () => {
    const other = client(24, "My Launchkey", [{ id: 0, name: "MIDI In" }])
    expect(findKeyboardPort([other], match)).toBeUndefined()
  })

  it("returns undefined when no keyboard is present", () => {
    expect(findKeyboardPort([fluid()], match)).toBeUndefined()
    expect(findKeyboardPort([], match)).toBeUndefined()
  })
})

describe("findSynthPort", () => {
  it("finds port 0 whatever the client id", () => {
    expect(
      findSynthPort([launchkey(), fluid(131, 99)], "FLUID Synth")
    ).toMatchObject({
      clientId: 131,
      portId: 0,
      clientName: "FLUID Synth (99)",
    })
  })

  it("uses the first matching client", () => {
    const port = findSynthPort([fluid(129, 2), fluid(128, 1)], "FLUID Synth")
    expect(port?.clientId).toBe(129)
  })

  it("returns undefined when the synth is missing or has no port 0", () => {
    expect(findSynthPort([launchkey()], "FLUID Synth")).toBeUndefined()
    const noPortZero = client(128, "FLUID Synth (1)", [{ id: 1, name: "x" }])
    expect(findSynthPort([noPortZero], "FLUID Synth")).toBeUndefined()
  })
})

describe("isRouted", () => {
  const synthPort = fluid().ports[0]

  it("is true when the keyboard port connects to the synth port", () => {
    const port = {
      ...launchkey().ports[0],
      connectingTo: [
        { clientId: 142, portId: 0 },
        { clientId: 128, portId: 0 },
      ],
    }
    expect(isRouted(port, synthPort)).toBe(true)
  })

  it("is false with no connections or connections elsewhere", () => {
    const port = launchkey().ports[0]
    expect(isRouted(port, synthPort)).toBe(false)
    expect(
      isRouted(
        { ...port, connectingTo: [{ clientId: 128, portId: 1 }] },
        synthPort
      )
    ).toBe(false)
    // stale subscription to a previous synth client id
    expect(
      isRouted(
        { ...port, connectingTo: [{ clientId: 129, portId: 0 }] },
        synthPort
      )
    ).toBe(false)
  })
})
