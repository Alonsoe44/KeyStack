"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import type { NetworkStatusResponse } from "keystack-shared"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createHttpNetworkAdapter } from "../adapters/http-network-adapter"
import { connectionLabel, failureMessage, isOnline } from "../core/feedback"
import { HotspotDialog } from "./HotspotDialog"

const POLL_MS = 15_000

type Activity =
  | { kind: "idle" }
  | { kind: "connecting"; ssid: string }
  | { kind: "connected"; ssid: string }
  | { kind: "error"; message: string }

function Row({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="status-row">
      <span className={cn("status-indicator", !ok && "status-indicator-off")} aria-hidden="true" />
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function WifiPanel() {
  const port = useMemo(() => createHttpNetworkAdapter(), [])
  const [status, setStatus] = useState<NetworkStatusResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activity, setActivity] = useState<Activity>({ kind: "idle" })
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    const result = await port.status()
    if (result.ok) {
      setStatus(result.value)
      setLoadError(null)
    } else {
      setLoadError(failureMessage(result.code, result.message, null))
    }
  }, [port])

  useEffect(() => {
    // Kicks off the first fetch without setting state synchronously in the effect.
    const first = setTimeout(refresh, 0)
    const timer = setInterval(refresh, POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [refresh])

  const hotspot = status?.hotspot?.ssid ?? null
  const connecting = activity.kind === "connecting"

  const reconnect = async () => {
    if (!hotspot || connecting) return
    setActivity({ kind: "connecting", ssid: hotspot })
    const result = await port.connectHotspot()
    if (result.ok) {
      setStatus(result.value)
      setActivity({ kind: "connected", ssid: hotspot })
    } else {
      setActivity({ kind: "error", message: failureMessage(result.code, result.message, hotspot) })
      void refresh()
    }
  }

  const online = status ? isOnline(status) : false
  const wifiValue = status?.wifi
    ? `${status.wifi.ssid}${status.wifi.signal === null ? "" : ` · ${status.wifi.signal}%`}`
    : "Not connected"

  return (
    <section className="status-panel wifi-panel" aria-labelledby="wifi-panel-title">
      <div className="status-panel-heading">
        <div>
          <span className="eyebrow">WI-FI</span>
          <h2 id="wifi-panel-title">{status === null ? "Checking Wi-Fi…" : online ? "You're online." : "Get online."}</h2>
        </div>
        <span className={cn("signal-chip", !online && "signal-chip-offline")}>
          <span className="status-dot" aria-hidden="true" />
          {status ? connectionLabel(status).toUpperCase() : "…"}
        </span>
      </div>

      {status && (
        <dl className="status-list wifi-status-list">
          <Row label="Network" ok={status.wifi !== null} value={wifiValue} />
          <Row label="Hotspot" ok={hotspot !== null} value={hotspot ?? "Not set up"} />
        </dl>
      )}

      <div className="wifi-actions">
        <Button className="button-yellow h-11 px-4" onClick={reconnect} disabled={!hotspot || connecting}>
          {connecting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {connecting ? "Connecting…" : "Connect to hotspot"}
        </Button>
        <Button variant="outline" className="h-11 px-4" onClick={() => setDialogOpen(true)} disabled={connecting || !status}>
          {hotspot ? "Change hotspot" : "Set up hotspot"}
        </Button>
      </div>

      <div aria-live="polite">
        {activity.kind === "connecting" && (
          <p className="status-loading">
            Connecting to &quot;{activity.ssid}&quot;… keep Personal Hotspot open on your iPhone.
          </p>
        )}
        {activity.kind === "connected" && <p className="wifi-success">Connected to &quot;{activity.ssid}&quot;.</p>}
        {activity.kind === "error" && (
          <p role="alert" className="status-error">
            {activity.message}
          </p>
        )}
        {loadError && activity.kind === "idle" && (
          <p role="alert" className="status-error">
            {loadError}
          </p>
        )}
      </div>

      {dialogOpen && (
        <HotspotDialog
          port={port}
          savedSsid={hotspot}
          onClose={() => setDialogOpen(false)}
          onSaved={setStatus}
          onConnected={(next) => {
            setStatus(next)
            setDialogOpen(false)
            setActivity({ kind: "connected", ssid: next.wifi?.ssid ?? next.hotspot?.ssid ?? "" })
          }}
        />
      )}
    </section>
  )
}
