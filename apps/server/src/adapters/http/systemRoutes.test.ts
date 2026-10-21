import type { AddressInfo } from "node:net"
import express from "express"
import { afterEach, describe, expect, it } from "vitest"
import type { SystemPowerPort } from "../../ports/SystemPowerPort"
import { systemRoutes } from "./systemRoutes"

const silentLogger = { info() {}, warn() {}, error() {} }

let close: (() => void) | undefined
afterEach(() => close?.())

async function serve(power: SystemPowerPort): Promise<string> {
  const app = express().use("/api", systemRoutes(power, silentLogger))
  const server = app.listen(0)
  close = () => server.close()
  await new Promise((resolve) => server.once("listening", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/system/poweroff`
}

const json = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
}

describe("POST /api/system/poweroff", () => {
  it("powers off once and reports success", async () => {
    let calls = 0
    const url = await serve({ powerOff: async () => void calls++ })

    const res = await fetch(url, json)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(calls).toBe(1)
  })

  it("rejects requests that are not JSON without powering off", async () => {
    let calls = 0
    const url = await serve({ powerOff: async () => void calls++ })

    const plain = await fetch(url, { method: "POST" })
    const form = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "a=1",
    })

    expect(plain.status).toBe(415)
    expect(form.status).toBe(415)
    expect(calls).toBe(0)
  })

  it("does not power off on GET", async () => {
    let calls = 0
    const url = await serve({ powerOff: async () => void calls++ })

    expect((await fetch(url)).status).toBe(404)
    expect(calls).toBe(0)
  })

  it("reports the reason when powering off fails", async () => {
    const url = await serve({
      powerOff: async () => {
        throw new Error("systemctl poweroff: Access denied")
      },
    })

    const res = await fetch(url, json)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      ok: false,
      error: "systemctl poweroff: Access denied",
    })
  })
})
