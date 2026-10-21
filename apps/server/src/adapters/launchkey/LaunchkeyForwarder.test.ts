import type { KeyStackEvent } from "keystack-shared"
import { FakeTransport, LaunchkeyInput } from "launchkey-input/core"
import { describe, expect, it } from "vitest"
import type { LoggerPort } from "../../ports/LoggerPort"
import { LaunchkeyForwarder } from "./LaunchkeyForwarder"

const silent: LoggerPort = { info: () => {}, warn: () => {}, error: () => {} }

function setup() {
  const transport = new FakeTransport()
  const input = new LaunchkeyInput({
    transport,
    scheduler: { now: () => 5, schedule: () => () => {} },
  })
  const published: KeyStackEvent[] = []
  const forwarder = new LaunchkeyForwarder(
    input,
    { publish: (e) => published.push(e) },
    silent
  )
  return { transport, forwarder, published }
}

describe("LaunchkeyForwarder", () => {
  it("publishes status changes and control events as they are", async () => {
    const { transport, forwarder, published } = setup()
    transport.port = "hw:1,0,1"

    await forwarder.start()
    transport.play([0xb0, 0x6b, 0x7f, 0xbf, 0x55, 0x3f])

    expect(published).toEqual([
      { type: "controller.status", status: { state: "connected", port: "hw:1,0,1" } },
      {
        type: "controller.control",
        control: { type: "button", name: "next", pressed: true, time: 5 },
      },
      {
        type: "controller.control",
        control: { type: "knob", name: "knob-1", delta: -1, time: 5 },
      },
    ])
    expect(forwarder.snapshot()).toEqual({
      type: "controller.status",
      status: { state: "connected", port: "hw:1,0,1" },
    })
  })

  it("reports disabled when there is no input", async () => {
    const forwarder = new LaunchkeyForwarder(null, { publish: () => {} }, silent)
    await forwarder.start()
    expect(forwarder.snapshot()).toEqual({
      type: "controller.status",
      status: { state: "disabled" },
    })
  })
})
