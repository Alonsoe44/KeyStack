import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { AmidiTransport } from "./AmidiTransport"

const fakeAmidi = fileURLToPath(new URL("./__testbin__/fake-amidi.sh", import.meta.url))

let dir: string
let log: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fake-amidi-"))
  log = path.join(dir, "calls.log")
  process.env.FAKE_AMIDI_LOG = log
  delete process.env.FAKE_AMIDI_DUMP
  delete process.env.FAKE_AMIDI_UNPLUG
  delete process.env.FAKE_AMIDI_NO_DEVICE
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const calls = () => readFileSync(log, "utf8").trim().split("\n")

describe("AmidiTransport", () => {
  it("finds the DAW port by name", async () => {
    const transport = new AmidiTransport({ binary: fakeAmidi })
    expect(await transport.findPort()).toBe("hw:1,0,1")

    process.env.FAKE_AMIDI_NO_DEVICE = "1"
    expect(await transport.findPort()).toBeNull()
  })

  it("explains a missing amidi", async () => {
    const transport = new AmidiTransport({ binary: path.join(dir, "missing") })
    await expect(transport.findPort()).rejects.toThrow(/not found; install alsa-utils/)
  })

  it("streams bytes, sends with -S and stops amidi on close", async () => {
    process.env.FAKE_AMIDI_DUMP = "\\n9F 0C 7F\\nB0 73 7F\\n"
    const transport = new AmidiTransport({ binary: fakeAmidi })
    const received: number[] = []
    let closedReason: string | null = null
    let gotPlay: () => void = () => {}
    const played = new Promise<void>((resolve) => (gotPlay = resolve))

    const connection = await transport.open("hw:1,0,1", {
      data: (bytes) => {
        received.push(...bytes)
        if (received.length >= 6) gotPlay()
      },
      closed: (reason) => (closedReason = reason),
    })
    await played
    await connection.send(Uint8Array.of(0x9f, 0x0c, 0x00))
    await connection.close()

    expect(received).toEqual([0x9f, 0x0c, 0x7f, 0xb0, 0x73, 0x7f])
    expect(calls()).toEqual(["-p hw:1,0,1 -d", "-p hw:1,0,1 -S 9F 0C 00"])
    expect(closedReason).toBeNull()
  })

  it("reports amidi exiting on its own as closed", async () => {
    process.env.FAKE_AMIDI_UNPLUG = "1"
    const transport = new AmidiTransport({ binary: fakeAmidi })
    const reason = await new Promise<string>((resolve) => {
      void transport.open("hw:1,0,1", { data: () => {}, closed: resolve })
    })
    expect(reason).toBe("amidi exited with code 0")
  })
})
