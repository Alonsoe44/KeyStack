"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { InstrumentId } from "keystack-shared"
import { INSTRUMENTS, type Instrument } from "../core/instrument"
import { selectInstrument } from "../core/select-instrument"
import { createHttpInstrumentControlAdapter } from "../adapters/http-instrument-control-adapter"

export type PianoRackStatus = "connecting" | "idle" | "loading" | "error"

export function usePianoRack(instruments: Instrument[] = INSTRUMENTS) {
  const port = useMemo(() => createHttpInstrumentControlAdapter(), [])
  // Unknown until the backend says which voice the synth is on.
  const [selectedId, setSelectedId] = useState<InstrumentId | null>(null)
  const [status, setStatus] = useState<PianoRackStatus>("connecting")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void port.getState().then((state) => {
      if (cancelled) return
      if (state) {
        setSelectedId(state.selected)
        setStatus("idle")
      } else {
        setStatus("error")
        setError("Can't reach the piano server. Pick a voice to try again.")
      }
    })
    return () => {
      cancelled = true
    }
  }, [port])

  const select = useCallback(
    async (instrumentId: InstrumentId) => {
      if (instrumentId === selectedId || status === "loading") return

      const previous = selectedId
      setSelectedId(instrumentId)
      setStatus("loading")
      setError(null)

      const result = await selectInstrument(port, instrumentId)

      if (!result.ok) {
        setSelectedId(previous)
        setStatus("error")
        setError(result.error ?? "Failed to switch instrument")
        return
      }

      setStatus("idle")
    },
    [port, selectedId, status],
  )

  return {
    instruments: instruments.map((instrument) => ({ ...instrument, selected: instrument.id === selectedId })),
    status,
    error,
    select,
  }
}
