import type {
  MidiConnection,
  MidiConnectionHandlers,
  MidiTransport,
} from "./types"

/**
 * An in-memory transport for tests: plug and unplug a pretend controller,
 * play bytes into it and see what the library sent back.
 */
export class FakeTransport implements MidiTransport {
  /** The port findPort() reports; null means nothing is plugged in. */
  port: string | null = null
  /** Thrown by findPort() while set, as a missing `amidi` would. */
  findError: Error | null = null
  /** Every message sent, in order, across all connections. */
  readonly sent: Uint8Array[] = []
  private handlers: MidiConnectionHandlers | null = null
  private open_ = false

  get isOpen(): boolean {
    return this.open_
  }

  async findPort(): Promise<string | null> {
    if (this.findError) throw this.findError
    return this.port
  }

  async open(
    port: string,
    handlers: MidiConnectionHandlers
  ): Promise<MidiConnection> {
    if (port !== this.port) throw new Error(`No such port: ${port}`)
    this.handlers = handlers
    this.open_ = true
    return {
      send: async (bytes) => {
        if (!this.open_) throw new Error("Port is closed")
        this.sent.push(bytes)
      },
      close: async () => {
        this.open_ = false
        this.handlers = null
      },
    }
  }

  /** Bytes as the controller would send them. */
  play(bytes: ArrayLike<number>): void {
    this.handlers?.data(Uint8Array.from(bytes))
  }

  /** The controller is pulled out while connected. */
  unplug(): void {
    this.port = null
    const handlers = this.handlers
    this.open_ = false
    this.handlers = null
    handlers?.closed("unplugged")
  }
}
