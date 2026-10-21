import type { ControllerControlEvent } from "keystack-shared"
import { describe, expect, it, vi } from "vitest"
import { createControllerDispatcher } from "./controller-bindings"

const press = (name: "up" | "down" | "select" | "back"): ControllerControlEvent => ({ type: "button", name, pressed: true, time: 0 })
const release = (name: "up" | "down" | "select" | "back"): ControllerControlEvent => ({ type: "button", name, pressed: false, time: 0 })

describe("controller dispatcher", () => {
  it("fires button handlers on press and ignores the release", () => {
    const dispatcher = createControllerDispatcher()
    const up = vi.fn()
    dispatcher.register(() => ({ buttons: { up } }))

    expect(dispatcher.dispatch(press("up"))).toBe(true)
    dispatcher.dispatch(release("up"))

    expect(up).toHaveBeenCalledTimes(1)
  })

  it("passes knob deltas and pad velocities through", () => {
    const dispatcher = createControllerDispatcher()
    const knob = vi.fn()
    const pad = vi.fn()
    dispatcher.register(() => ({ knobs: { "knob-1": knob }, pads: { "pad-3": pad } }))

    dispatcher.dispatch({ type: "knob", name: "knob-1", delta: -2, time: 0 })
    dispatcher.dispatch({ type: "pad", name: "pad-3", pressed: true, velocity: 90, time: 0 })
    dispatcher.dispatch({ type: "pad", name: "pad-3", pressed: false, velocity: 0, time: 0 })

    expect(knob).toHaveBeenCalledWith(-2)
    expect(pad).toHaveBeenCalledTimes(1)
    expect(pad).toHaveBeenCalledWith(90)
  })

  it("gives the top layer first say and falls through for unbound controls", () => {
    const dispatcher = createControllerDispatcher()
    const screenUp = vi.fn()
    const screenBack = vi.fn()
    const dialogBack = vi.fn()
    dispatcher.register(() => ({ buttons: { up: screenUp, back: screenBack } }))
    dispatcher.register(() => ({ buttons: { back: dialogBack } }))

    dispatcher.dispatch(press("back"))
    dispatcher.dispatch(press("up"))

    expect(dialogBack).toHaveBeenCalledTimes(1)
    expect(screenBack).not.toHaveBeenCalled()
    expect(screenUp).toHaveBeenCalledTimes(1)
  })

  it("stops at a capturing layer", () => {
    const dispatcher = createControllerDispatcher()
    const screenUp = vi.fn()
    dispatcher.register(() => ({ buttons: { up: screenUp } }))
    dispatcher.register(() => ({ capture: true }))

    expect(dispatcher.dispatch(press("up"))).toBe(false)
    expect(screenUp).not.toHaveBeenCalled()
  })

  it("hands control back when a layer unregisters", () => {
    const dispatcher = createControllerDispatcher()
    const first = vi.fn()
    const second = vi.fn()
    dispatcher.register(() => ({ buttons: { select: first } }))
    const unregister = dispatcher.register(() => ({ buttons: { select: second } }))

    unregister()
    unregister()
    dispatcher.dispatch(press("select"))

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it("reads the latest bindings on every event", () => {
    const dispatcher = createControllerDispatcher()
    let count = 0
    dispatcher.register(() => ({ buttons: { down: () => (count += 1) } }))
    dispatcher.dispatch(press("down"))
    dispatcher.dispatch(press("down"))
    expect(count).toBe(2)
  })

  it("reports unbound controls as unhandled", () => {
    expect(createControllerDispatcher().dispatch(press("select"))).toBe(false)
  })
})
