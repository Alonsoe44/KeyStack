"use client"

import { useEffect, useMemo, useState } from "react"
import type { LyricLine, LyricWord, LyricsDocument } from "keystack-shared"

import { clamp } from "../core/playback"
import { useSongPlayer } from "./SongPlayerProvider"

function currentLineIndex(lines: LyricLine[], timeMs: number): number {
  if (lines.length === 0) return -1
  const active = lines.findIndex((line) => timeMs >= line.startMs && timeMs < line.endMs)
  if (active >= 0) return active
  const before = lines.findLastIndex((line) => timeMs >= line.startMs)
  return before >= 0 ? before : 0
}

function wordFill(word: LyricWord, next: LyricWord | undefined, line: LyricLine, timeMs: number): number {
  if (timeMs <= word.startMs) return 0
  const end = word.endMs ?? next?.startMs ?? line.endMs
  if (end <= word.startMs || timeMs >= end) return 100
  return clamp(((timeMs - word.startMs) / (end - word.startMs)) * 100, 0, 100)
}

function Word({ word, next, line, timeMs }: { word: LyricWord; next?: LyricWord; line: LyricLine; timeMs: number }) {
  const fill = wordFill(word, next, line, timeMs)
  return (
    <span className="karaoke-word" data-fill={fill >= 100 ? "complete" : fill > 0 ? "active" : "pending"}>
      <span className="karaoke-word-base">{word.text}</span>
      <span className="karaoke-word-progress" style={{ width: `${fill}%` }} aria-hidden="true">
        {word.text}
      </span>
    </span>
  )
}

function Line({ line, active, timeMs }: { line: LyricLine; active: boolean; timeMs: number }) {
  return (
    <p className={`karaoke-line${active ? " karaoke-line-current" : ""}`} aria-current={active ? "true" : undefined}>
      {active ? line.words.map((word, index) => (
        <Word key={word.id} word={word} next={line.words[index + 1]} line={line} timeMs={timeMs} />
      )) : line.text}
    </p>
  )
}

export function KaraokeLyrics({ document }: { document: LyricsDocument }) {
  const { phase, getCurrentTime } = useSongPlayer()
  const [timeMs, setTimeMs] = useState(0)

  // The provider's audio element remains the clock. This rAF loop only makes
  // the word fill smooth between native timeupdate events.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      setTimeMs(Math.max(0, Math.round(getCurrentTime() * 1000)))
      frame = window.requestAnimationFrame(tick)
    }
    tick()
    return () => window.cancelAnimationFrame(frame)
  }, [getCurrentTime, phase])

  const activeIndex = useMemo(() => currentLineIndex(document.lines, timeMs), [document.lines, timeMs])
  if (activeIndex < 0) return null
  const previous = document.lines[activeIndex - 1]
  const current = document.lines[activeIndex]
  const next = document.lines[activeIndex + 1]

  return (
    <div className="karaoke-stage" aria-label="Karaoke lyrics" role="region">
      <div className="karaoke-line-slot karaoke-line-previous" aria-hidden="true">
        {previous && <Line line={previous} active={false} timeMs={timeMs} />}
      </div>
      <div className="karaoke-line-slot karaoke-line-main">
        <Line line={current} active timeMs={timeMs} />
      </div>
      <div className="karaoke-line-slot karaoke-line-next" aria-hidden="true">
        {next && <Line line={next} active={false} timeMs={timeMs} />}
      </div>
    </div>
  )
}
