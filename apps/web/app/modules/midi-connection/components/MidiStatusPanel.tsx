"use client"

import { cn } from "@/lib/utils"
import { useMidiStatus } from "./useMidiStatus"

function Row({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="status-row">
      <span className={cn("status-indicator", !ok && "status-indicator-off")} aria-hidden="true" />
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function MidiStatusPanel() {
  const { status, online } = useMidiStatus()

  if (!status) {
    return (
      <div className="status-panel" aria-live="polite">
        <div className="status-panel-heading">
          <div>
            <span className="eyebrow">HARDWARE CHECK</span>
            <h2>Looking for your piano…</h2>
          </div>
          <span className="signal-chip signal-chip-offline">
            <span className="status-dot" aria-hidden="true" />
            {online ? "LOADING" : "OFFLINE"}
          </span>
        </div>
        <p className="status-loading">Connecting to the local KeyStack server.</p>
      </div>
    )
  }

  return (
    <div className="status-panel" aria-live="polite">
      <div className="status-panel-heading">
        <div>
          <span className="eyebrow">HARDWARE CHECK</span>
          <h2>{online ? "Ready to play?" : "Reconnect the room."}</h2>
        </div>
        <span className={cn("signal-chip", !online && "signal-chip-offline")}>
          <span className="status-dot" aria-hidden="true" />
          {online ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <dl className="status-list">
        <Row
          label="Keyboard"
          ok={status.keyboard.present}
          value={status.keyboard.present ? `Connected — ${status.keyboard.name}` : "Not detected"}
        />
        <Row label="Synth" ok={status.synth.present} value={status.synth.present ? "Running" : "Not running"} />
        <Row label="Route" ok={status.routed} value={status.routed ? "Active" : "Inactive"} />
      </dl>
      {!online && <p role="alert" className="status-error">Lost connection to the server — reconnecting…</p>}
    </div>
  )
}
