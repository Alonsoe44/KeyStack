"use client"

import { useCallback, useMemo, useState } from "react"
import type { InstrumentId } from "keystack-shared"
import { INSTRUMENTS, type Instrument } from "../core/instrument"
import { selectInstrument } from "../core/select-instrument"
import { createHttpInstrumentControlAdapter } from "../adapters/http-instrument-control-adapter"

export type PianoRackStatus = "idle" | "loading" | "error"

export function usePianoRack(instruments: Instrument[] = INSTRUMENTS) {
  const port = useMemo(() => createHttpInstrumentControlAdapter(), [])
  const [selectedId, setSelectedId] = useState<InstrumentId>(instruments[0].id)
  const [status, setStatus] = useState<PianoRackStatus>("idle")
  const [error, setError] = useState<string | null>(null)

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
