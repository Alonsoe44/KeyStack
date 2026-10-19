import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import type {
  MidiConnection,
  MidiConnectionHandlers,
  MidiTransport,
} from "../core/types"
import { AmidiDumpParser, parseAmidiList, toAmidiHex } from "./parseAmidi"

const execFileAsync = promisify(execFile)

type ExecError = Error & { code?: string | number; stderr?: string; killed?: boolean }

export type AmidiTransportOptions = {
  /** Substring of the DAW port's name in `amidi -l`. */
  portMatch?: string
  binary?: string
  /** Timeout for each `amidi -l` and `amidi -S` call. */
  timeoutMs?: number
}

/**
 * Reaches the DAW port through ALSA raw MIDI with the `amidi` CLI (from
 * alsa-utils). The ALSA sequencer does not list this port, so `aconnect`
 * and libraries built on the sequencer cannot see it.
 *
 * Receiving runs `amidi -p <port> -d`, which opens the input side only;
 * each send is a separate `amidi -p <port> -S <hex>` on the output side.
 */
export class AmidiTransport implements MidiTransport {
  private readonly portMatch: string
  private readonly binary: string
  private readonly timeoutMs: number

  constructor(options: AmidiTransportOptions = {}) {
    this.portMatch = options.portMatch ?? "Launchkey Mini MK4 37 DAW"
    this.binary = options.binary ?? "amidi"
    this.timeoutMs = options.timeoutMs ?? 2000
  }

  async findPort(): Promise<string | null> {
    const output = await this.run(["-l"])
    const port = parseAmidiList(output).find(
      (p) => p.direction.includes("I") && p.name.includes(this.portMatch)
    )
    return port?.device ?? null
  }

  open(port: string, handlers: MidiConnectionHandlers): Promise<MidiConnection> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, ["-p", port, "-d"], {
        stdio: ["ignore", "pipe", "pipe"],
      })
      const parser = new AmidiDumpParser()
      let stderr = ""
      let started = false
      let closing = false
      const exited = new Promise<void>((done) => child.once("close", () => done()))

      child.stdout.setEncoding("latin1")
      child.stdout.on("data", (chunk: string) => {
        const bytes = parser.push(chunk)
        if (bytes.length > 0) handlers.data(Uint8Array.from(bytes))
      })
      child.stderr.setEncoding("utf8")
      child.stderr.on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(-500)
      })
      child.once("error", (err) => {
        if (!started) reject(this.describe(err as ExecError, ["-p", port, "-d"]))
      })
      child.once("spawn", () => {
        started = true
        resolve({
          send: async (bytes) => {
            await this.run(["-p", port, "-S", toAmidiHex(bytes)])
          },
          close: async () => {
            if (child.exitCode !== null || child.signalCode !== null) return
            closing = true
            child.kill("SIGTERM")
            const timer = setTimeout(() => child.kill("SIGKILL"), 1000)
            await exited
            clearTimeout(timer)
          },
        })
      })
      // amidi exits (with status 0) when the controller is unplugged.
      child.once("close", (code) => {
        if (!started || closing) return
        handlers.closed(stderr.trim() || `amidi exited with code ${code}`)
      })
    })
  }

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(this.binary, args, {
        timeout: this.timeoutMs,
      })
      return stdout
    } catch (err) {
      throw this.describe(err as ExecError, args)
    }
  }

  private describe(err: ExecError, args: string[]): Error {
    const command = `${this.binary} ${args.join(" ")}`
    if (err.code === "ENOENT") {
      return new Error(`${this.binary} not found; install alsa-utils`)
    }
    if (err.killed) return new Error(`${command} timed out after ${this.timeoutMs}ms`)
    return new Error(`${command}: ${err.stderr?.trim() || err.message}`)
  }
}
