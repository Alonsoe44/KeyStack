"use client"

import { useEffect, useId, useState, type FormEvent } from "react"
import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import type { NearbyNetwork, NetworkStatusResponse } from "keystack-shared"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { failureMessage, HOTSPOT_HELP } from "../core/feedback"
import type { NetworkPort } from "../core/network-port"

type Step = "editing" | "saving" | "connecting"

type Props = {
  port: NetworkPort
  /** The saved hotspot's name, or null the first time. */
  savedSsid: string | null
  onClose: () => void
  /** Saved and connected. */
  onConnected: (status: NetworkStatusResponse) => void
  /** Saved, so the panel shows the new name even when connecting failed. */
  onSaved: (status: NetworkStatusResponse) => void
}

export function HotspotDialog({ port, savedSsid, onClose, onConnected, onSaved }: Props) {
  const id = useId()
  const [ssid, setSsid] = useState(savedSsid ?? "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [nearby, setNearby] = useState<NearbyNetwork[] | null>(null)
  const [step, setStep] = useState<Step>("editing")
  const [error, setError] = useState<string | null>(null)

  const working = step !== "editing"
  // Typing an iPhone's name by hand is error-prone: it uses a curly ’.
  useEffect(() => {
    let cancelled = false
    void port.nearby().then((result) => {
      if (!cancelled) setNearby(result.ok ? result.value : [])
    })
    return () => {
      cancelled = true
    }
  }, [port])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (working) return
    if (ssid === "") return setError("Enter the hotspot's name or pick it from the list.")
    if (password !== "" && password.length < 8) return setError("The password needs at least 8 characters.")
    if (password === "" && savedSsid === null) return setError("Enter the hotspot's password.")

    setError(null)
    setStep("saving")
    const saved = await port.saveHotspot(ssid, password === "" ? undefined : password)
    if (!saved.ok) {
      setStep("editing")
      return setError(failureMessage(saved.code, saved.message, ssid))
    }
    onSaved(saved.value)

    setStep("connecting")
    const connected = await port.connectHotspot()
    if (!connected.ok) {
      setStep("editing")
      return setError(failureMessage(connected.code, connected.message, ssid))
    }
    onConnected(connected.value)
  }

  return (
    <div className="wifi-modal-backdrop" role="presentation">
      <form
        className="lyrics-modal wifi-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onSubmit={submit}
      >
        <h3 id={`${id}-title`}>Hotspot</h3>
        <p className="wifi-modal-hint">{HOTSPOT_HELP}</p>

        <label className="wifi-field">
          <span>Network name</span>
          <input
            value={ssid}
            onChange={(event) => setSsid(event.target.value)}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={working}
          />
        </label>
        <div className="wifi-nearby" aria-label="Nearby networks">
          {nearby === null ? (
            <span className="wifi-nearby-note">Looking for networks…</span>
          ) : nearby.length === 0 ? (
            <span className="wifi-nearby-note">No networks found. Open Personal Hotspot and reopen this.</span>
          ) : (
            nearby.map((network) => (
              <button
                key={network.ssid}
                type="button"
                className={cn("wifi-chip", network.ssid === ssid && "wifi-chip-selected")}
                onClick={() => setSsid(network.ssid)}
                disabled={working}
              >
                {network.ssid}
              </button>
            ))
          )}
        </div>

        <label className="wifi-field">
          <span>Password</span>
          <span className="wifi-password">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={savedSsid === null ? "" : "Leave empty to keep the saved one"}
              maxLength={63}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={working}
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </span>
        </label>

        {working && (
          <p className="wifi-progress" aria-live="polite">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {step === "saving" ? "Saving…" : `Connecting to "${ssid}"… this can take half a minute.`}
          </p>
        )}
        {error && (
          <p role="alert" className="status-error wifi-error">
            {error}
          </p>
        )}

        <div className="lyrics-editor-actions">
          <Button type="button" variant="outline" className="h-11 px-4" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button type="submit" className="button-yellow h-11 px-4" disabled={working}>
            Save &amp; connect
          </Button>
        </div>
      </form>
    </div>
  )
}
