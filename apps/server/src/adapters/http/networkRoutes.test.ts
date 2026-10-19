import type { AddressInfo } from "node:net"
import express from "express"
import type { NetworkError, NetworkStatusResponse } from "keystack-shared"
import { afterEach, describe, expect, it } from "vitest"
import { NetworkPortError, type NetworkPort } from "../../ports/NetworkPort"
import { networkRoutes } from "./networkRoutes"

const silentLogger = { info() {}, warn() {}, error() {} }
const status: NetworkStatusResponse = { wifi: { ssid: "Phone", signal: 70 }, connectivity: "full", hotspot: { ssid: "Phone" } }

let close: (() => void) | undefined
afterEach(() => close?.())

function port(overrides: Partial<NetworkPort> = {}): NetworkPort & { saved: [string, string | null][] } {
  const saved: [string, string | null][] = []
  return {
    saved,
    status: async () => status,
    nearby: async () => [{ ssid: "Phone", signal: 70, secured: true }],
    saveHotspot: async (ssid, password) => void saved.push([ssid, password]),
    connectHotspot: async () => {},
    ...overrides,
  }
}

async function serve(network: NetworkPort): Promise<string> {
  const app = express().use("/api/v1", networkRoutes(network, silentLogger))
  const server = app.listen(0)
  close = () => server.close()
  await new Promise((resolve) => server.once("listening", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/network`
}

const send = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
const code = async (res: Response) => ((await res.json()) as NetworkError).error.code

describe("network routes", () => {
  it("reports status and nearby networks", async () => {
    const url = await serve(port())

    expect(await (await fetch(url)).json()).toEqual(status)
    expect(await (await fetch(`${url}/nearby`)).json()).toEqual({ networks: [{ ssid: "Phone", signal: 70, secured: true }] })
  })

  it("saves the hotspot and never echoes the password", async () => {
    const network = port()
    const url = await serve(network)

    const res = await fetch(`${url}/hotspot`, send("PUT", { ssid: "Emiliano’s iPhone", password: "secret-pass" }))

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain("secret-pass")
    expect(JSON.parse(text)).toEqual({ status })
    expect(network.saved).toEqual([["Emiliano’s iPhone", "secret-pass"]])
  })

  it("keeps the saved password when none is sent", async () => {
    const network = port()
    const url = await serve(network)

    await fetch(`${url}/hotspot`, send("PUT", { ssid: "Phone" }))

    expect(network.saved).toEqual([["Phone", null]])
  })

  it("rejects bad names, short passwords and non-JSON requests", async () => {
    const network = port()
    const url = await serve(network)

    const empty = await fetch(`${url}/hotspot`, send("PUT", { ssid: "", password: "secret-pass" }))
    const long = await fetch(`${url}/hotspot`, send("PUT", { ssid: "x".repeat(33), password: "secret-pass" }))
    const newline = await fetch(`${url}/hotspot`, send("PUT", { ssid: "a\nb", password: "secret-pass" }))
    const short = await fetch(`${url}/hotspot`, send("PUT", { ssid: "Phone", password: "short" }))
    const form = await fetch(`${url}/hotspot/connect`, { method: "POST", body: "a=1", headers: { "Content-Type": "application/x-www-form-urlencoded" } })

    for (const res of [empty, long, newline, short, form]) {
      expect(res.status).toBe(400)
      expect(await code(res)).toBe("INVALID_REQUEST")
    }
    expect(network.saved).toEqual([])
  })

  it("maps connection failures to their codes", async () => {
    const url = await serve(
      port({
        connectHotspot: async () => {
          throw new NetworkPortError("WRONG_PASSWORD", 'Wrong password for "Phone"')
        },
      })
    )

    const res = await fetch(`${url}/hotspot/connect`, send("POST", {}))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: { code: "WRONG_PASSWORD", message: 'Wrong password for "Phone"' } })
  })

  it("answers BUSY to a second connect while the first is running", async () => {
    let finish = () => {}
    const url = await serve(port({ connectHotspot: () => new Promise<void>((resolve) => (finish = resolve)) }))

    const first = fetch(`${url}/hotspot/connect`, send("POST", {}))
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = await fetch(`${url}/hotspot/connect`, send("POST", {}))
    finish()

    expect(second.status).toBe(409)
    expect(await code(second)).toBe("BUSY")
    expect((await first).status).toBe(200)
  })
})
