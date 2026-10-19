import type { AddressInfo } from "node:net"
import express from "express"
import type { InstrumentStateResponse } from "keystack-shared"
import { afterEach, describe, expect, it } from "vitest"
import { InstrumentService } from "../../domain/instruments/instruments"
import type { SynthControlPort } from "../../ports/SynthControlPort"
import { instrumentRoutes } from "./instrumentRoutes"

const state = async (url: string) => (await (await fetch(url)).json()) as InstrumentStateResponse

const silentLogger = { info() {}, warn() {}, error() {} }

let close: (() => void) | undefined
afterEach(() => close?.())

async function serve(synth: SynthControlPort): Promise<string> {
  const app = express().use("/api", instrumentRoutes(new InstrumentService(synth, silentLogger)))
  const server = app.listen(0)
  close = () => server.close()
  await new Promise((resolve) => server.once("listening", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/instruments`
}

const post = (url: string, body: unknown, contentType = "application/json") =>
  fetch(`${url}/select`, { method: "POST", headers: { "Content-Type": contentType }, body: JSON.stringify(body) })

describe("instrument routes", () => {
  it("reports the selected voice", async () => {
    const url = await serve({ async setProgram() {}, async setGain() {} })

    expect(await (await fetch(url)).json()).toEqual({ selected: "piano", volume: 63 })
  })

  it("sets the volume and rejects out-of-range values", async () => {
    const gains: number[] = []
    const url = await serve({ async setProgram() {}, async setGain(gain) { gains.push(gain) } })
    const volume = (body: unknown) =>
      fetch(`${url}/volume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

    expect((await volume({ volume: 50 })).status).toBe(200)
    expect((await volume({ volume: 101 })).status).toBe(400)
    expect((await volume({ volume: "50" })).status).toBe(400)
    expect(gains).toEqual([0.4])
    expect((await state(url)).volume).toBe(50)
  })

  it("selects a voice and reports it afterwards", async () => {
    const programs: number[] = []
    const url = await serve({ async setProgram(program) { programs.push(program) }, async setGain() {} })

    const res = await post(url, { instrumentId: "electric-piano" })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(programs).toEqual([4])
    expect((await state(url)).selected).toBe("electric-piano")
  })

  it("rejects unknown voices and non-JSON requests without touching the synth", async () => {
    let calls = 0
    const url = await serve({ async setProgram() { calls++ }, async setGain() { calls++ } })

    expect((await post(url, { instrumentId: "organ" })).status).toBe(400)
    expect((await post(url, {})).status).toBe(400)
    expect((await post(url, { instrumentId: "piano" }, "text/plain")).status).toBe(415)
    expect(calls).toBe(0)
  })

  it("answers 503 with the reason when the synth is down", async () => {
    const url = await serve({ async setProgram() { throw new Error("The synth is not running") }, async setGain() { throw new Error("The synth is not running") } })

    const res = await post(url, { instrumentId: "electric-piano" })

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: "The synth is not running" })
    expect((await state(url)).selected).toBe("piano")
  })
})
