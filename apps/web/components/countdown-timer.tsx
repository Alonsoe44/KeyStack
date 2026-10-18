"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { getAudioContext, playChime } from "@/lib/audio"

const DURATION_SECONDS = 10 * 60

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function CountdownTimer() {
  const [remainingSeconds, setRemainingSeconds] = useState(DURATION_SECONDS)
  const [isDone, setIsDone] = useState(false)

  const endAtRef = useRef(0)

  useEffect(() => {
    endAtRef.current = Date.now() + DURATION_SECONDS * 1000

    const intervalId = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((endAtRef.current - Date.now()) / 1000)
      )
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        window.clearInterval(intervalId)
        setIsDone(true)
        playChime(getAudioContext())
      }
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="countdown-tool flex flex-col gap-1">
      <h2 className="tool-subtitle">Timer</h2>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "countdown-value font-mono tabular-nums",
            isDone && "text-primary"
          )}
        >
          {formatTime(remainingSeconds)}
        </span>
        {isDone && <span className="text-xs text-muted-foreground">Time!</span>}
      </div>
    </div>
  )
}
