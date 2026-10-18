"use client"

import { PianoRack } from "./PianoRack"
import { usePianoRack } from "./usePianoRack"

export function PianoRackContainer() {
  const { instruments, select, status, error } = usePianoRack()

  return (
    <div className="piano-rack-container flex flex-col items-center gap-3">
      <PianoRack instruments={instruments} onSelect={select} disabled={status === "loading"} />
      {status === "error" && error && (
        <p role="alert" className="status-error text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
