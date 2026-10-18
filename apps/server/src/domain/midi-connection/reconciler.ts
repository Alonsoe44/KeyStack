import type { KeyStackEvent } from "keystack-shared"
import type { ClockPort } from "../../ports/ClockPort"
import type { EventPublisherPort } from "../../ports/EventPublisherPort"
import type { LoggerPort } from "../../ports/LoggerPort"
import type { SequencerPort } from "../../ports/SequencerPort"
import { findKeyboardPort, findSynthPort, isRouted } from "./matching"
import type { MidiConnectionStatus } from "./types"

export type ReconcilerOptions = {
  keyboardClientPrefix: string
  keyboardPortMatch: string
  synthClientPrefix: string
  pollIntervalMs: number
}

type StatusFields = Omit<MidiConnectionStatus, "lastChangedAt">

function sameStatus(a: StatusFields, b: StatusFields): boolean {
  return (
    a.keyboard.present === b.keyboard.present &&
    a.keyboard.name === b.keyboard.name &&
    a.synth.present === b.synth.present &&
    a.synth.name === b.synth.name &&
    a.routed === b.routed
  )
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Keeps the keyboard's MIDI In port subscribed to the synth's port 0 by
 * comparing desired vs. actual sequencer state on every tick. Ticks are
 * idempotent: when nothing changed, nothing is connected or published.
 */
export class MidiConnectionReconciler {
  private status: MidiConnectionStatus
  private running = false
  private cancelNext: (() => void) | null = null
  // Repeated identical failures are reported once, not on every tick.
  private lastListError: string | null = null
  private lastRouteError: string | null = null

  constructor(
    private readonly sequencer: SequencerPort,
    private readonly publisher: EventPublisherPort,
    private readonly options: ReconcilerOptions,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort
  ) {
    this.status = {
      keyboard: { present: false },
      synth: { present: false },
      routed: false,
      lastChangedAt: clock.now().toISOString(),
    }
  }

  getStatus(): MidiConnectionStatus {
    return this.status
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.loop()
  }

  stop(): void {
    this.running = false
    this.cancelNext?.()
    this.cancelNext = null
  }

  // Self-scheduling so ticks never overlap, even if aconnect is slow.
  private async loop(): Promise<void> {
    try {
      await this.tick()
    } catch (err) {
      this.logger.error(`Reconcile tick failed: ${errorMessage(err)}`)
    }
    if (!this.running) return
    this.cancelNext = this.clock.schedule(
      () => void this.loop(),
      this.options.pollIntervalMs
    )
  }

  async tick(): Promise<void> {
    let clients
    try {
      clients = await this.sequencer.listClients()
    } catch (err) {
      const message = errorMessage(err)
      if (message !== this.lastListError) {
        this.logger.error(`Could not list ALSA sequencer clients: ${message}`)
        this.lastListError = message
      }
      return
    }
    if (this.lastListError !== null) {
      this.logger.info("Listing ALSA sequencer clients works again")
      this.lastListError = null
    }

    const keyboardPort = findKeyboardPort(clients, {
      clientPrefix: this.options.keyboardClientPrefix,
      portMatch: this.options.keyboardPortMatch,
    })
    const synthPort = findSynthPort(clients, this.options.synthClientPrefix)
    let routed =
      !!keyboardPort && !!synthPort && isRouted(keyboardPort, synthPort)

    const events: KeyStackEvent[] = []

    if (keyboardPort && synthPort && !routed) {
      const from = `${keyboardPort.clientId}:${keyboardPort.portId}`
      const to = `${synthPort.clientId}:${synthPort.portId}`
      try {
        await this.sequencer.connect(keyboardPort, synthPort)
        // Trusted until the next tick re-reads the real subscription.
        routed = true
        this.lastRouteError = null
        this.logger.info(
          `Route established: '${keyboardPort.portName}' (${from}) -> '${synthPort.clientName}' (${to})`
        )
        events.push({ type: "midi.route.established" })
      } catch (err) {
        const reason = errorMessage(err)
        if (reason !== this.lastRouteError) {
          this.logger.error(`Route ${from} -> ${to} failed: ${reason}`)
          this.lastRouteError = reason
          events.push({ type: "midi.route.failed", reason })
        }
      }
    } else {
      this.lastRouteError = null
    }

    const previous = this.status
    const next: StatusFields = {
      keyboard: keyboardPort
        ? { present: true, name: keyboardPort.clientName }
        : { present: false },
      synth: synthPort
        ? { present: true, name: synthPort.clientName }
        : { present: false },
      routed,
    }

    if (!sameStatus(previous, next)) {
      this.status = { ...next, lastChangedAt: this.clock.now().toISOString() }
      this.logChanges(previous, next)

      if (next.keyboard.present && !previous.keyboard.present) {
        events.push({
          type: "midi.keyboard.connected",
          name: next.keyboard.name ?? "",
        })
      } else if (!next.keyboard.present && previous.keyboard.present) {
        events.push({ type: "midi.keyboard.disconnected" })
      }
      // Snapshot first, so a client that only handles midi.status converges.
      events.unshift({ type: "midi.status", status: this.status })
    }

    for (const event of events) this.publisher.publish(event)
  }

  private logChanges(previous: StatusFields, next: StatusFields): void {
    if (next.keyboard.present && !previous.keyboard.present) {
      this.logger.info(`Keyboard connected: '${next.keyboard.name}'`)
    } else if (!next.keyboard.present && previous.keyboard.present) {
      this.logger.warn(`Keyboard disconnected: '${previous.keyboard.name}'`)
    }
    if (next.synth.name !== previous.synth.name) {
      if (next.synth.present) {
        this.logger.info(`Synth detected: '${next.synth.name}'`)
      } else {
        this.logger.warn(`Synth gone: '${previous.synth.name}'`)
      }
    }
    if (previous.routed && !next.routed) {
      this.logger.warn("Route lost")
    } else if (!previous.routed && next.routed) {
      this.logger.info("Route active")
    }
  }
}
