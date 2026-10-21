"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getAudioContext, scheduleClick } from "@/lib/audio"

const MIN_BPM = 40
const MAX_BPM = 208
const SCHEDULER_INTERVAL_MS = 25
const SCHEDULE_AHEAD_SEC = 0.1

export function Metronome() {
  const [bpm, setBpm] = useState(100)
  const [isRunning, setIsRunning] = useState(false)
  const [beatActive, setBeatActive] = useState(false)

  const bpmRef = useRef(bpm)
  const nextNoteTimeRef = useRef(0)
  const intervalIdRef = useRef<number | null>(null)
  const pulseTimeoutIdRef = useRef<number | null>(null)

  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  useEffect(() => {
    return () => {
      if (intervalIdRef.current !== null)
        window.clearInterval(intervalIdRef.current)
      if (pulseTimeoutIdRef.current !== null)
        window.clearTimeout(pulseTimeoutIdRef.current)
    }
  }, [])

  function pulseBeat() {
    setBeatActive(true)
    pulseTimeoutIdRef.current = window.setTimeout(
      () => setBeatActive(false),
      120
    )
  }

  function tickScheduler() {
    const ctx = getAudioContext()
    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const delayMs = Math.max(
        0,
        (nextNoteTimeRef.current - ctx.currentTime) * 1000
      )
      scheduleClick(ctx, nextNoteTimeRef.current)
      window.setTimeout(pulseBeat, delayMs)
      nextNoteTimeRef.current += 60 / bpmRef.current
    }
  }

  function start() {
    const ctx = getAudioContext()
    nextNoteTimeRef.current = ctx.currentTime + 0.05
    intervalIdRef.current = window.setInterval(
      tickScheduler,
      SCHEDULER_INTERVAL_MS
    )
    setIsRunning(true)
  }

  function stop() {
    if (intervalIdRef.current !== null)
      window.clearInterval(intervalIdRef.current)
    intervalIdRef.current = null
    setIsRunning(false)
    setBeatActive(false)
  }

  return (
    <div className="metronome-tool flex flex-col gap-2">
      <h2 className="tool-subtitle">Metronome</h2>
      <div className="metronome-controls flex items-center gap-2">
        <Button
          onClick={isRunning ? stop : start}
          variant={isRunning ? "outline" : "default"}
          size="sm"
        >
          {isRunning ? "Stop" : "Start"}
        </Button>
        <span
          className={cn(
            "beat-indicator size-3 shrink-0 rounded-full bg-muted transition-transform duration-100",
            beatActive && "scale-125 bg-primary"
          )}
        />
        <input
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onChange={(event) => setBpm(Number(event.target.value))}
          className="w-full accent-primary"
        />
        <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {bpm} BPM
        </span>
      </div>
    </div>
  )
}
