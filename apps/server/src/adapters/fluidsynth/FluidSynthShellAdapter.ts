import { Socket } from "node:net"
import type { SynthControlPort } from "../../ports/SynthControlPort"

// Channel 10 (index 9) is General MIDI percussion; leave its drum kit alone.
const MELODIC_CHANNELS = Array.from({ length: 16 }, (_, channel) => channel).filter((channel) => channel !== 9)

// Printed back by the shell's `echo` once every command before it has run.
const DONE_MARKER = "__keystack_done__"

/**
 * Talks to FluidSynth's command shell (`fluidsynth -s`, `shell.port`). Each
 * call opens a connection, sends its commands and an `echo` marker, waits
 * for the marker, then resets the connection.
 *
 * Closing it this way matters: FluidSynth binds its shell port without
 * SO_REUSEADDR, so if FluidSynth closed the connection (as it does on
 * `quit`), the port would sit in TIME_WAIT for a minute and a FluidSynth
 * restart in that window could not open its shell, and would exit.
 */
export class FluidSynthShellAdapter implements SynthControlPort {
  constructor(
    private readonly port = 9800,
    private readonly host = "127.0.0.1",
    private readonly timeoutMs = 2000
  ) {}

  setProgram(program: number): Promise<void> {
    if (!Number.isInteger(program) || program < 0 || program > 127) {
      return Promise.reject(new Error(`Invalid MIDI program ${program}`))
    }
    return this.run(MELODIC_CHANNELS.map((channel) => `prog ${channel} ${program}`))
  }

  setGain(gain: number): Promise<void> {
    if (!Number.isFinite(gain) || gain < 0 || gain > 10) {
      return Promise.reject(new Error(`Invalid gain ${gain}`))
    }
    // `synth.gain` is a live setting; the shell's own `gain` command doesn't
    // update it on FluidSynth 2.4.
    return this.run([`set synth.gain ${gain.toFixed(3)}`])
  }

  private run(commands: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket()
      let output = ""
      let settled = false
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        // RST rather than FIN: no TIME_WAIT is left on either side.
        if (!socket.destroyed) socket.resetAndDestroy()
        if (error) reject(error)
        else resolve()
      }

      socket.setTimeout(this.timeoutMs, () => finish(new Error("FluidSynth shell timed out")))
      socket.on("error", (err: NodeJS.ErrnoException) =>
        finish(
          new Error(
            err.code === "ECONNREFUSED"
              ? "The synth is not running"
              : `FluidSynth shell: ${err.message}`
          )
        )
      )
      socket.on("data", (chunk) => {
        output += chunk.toString()
        const lines = output.split("\n").map((line) => line.trim())
        const done = lines.indexOf(DONE_MARKER)
        if (done === -1) return
        const failure = lines.slice(0, done).find((line) => /error|unknown command|invalid/i.test(line))
        finish(failure ? new Error(`FluidSynth: ${failure}`) : undefined)
      })
      socket.on("close", () => finish(new Error("FluidSynth closed the shell connection")))
      socket.connect(this.port, this.host, () => {
        socket.write(`${[...commands, `echo ${DONE_MARKER}`].join("\n")}\n`)
      })
    })
  }
}
