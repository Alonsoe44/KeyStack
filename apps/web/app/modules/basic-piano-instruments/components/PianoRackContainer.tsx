"use client"

import { PianoRack } from "./PianoRack"
import { usePianoRack } from "./usePianoRack"

export function PianoRackContainer() {
  const { instruments, select, status, error } = usePianoRack()

  return (
    <div className="piano-rack-container flex flex-col items-center gap-3">
      <PianoRack
        instruments={instruments}
        onSelect={select}
        disabled={status === "loading" || status === "connecting"}
      />
      <div aria-live="polite" className="piano-rack-status">
        {status === "connecting" && <p className="status-loading">Asking the piano which voice it&apos;s on…</p>}
        {status === "error" && error && <p className="status-error">{error}</p>}
      </div>
    </div>
  )
}
