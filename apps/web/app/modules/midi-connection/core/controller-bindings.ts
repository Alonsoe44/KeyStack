import type { ControllerButtonName, ControllerControlEvent } from "keystack-shared"

type PadEvent = Extract<ControllerControlEvent, { type: "pad" }>
type KnobEvent = Extract<ControllerControlEvent, { type: "knob" }>

export type ControllerPadName = PadEvent["name"]
export type ControllerKnobName = KnobEvent["name"]

/**
 * What one screen does with the Launchkey. Buttons and pads fire on press
 * only; releases are ignored. Unbound controls fall through to the screen
 * underneath unless `capture` is set (for dialogs that own the controls).
 */
export interface ControllerBindings {
  buttons?: Partial<Record<ControllerButtonName, () => void>>
  pads?: Partial<Record<ControllerPadName, (velocity: number) => void>>
  knobs?: Partial<Record<ControllerKnobName, (delta: number) => void>>
  capture?: boolean
}

export interface ControllerDispatcher {
  /** Adds a layer on top; the returned function removes it. */
  register(bindings: () => ControllerBindings): () => void
  /** Returns whether a layer handled the event. */
  dispatch(event: ControllerControlEvent): boolean
}

function handlerFor(bindings: ControllerBindings, event: ControllerControlEvent): (() => void) | null {
  switch (event.type) {
    case "button": {
      const handler = bindings.buttons?.[event.name]
      return handler && event.pressed ? handler : null
    }
    case "pad": {
      const handler = bindings.pads?.[event.name]
      return handler && event.pressed ? () => handler(event.velocity) : null
    }
    case "knob": {
      const handler = bindings.knobs?.[event.name]
      return handler && event.delta !== 0 ? () => handler(event.delta) : null
    }
  }
}

function binds(bindings: ControllerBindings, event: ControllerControlEvent): boolean {
  if (event.type === "button") return Boolean(bindings.buttons?.[event.name])
  if (event.type === "pad") return Boolean(bindings.pads?.[event.name])
  return Boolean(bindings.knobs?.[event.name])
}

/**
 * The most recently registered layer (the screen or dialog on top) gets
 * each control first. Bindings are read through a getter at dispatch time so
 * a screen can re-render without re-registering.
 */
export function createControllerDispatcher(): ControllerDispatcher {
  const layers: (() => ControllerBindings)[] = []

  return {
    register(bindings) {
      layers.push(bindings)
      return () => {
        const index = layers.lastIndexOf(bindings)
        if (index !== -1) layers.splice(index, 1)
      }
    },
    dispatch(event) {
      for (let index = layers.length - 1; index >= 0; index--) {
        const bindings = layers[index]()
        if (binds(bindings, event)) {
          handlerFor(bindings, event)?.()
          return true
        }
        if (bindings.capture) return false
      }
      return false
    },
  }
}
