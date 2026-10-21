import type { KeyStackEvent } from "keystack-shared"
import { beforeEach, describe, expect, it } from "vitest"
import type { ClockPort } from "../../ports/ClockPort"
import type { EventPublisherPort } from "../../ports/EventPublisherPort"
import type { LoggerPort } from "../../ports/LoggerPort"
import type { SequencerPort } from "../../ports/SequencerPort"
import { MidiConnectionReconciler } from "./reconciler"
import { fluid, launchkey } from "./testing"
import type { SeqAddress, SeqClient } from "./types"

/** In-memory sequencer: `connect` really adds the subscription. */
class FakeSequencer implements SequencerPort {
  clients: SeqClient[] = []
  connectCalls: Array<{ from: SeqAddress; to: SeqAddress }> = []
  listError: Error | null = null
  connectError: Error | null = null

  async listClients(): Promise<SeqClient[]> {
    if (this.listError) throw this.listError
    return structuredClone(this.clients)
  }

  async connect(from: SeqAddress, to: SeqAddress): Promise<void> {
    this.connectCalls.push({
      from: { clientId: from.clientId, portId: from.portId },
      to: { clientId: to.clientId, portId: to.portId },
    })
    if (this.connectError) throw this.connectError
    this.clients
      .find((c) => c.id === from.clientId)
      ?.ports.find((p) => p.portId === from.portId)
      ?.connectingTo.push({ clientId: to.clientId, portId: to.portId })
  }

  remove(clientId: number): void {
    this.clients = this.clients.filter((c) => c.id !== clientId)
  }
}

class SpyPublisher implements EventPublisherPort {
  events: KeyStackEvent[] = []
  publish(event: KeyStackEvent): void {
    this.events.push(event)
  }
  types(): string[] {
    return this.events.map((e) => e.type)
  }
  take(): KeyStackEvent[] {
    const taken = this.events
    this.events = []
    return taken
  }
}

class FakeClock implements ClockPort {
  time = Date.parse("2026-01-01T00:00:00.000Z")
  scheduled: Array<{ fn: () => void; ms: number }> = []
  now(): Date {
    return new Date(this.time)
  }
  schedule(fn: () => void, ms: number): () => void {
    const entry = { fn, ms }
    this.scheduled.push(entry)
    return () => {
      this.scheduled = this.scheduled.filter((e) => e !== entry)
    }
  }
}

class SpyLogger implements LoggerPort {
  lines: string[] = []
  info(message: string) {
    this.lines.push(`info ${message}`)
  }
  warn(message: string) {
    this.lines.push(`warn ${message}`)
  }
  error(message: string) {
    this.lines.push(`error ${message}`)
  }
}

const options = {
  keyboardClientPrefix: "Launchkey",
  keyboardPortMatch: "MIDI In",
  synthClientPrefix: "FLUID Synth",
  pollIntervalMs: 500,
}

let sequencer: FakeSequencer
let publisher: SpyPublisher
let clock: FakeClock
let logger: SpyLogger
let reconciler: MidiConnectionReconciler

beforeEach(() => {
  sequencer = new FakeSequencer()
  publisher = new SpyPublisher()
  clock = new FakeClock()
  logger = new SpyLogger()
  reconciler = new MidiConnectionReconciler(
    sequencer,
    publisher,
    options,
    clock,
    logger
  )
})

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe("MidiConnectionReconciler", () => {
  it("starts with nothing present", () => {
    expect(reconciler.getStatus()).toEqual({
      keyboard: { present: false },
      synth: { present: false },
      routed: false,
      lastChangedAt: "2026-01-01T00:00:00.000Z",
    })
  })

  it("1. connects once when both are present and not routed", async () => {
    sequencer.clients = [launchkey(), fluid()]
    clock.time += 1000

    await reconciler.tick()

    expect(sequencer.connectCalls).toEqual([
      { from: { clientId: 20, portId: 0 }, to: { clientId: 128, portId: 0 } },
    ])
    const status = {
      keyboard: { present: true, name: "Launchkey Mini MK4 37" },
      synth: { present: true, name: "FLUID Synth (2547)" },
      routed: true,
      lastChangedAt: "2026-01-01T00:00:01.000Z",
    }
    expect(reconciler.getStatus()).toEqual(status)
    expect(publisher.events).toEqual([
      { type: "midi.status", status },
      { type: "midi.route.established" },
      { type: "midi.keyboard.connected", name: "Launchkey Mini MK4 37" },
    ])
  })

  it("2. does nothing on repeated ticks once routed", async () => {
    sequencer.clients = [launchkey(), fluid()]
    await reconciler.tick()
    const before = reconciler.getStatus()
    publisher.take()
    clock.time += 5000

    await reconciler.tick()
    await reconciler.tick()

    expect(sequencer.connectCalls).toHaveLength(1)
    expect(publisher.events).toEqual([])
    expect(reconciler.getStatus()).toBe(before)
  })

  it("2b. detects a route that already exists at startup without reconnecting", async () => {
    const keyboard = launchkey()
    keyboard.ports[0].connectingTo.push({ clientId: 128, portId: 0 })
    sequencer.clients = [keyboard, fluid()]

    await reconciler.tick()
    await reconciler.tick()

    expect(sequencer.connectCalls).toEqual([])
    expect(reconciler.getStatus().routed).toBe(true)
    expect(publisher.types()).toEqual([
      "midi.status",
      "midi.keyboard.connected",
    ])
  })

  it("3. reports the keyboard disappearing", async () => {
    sequencer.clients = [launchkey(), fluid()]
    await reconciler.tick()
    publisher.take()

    sequencer.remove(20)
    await reconciler.tick()

    expect(publisher.events).toEqual([
      {
        type: "midi.status",
        status: {
          keyboard: { present: false },
          synth: { present: true, name: "FLUID Synth (2547)" },
          routed: false,
          lastChangedAt: clock.now().toISOString(),
        },
      },
      { type: "midi.keyboard.disconnected" },
    ])
    expect(sequencer.connectCalls).toHaveLength(1)
  })

  it("4. reconnects when the keyboard reappears, even with a new client id", async () => {
    sequencer.clients = [launchkey(), fluid()]
    await reconciler.tick()
    sequencer.remove(20)
    await reconciler.tick()
    publisher.take()

    sequencer.clients.push(launchkey(24))
    await reconciler.tick()

    expect(sequencer.connectCalls.at(-1)).toEqual({
      from: { clientId: 24, portId: 0 },
      to: { clientId: 128, portId: 0 },
    })
    expect(sequencer.connectCalls).toHaveLength(2)
    expect(publisher.types()).toEqual([
      "midi.status",
      "midi.route.established",
      "midi.keyboard.connected",
    ])
    expect(reconciler.getStatus().routed).toBe(true)
  })

  it("5. reconnects to the new client id when the synth restarts", async () => {
    sequencer.clients = [launchkey(), fluid(128, 2547)]
    await reconciler.tick()
    publisher.take()

    // FluidSynth dies: the kernel drops its client and the subscription.
    sequencer.clients = [launchkey()]
    await reconciler.tick()
    expect(reconciler.getStatus()).toMatchObject({
      keyboard: { present: true },
      synth: { present: false },
      routed: false,
    })
    expect(publisher.take().map((e) => e.type)).toEqual(["midi.status"])

    sequencer.clients.push(fluid(129, 3001))
    await reconciler.tick()

    expect(sequencer.connectCalls.at(-1)).toEqual({
      from: { clientId: 20, portId: 0 },
      to: { clientId: 129, portId: 0 },
    })
    expect(reconciler.getStatus()).toMatchObject({
      synth: { present: true, name: "FLUID Synth (3001)" },
      routed: true,
    })
    expect(publisher.types()).toEqual(["midi.status", "midi.route.established"])
  })

  it("6. publishes route.failed when connect throws, then retries", async () => {
    sequencer.clients = [launchkey(), fluid()]
    sequencer.connectError = new Error("Connection failed (Permission denied)")

    await expect(reconciler.tick()).resolves.toBeUndefined()

    expect(reconciler.getStatus()).toMatchObject({
      keyboard: { present: true },
      synth: { present: true },
      routed: false,
    })
    expect(publisher.take()).toContainEqual({
      type: "midi.route.failed",
      reason: "Connection failed (Permission denied)",
    })

    // Same failure again: retried, but not re-announced.
    await reconciler.tick()
    expect(sequencer.connectCalls).toHaveLength(2)
    expect(publisher.take()).toEqual([])

    sequencer.connectError = null
    await reconciler.tick()
    expect(sequencer.connectCalls).toHaveLength(3)
    expect(reconciler.getStatus().routed).toBe(true)
    expect(publisher.types()).toEqual(["midi.status", "midi.route.established"])
  })

  it("7. logs and keeps going when listClients throws", async () => {
    sequencer.clients = [launchkey(), fluid()]
    await reconciler.tick()
    const before = reconciler.getStatus()
    publisher.take()

    sequencer.listError = new Error("aconnect -l timed out after 2000ms")
    await expect(reconciler.tick()).resolves.toBeUndefined()
    await reconciler.tick()

    expect(publisher.events).toEqual([])
    expect(reconciler.getStatus()).toBe(before)
    expect(logger.lines.filter((l) => l.startsWith("error"))).toEqual([
      "error Could not list ALSA sequencer clients: aconnect -l timed out after 2000ms",
    ])

    sequencer.listError = null
    sequencer.remove(20)
    await reconciler.tick()
    expect(publisher.types()).toEqual([
      "midi.status",
      "midi.keyboard.disconnected",
    ])
  })

  it("does not try to connect when only the keyboard is present", async () => {
    sequencer.clients = [launchkey()]
    await reconciler.tick()

    expect(sequencer.connectCalls).toEqual([])
    expect(reconciler.getStatus()).toMatchObject({
      keyboard: { present: true, name: "Launchkey Mini MK4 37" },
      synth: { present: false },
      routed: false,
    })
  })

  it("does not try to connect when only the synth is present", async () => {
    sequencer.clients = [fluid()]
    await reconciler.tick()

    expect(sequencer.connectCalls).toEqual([])
    expect(reconciler.getStatus()).toMatchObject({
      keyboard: { present: false },
      synth: { present: true, name: "FLUID Synth (2547)" },
      routed: false,
    })
    expect(publisher.types()).toEqual(["midi.status"])
  })

  describe("start / stop", () => {
    it("schedules the next tick only after the current one finishes", async () => {
      sequencer.clients = [launchkey(), fluid()]

      reconciler.start()
      reconciler.start()
      expect(clock.scheduled).toHaveLength(0)
      await flush()

      expect(sequencer.connectCalls).toHaveLength(1)
      expect(clock.scheduled.map((s) => s.ms)).toEqual([500])

      sequencer.remove(20)
      clock.scheduled.shift()!.fn()
      await flush()

      expect(reconciler.getStatus().keyboard.present).toBe(false)
      expect(clock.scheduled).toHaveLength(1)
    })

    it("stop cancels the pending tick and prevents rescheduling", async () => {
      reconciler.start()
      await flush()
      reconciler.stop()
      expect(clock.scheduled).toHaveLength(0)

      // stop during an in-flight tick
      reconciler.start()
      reconciler.stop()
      await flush()
      expect(clock.scheduled).toHaveLength(0)
    })
  })
})
