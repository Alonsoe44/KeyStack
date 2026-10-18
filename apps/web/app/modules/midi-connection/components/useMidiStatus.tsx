"use client"

import { useEffect, useState } from "react"
import type { MidiConnectionStatus } from "keystack-shared"
import { subscribeToMidiStatus } from "../adapters/midi-status-client"

export function useMidiStatus() {
  const [status, setStatus] = useState<MidiConnectionStatus | null>(null)
  const [online, setOnline] = useState(false)

  useEffect(
    () => subscribeToMidiStatus({ onStatus: setStatus, onOnline: setOnline }),
    []
  )

  return { status, online }
}
