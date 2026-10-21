import type { KeyStackEvent } from "keystack-shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subscribeToController, type ControllerSocket } from "./controller-client"

class FakeSocket implements ControllerSocket {
  onopen: (() => void) | null = null
  onmessage: ((message: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  constructor(readonly url: string) {}
  close() {
    this.closed = true
  }
  send(event: KeyStackEvent | string) {
    this.onmessage?.({ data: typeof event === "string" ? event : JSON.stringify(event) })
  }
}

function setup() {
  const sockets: FakeSocket[] = []
  const listener = { onControl: vi.fn(), onStatus: vi.fn(), onOnline: vi.fn() }
  const stop = subscribeToController(listener, {
    basePath: "",
    createSocket: (url) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket
    },
  })
  return { sockets, listener, stop }
}

describe("controller client", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("window", { location: { href: "http://kiosk.local:3000/songs" } })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("connects to /ws on the page's host", () => {
    const { sockets } = setup()
    expect(sockets[0].url).toBe("ws://kiosk.local:3000/ws")
  })

  it("forwards controls and status, ignoring other and malformed frames", () => {
    const { sockets, listener } = setup()
    const socket = sockets[0]
    socket.onopen?.()

    socket.send({ type: "controller.status", status: { state: "connected", port: "hw:2,0,1" } })
    socket.send({ type: "controller.control", control: { type: "knob", name: "knob-1", delta: 3, time: 5 } })
    socket.send({ type: "midi.route.established" })
    socket.send("{not json")

    expect(listener.onOnline).toHaveBeenCalledWith(true)
    expect(listener.onStatus).toHaveBeenCalledWith({ state: "connected", port: "hw:2,0,1" })
    expect(listener.onControl).toHaveBeenCalledWith({ type: "knob", name: "knob-1", delta: 3, time: 5 })
    expect(listener.onControl).toHaveBeenCalledTimes(1)
  })

  it("reconnects with backoff after the socket drops", () => {
    const { sockets, listener } = setup()
    sockets[0].onclose?.()
    expect(listener.onOnline).toHaveBeenCalledWith(false)

    vi.advanceTimersByTime(499)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    sockets[1].onclose?.()
    vi.advanceTimersByTime(999)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)
  })

  it("closes the socket and stops retrying when stopped", () => {
    const { sockets, stop } = setup()
    stop()
    sockets[0].onclose?.()
    vi.advanceTimersByTime(10_000)
    expect(sockets[0].closed).toBe(true)
    expect(sockets).toHaveLength(1)
  })
})
