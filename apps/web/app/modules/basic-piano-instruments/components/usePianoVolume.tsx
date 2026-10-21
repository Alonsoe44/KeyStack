"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createHttpInstrumentControlAdapter } from "../adapters/http-instrument-control-adapter"

/** The piano's (FluidSynth's) volume, 0-100, as the backend reports it. */
export function usePianoVolume() {
  const port = useMemo(() => createHttpInstrumentControlAdapter(), [])
  const [volume, setVolume] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void port.getState().then((state) => {
      if (!cancelled && state) setVolume(state.volume)
    })
    return () => {
      cancelled = true
    }
  }, [port])

  const commit = useCallback(
    async (next: number) => {
      const previous = volume
      setVolume(next)
      setError(null)
      const result = await port.setVolume(Math.round(next))
      if (!result.ok) {
        setVolume(previous)
        setError(result.error ?? "Could not change the volume")
      }
    },
    [port, volume],
  )

  return { volume, error, commit }
}
