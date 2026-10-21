import { describe, expect, it } from "vitest"
import { DAW_MODE_EXIT, DAW_MODE_SETUP } from "./decode"
import { FakeTransport } from "./FakeTransport"
import { LaunchkeyInput, type Scheduler } from "./LaunchkeyInput"
import type { ConnectionStatus, ControlEvent } from "./types"

/** A scheduler the test advances by hand. */
function manualScheduler() {
  let pending: (() => void) | null = null
  const scheduler: Scheduler = {
    now: () => 1000,
    schedule(fn) {
      pending = fn
      return () => {
        pending = null
      }
    },
  }
  return {
    scheduler,
    get hasPending() {
      return pending !== null
    },
    /** Runs the next search and lets it finish. */
    async tick() {
      const fn = pending
      pending = null
      fn?.()
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
  }
}

function setup() {
  const transport = new FakeTransport()
  const clock = manualScheduler()
  const input = new LaunchkeyInput({ transport, scheduler: clock.scheduler })
  const statuses: ConnectionStatus[] = []
  const controls: ControlEvent[] = []
  input.on("status", (s) => statuses.push(s))
  input.on("control", (e) => controls.push(e))
  return { transport, clock, input, statuses, controls }
}

describe("LaunchkeyInput", () => {
  it("connects, sends the DAW-mode setup and emits named controls", async () => {
    const { transport, input, statuses, controls } = setup()
    transport.port = "hw:1,0,1"

    await input.start()
    transport.play([0xb0, 0x73, 0x7f])

    expect(statuses).toEqual([{ state: "connected", port: "hw:1,0,1" }])
    expect(transport.sent).toEqual([DAW_MODE_SETUP])
    expect(controls).toEqual([{ type: "button", name: "play", pressed: true, time: 1000 }])
  })

  it("keeps searching until the controller is plugged in", async () => {
    const { transport, clock, input, statuses } = setup()

    await input.start()
    expect(statuses).toEqual([])
    expect(clock.hasPending).toBe(true)

    transport.port = "hw:1,0,1"
    await clock.tick()
    expect(input.getStatus()).toEqual({ state: "connected", port: "hw:1,0,1" })
  })

  it("reports an unplug and reconnects when it comes back", async () => {
    const { transport, clock, input, statuses } = setup()
    transport.port = "hw:1,0,1"
    await input.start()

    transport.unplug()
    expect(input.getStatus()).toEqual({ state: "disconnected" })

    transport.port = "hw:2,0,1"
    await clock.tick()
    expect(statuses).toEqual([
      { state: "connected", port: "hw:1,0,1" },
      { state: "disconnected" },
      { state: "connected", port: "hw:2,0,1" },
    ])
    expect(transport.sent).toEqual([DAW_MODE_SETUP, DAW_MODE_SETUP])
  })

  it("reports a search error once and keeps retrying", async () => {
    const { transport, clock, input, statuses } = setup()
    transport.findError = new Error("amidi not found; install alsa-utils")

    await input.start()
    await clock.tick()
    await clock.tick()
    expect(statuses).toEqual([
      { state: "error", message: "amidi not found; install alsa-utils" },
    ])

    transport.findError = null
    await clock.tick()
    expect(statuses.at(-1)).toEqual({ state: "disconnected" })
    expect(clock.hasPending).toBe(true)
  })

  it("stop() leaves DAW mode, closes the port and stops searching", async () => {
    const { transport, clock, input, controls } = setup()
    transport.port = "hw:1,0,1"
    await input.start()

    await input.stop()
    transport.play([0xb0, 0x73, 0x7f])

    expect(transport.sent).toEqual([DAW_MODE_SETUP, DAW_MODE_EXIT])
    expect(transport.isOpen).toBe(false)
    expect(controls).toEqual([])
    expect(clock.hasPending).toBe(false)
    expect(input.getStatus()).toEqual({ state: "disconnected" })
  })
})
