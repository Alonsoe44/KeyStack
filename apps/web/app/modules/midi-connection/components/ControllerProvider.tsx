"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { ControllerStatus } from "keystack-shared"
import { subscribeToController } from "../adapters/controller-client"
import {
  createControllerDispatcher,
  type ControllerBindings,
  type ControllerDispatcher,
} from "../core/controller-bindings"

type ControllerContextValue = {
  dispatcher: ControllerDispatcher
  status: ControllerStatus | null
}

const ControllerContext = createContext<ControllerContextValue | null>(null)

/** One /ws subscription for the whole kiosk; screens add bindings with useControllerBindings. */
export function ControllerProvider({ children }: { children: React.ReactNode }) {
  const [dispatcher] = useState(createControllerDispatcher)
  const [status, setStatus] = useState<ControllerStatus | null>(null)

  useEffect(
    () =>
      subscribeToController({
        onControl: (control) => dispatcher.dispatch(control),
        onStatus: setStatus,
        // A dropped socket means the server's status is unknown until it reconnects.
        onOnline: (online) => {
          if (!online) setStatus(null)
        },
      }),
    [dispatcher]
  )

  return <ControllerContext.Provider value={{ dispatcher, status }}>{children}</ControllerContext.Provider>
}

function useControllerContext(): ControllerContextValue {
  const value = useContext(ControllerContext)
  if (!value) throw new Error("useControllerBindings must be used inside ControllerProvider")
  return value
}

/**
 * Binds Launchkey controls while the calling component is mounted. The latest
 * bindings are used on every event, so handlers can close over fresh state.
 * Pass `enabled: false` to step aside without unmounting.
 */
export function useControllerBindings(bindings: ControllerBindings, enabled = true) {
  const { dispatcher } = useControllerContext()
  const latest = useRef(bindings)

  useEffect(() => {
    latest.current = bindings
  })

  useEffect(() => {
    if (!enabled) return
    return dispatcher.register(() => latest.current)
  }, [dispatcher, enabled])
}

export function useControllerStatus(): ControllerStatus | null {
  return useControllerContext().status
}
