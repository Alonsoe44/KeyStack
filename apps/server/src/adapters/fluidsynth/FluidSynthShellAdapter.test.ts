import { type AddressInfo, createServer, type Server } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import { FluidSynthShellAdapter } from "./FluidSynthShellAdapter"

let server: Server | undefined
afterEach(() => server?.close())

/**
 * A stand-in for FluidSynth's shell: records each line, answers `echo` like
 * FluidSynth does, and prints `unknown command` for lines in `unknown`.
 */
async function fakeShell(unknown: string[] = []): Promise<{ port: number; lines: string[]; closedByClient: () => boolean }> {
  const lines: string[] = []
  let clientClosed = false
  server = createServer((socket) => {
    let buffer = ""
    socket.on("error", () => {
      clientClosed = true
    })
    socket.on("close", () => {
      clientClosed = true
    })
    socket.on("data", (chunk) => {
      buffer += chunk.toString()
      const parts = buffer.split("\n")
      buffer = parts.pop() ?? ""
      for (const line of parts) {
        lines.push(line)
        const echo = line.match(/^echo (.*)$/)
        if (echo) socket.write(`${echo[1]}\n`)
        else if (unknown.includes(line)) socket.write(`unknown command: ${line} (try help)\n`)
      }
    })
  })
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve))
  return { port: (server.address() as AddressInfo).port, lines, closedByClient: () => clientClosed }
}

const commandsOnly = (lines: string[]) => lines.filter((line) => !line.startsWith("echo "))

describe("FluidSynthShellAdapter", () => {
  it("sets the program on every channel except percussion, then closes itself", async () => {
    const shell = await fakeShell()

    await new FluidSynthShellAdapter(shell.port).setProgram(4)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const commands = commandsOnly(shell.lines)
    expect(commands).toHaveLength(15)
    expect(commands).toContain("prog 0 4")
    expect(commands).toContain("prog 15 4")
    expect(commands).not.toContain("prog 9 4")
    // Never `quit`: FluidSynth closing first would leave its port in TIME_WAIT.
    expect(shell.lines).not.toContain("quit")
    expect(shell.closedByClient()).toBe(true)
  })

  it("sets the gain through the live synth.gain setting", async () => {
    const shell = await fakeShell()

    await new FluidSynthShellAdapter(shell.port).setGain(0.4)

    expect(commandsOnly(shell.lines)).toEqual(["set synth.gain 0.400"])
  })

  it("reports a synth that is not running", async () => {
    const shell = await fakeShell()
    server!.close()

    await expect(new FluidSynthShellAdapter(shell.port).setProgram(0)).rejects.toThrow("The synth is not running")
  })

  it("reports errors printed by the shell", async () => {
    const shell = await fakeShell(["prog 0 0"])

    await expect(new FluidSynthShellAdapter(shell.port).setProgram(0)).rejects.toThrow("unknown command: prog 0 0")
  })

  it("times out when the shell never answers", async () => {
    // Never answers; swallows the reset the adapter sends when it gives up.
    server = createServer((socket) => socket.on("error", () => {}))
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve))
    const port = (server.address() as AddressInfo).port

    await expect(new FluidSynthShellAdapter(port, "127.0.0.1", 100).setProgram(0)).rejects.toThrow("timed out")
  })

  it("refuses programs outside 0-127 without connecting", async () => {
    const shell = await fakeShell()

    await expect(new FluidSynthShellAdapter(shell.port).setProgram(128)).rejects.toThrow("Invalid MIDI program")
    expect(shell.lines).toHaveLength(0)
  })
})
