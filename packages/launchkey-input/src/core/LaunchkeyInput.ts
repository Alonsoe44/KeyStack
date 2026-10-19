import { DAW_MODE_EXIT, DAW_MODE_SETUP, decodeLaunchkeyMessage } from "./decode"
import { Emitter } from "./emitter"
import { MidiStreamParser } from "./midiStream"
import type {
  ConnectionStatus,
  LaunchkeyInputEvents,
  MidiConnection,
  MidiTransport,
} from "./types"

// Declared here rather than taken from Node's or the DOM's types, so the
// core type-checks against neither and runs under both.
declare const setTimeout: (fn: () => void, ms: number) => unknown
declare const clearTimeout: (handle: unknown) => void

export type Scheduler = {
  now(): number
  /** Runs `fn` once after `ms`; returns a function that cancels it. */
  schedule(fn: () => void, ms: number): () => void
}

export const defaultScheduler: Scheduler = {
  now: () => Date.now(),
  schedule(fn, ms) {
    const handle = setTimeout(fn, ms)
    return () => clearTimeout(handle)
  },
}

export type LaunchkeyInputOptions = {
  transport: MidiTransport
  /** How often to look for the controller while it is not connected. */
  searchIntervalMs?: number
  scheduler?: Scheduler
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Finds the Launchkey, puts it in DAW mode and emits `control` events for its
 * buttons, pads and knobs. Survives the controller being missing at start,
 * unplugged and plugged back in; `start()` never throws for any of that, it
 * emits a `status` event instead.
 */
export class LaunchkeyInput {
  private readonly emitter = new Emitter<LaunchkeyInputEvents>()
  private readonly transport: MidiTransport
  private readonly searchIntervalMs: number
  private readonly scheduler: Scheduler
  private status: ConnectionStatus = { state: "disconnected" }
  private connection: MidiConnection | null = null
  private running = false
  // Bumped by stop(), so work started before it is dropped when it finishes.
  private generation = 0
  private cancelNext: (() => void) | null = null

  constructor(options: LaunchkeyInputOptions) {
    this.transport = options.transport
    this.searchIntervalMs = options.searchIntervalMs ?? 2000
    this.scheduler = options.scheduler ?? defaultScheduler
  }

  on<K extends keyof LaunchkeyInputEvents>(
    type: K,
    listener: (value: LaunchkeyInputEvents[K]) => void
  ): () => void {
    return this.emitter.on(type, listener)
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    await this.search(this.generation)
  }

  /** Puts the controller back in standalone mode and stops listening. */
  async stop(): Promise<void> {
    this.running = false
    this.generation++
    this.cancelNext?.()
    this.cancelNext = null
    const connection = this.connection
    this.connection = null
    if (connection) {
      // Best effort: the controller may already be gone.
      await connection.send(DAW_MODE_EXIT).catch(() => {})
      await connection.close().catch(() => {})
    }
    this.setStatus({ state: "disconnected" })
  }

  private scheduleSearch(generation: number): void {
    if (!this.running || generation !== this.generation) return
    this.cancelNext = this.scheduler.schedule(() => {
      this.cancelNext = null
      void this.search(generation)
    }, this.searchIntervalMs)
  }

  private async search(generation: number): Promise<void> {
    let port: string | null
    try {
      port = await this.transport.findPort()
    } catch (err) {
      if (generation !== this.generation) return
      this.setStatus({ state: "error", message: errorMessage(err) })
      this.scheduleSearch(generation)
      return
    }
    if (generation !== this.generation) return
    if (port === null) {
      this.setStatus({ state: "disconnected" })
      this.scheduleSearch(generation)
      return
    }
    await this.connect(port, generation)
  }

  private async connect(port: string, generation: number): Promise<void> {
    const parser = new MidiStreamParser()
    const link = { connection: null as MidiConnection | null, closed: false }
    let connection: MidiConnection
    try {
      connection = await this.transport.open(port, {
        data: (bytes) =>
          parser.push(bytes, (message) => {
            if (generation !== this.generation) return
            const event = decodeLaunchkeyMessage(message, this.scheduler.now())
            if (event) this.emitter.emit("control", event)
          }),
        closed: () => {
          link.closed = true
          if (link.connection && this.connection === link.connection) {
            this.connection = null
            this.setStatus({ state: "disconnected" })
            this.scheduleSearch(generation)
          }
        },
      })
      link.connection = connection
      if (generation !== this.generation) {
        await connection.close().catch(() => {})
        return
      }
      await connection.send(DAW_MODE_SETUP)
    } catch (err) {
      if (link.connection) await link.connection.close().catch(() => {})
      if (generation !== this.generation) return
      this.setStatus({ state: "error", message: errorMessage(err) })
      this.scheduleSearch(generation)
      return
    }
    if (generation !== this.generation) {
      await connection.close().catch(() => {})
      return
    }
    if (link.closed) {
      // The port went away while it was being set up.
      this.setStatus({ state: "disconnected" })
      this.scheduleSearch(generation)
      return
    }
    this.connection = connection
    this.setStatus({ state: "connected", port })
  }

  private setStatus(status: ConnectionStatus): void {
    if (JSON.stringify(status) === JSON.stringify(this.status)) return
    this.status = status
    this.emitter.emit("status", status)
  }
}
