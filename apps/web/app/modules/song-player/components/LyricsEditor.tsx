"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import type { LyricLine, LyricWord, LyricsDocument, LyricsSaveRequest, Song } from "keystack-shared"

import { Button } from "@/components/ui/button"
import { ApiRequestError, saveLyrics } from "../adapters/songstreamer-client"
import { clamp } from "../core/playback"
import { KaraokeLyrics } from "./KaraokeLyrics"
import { useLyricsNavigationGuard } from "./LyricsNavigationGuard"
import { useSongPlayer } from "./SongPlayerProvider"

type DraftWord = Omit<LyricWord, "startMs" | "endMs"> & { startMs: number | null; endMs: number | null }
type DraftLine = Omit<LyricLine, "startMs" | "endMs" | "words"> & {
  startMs: number | null
  endMs: number | null
  words: DraftWord[]
}
type Draft = { language: string; lines: DraftLine[] }
type EditorPhase = "source" | "text-preview" | "line-starts" | "word-timing" | "preview"
type SourceTab = "find" | "paste"
type HistoryEntry = { draft: Draft; selectedLine: number; selectedWord: number }

const TIMESTAMP_STEP_MS = 50

function tokens(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function parseText(text: string): DraftLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, lineIndex) => ({
      id: `line-${lineIndex + 1}`,
      text: line,
      startMs: null,
      endMs: null,
      words: tokens(line).map((word, wordIndex) => ({
        id: `line-${lineIndex + 1}-word-${wordIndex + 1}`,
        text: word,
        startMs: null,
        endMs: null,
      })),
    }))
}

function draftFromDocument(document: LyricsDocument): Draft {
  return {
    language: document.language,
    lines: document.lines.map((line) => ({
      id: line.id,
      text: line.text,
      startMs: line.startMs,
      endMs: line.endMs,
      words: line.words.map((word) => ({ ...word, endMs: word.endMs ?? null })),
    })),
  }
}

function normalizedLineText(line: DraftLine): string {
  return line.text.split(/\s+/).join(" ")
}

function hasReorderedLines(previous: DraftLine[], next: DraftLine[]): boolean {
  const remaining = new Set(next.map((_, index) => index))
  for (let previousIndex = 0; previousIndex < previous.length; previousIndex += 1) {
    const match = next.findIndex((line, nextIndex) => remaining.has(nextIndex) && normalizedLineText(line) === normalizedLineText(previous[previousIndex] as DraftLine))
    if (match < 0) continue
    remaining.delete(match)
    if (match !== previousIndex) return true
  }
  return false
}

function isCompatible(previous: DraftLine[], next: DraftLine[]): boolean {
  return previous.length === next.length
    && !hasReorderedLines(previous, next)
    && previous.every((line, index) => line.words.length === next[index]?.words.length)
}

function applyText(previous: Draft, text: string): Draft {
  const parsed = parseText(text)
  const positionalLines = previous.lines.length === parsed.length && !hasReorderedLines(previous.lines, parsed)
  const matched = new Set<string>()
  return {
    language: previous.language,
    lines: parsed.map((line, index) => {
      const old = positionalLines
        ? previous.lines[index]
        : previous.lines.find((candidate) => !matched.has(candidate.id) && candidate.words.length === line.words.length && normalizedLineText(candidate) === normalizedLineText(line))
      if (!old) return line
      matched.add(old.id)
      const compatible = old.words.length === line.words.length
      return {
        ...line,
        id: old.id,
        startMs: old.startMs,
        // A changed word structure invalidates only this line's word pass.
        endMs: compatible ? old.endMs : null,
        words: line.words.map((word, wordIndex) => ({
          ...word,
          id: old.words[wordIndex]?.id ?? word.id,
          startMs: compatible ? old.words[wordIndex]?.startMs ?? null : null,
          endMs: compatible ? old.words[wordIndex]?.endMs ?? null : null,
        })),
      }
    }),
  }
}

function draftValidationMessage(draft: Draft): string | null {
  if (draft.lines.length === 0) return "Add at least one lyric line."
  if (draft.lines.some((line) => line.startMs === null || line.endMs === null)) return "Finish every line before previewing."
  if (draft.lines.some((line) => line.words.some((word) => word.startMs === null))) return "Tap every word before previewing."

  let previousEnd = -1
  for (const line of draft.lines) {
    const startMs = line.startMs as number
    const endMs = line.endMs as number
    if (endMs <= startMs) return "Every line must end after it starts."
    if (startMs < previousEnd) return "Line timings overlap. Move the line end or the next line start."
    if (line.text.split(/\s+/).join(" ") !== line.words.map((word) => word.text).join(" ")) {
      return "Line text and its words must match. Edit the text before timing it again."
    }

    let previousWordStart = -1
    let previousWordEnd: number | null = null
    for (const word of line.words) {
      const wordStart = word.startMs as number
      if (wordStart < startMs || wordStart >= endMs || wordStart < previousWordStart) return "Word timings must stay inside their line and move forward."
      if (word.endMs !== null && (word.endMs <= wordStart || word.endMs > endMs || (previousWordEnd !== null && wordStart < previousWordEnd))) {
        return "Word endings must stay after their starts and inside the line."
      }
      previousWordStart = wordStart
      previousWordEnd = word.endMs
    }
    previousEnd = endMs
  }
  return null
}

function toCompleteDocument(draft: Draft, song: Song): LyricsDocument | null {
  if (draftValidationMessage(draft)) return null
  return {
    schemaVersion: 1,
    songId: song.id,
    audioSha256: song.audioSha256,
    language: draft.language,
    reviewStatus: "complete",
    documentVersion: 1,
    lines: draft.lines.map((line) => ({
      id: line.id,
      text: line.text,
      startMs: line.startMs as number,
      endMs: line.endMs as number,
      words: line.words.map((word) => ({
        id: word.id,
        text: word.text,
        startMs: word.startMs as number,
        ...(word.endMs === null ? {} : { endMs: word.endMs }),
      })),
    })),
  }
}

function requestFromDocument(document: LyricsDocument): LyricsSaveRequest {
  return {
    schemaVersion: document.schemaVersion,
    songId: document.songId,
    audioSha256: document.audioSha256,
    language: document.language,
    reviewStatus: document.reviewStatus,
    lines: document.lines,
  }
}

function formatStamp(value: number | null): string {
  if (value === null) return "—"
  return `${(value / 1000).toFixed(2)}s`
}

export function LyricsEditor({
  song,
  existing,
  onSaved,
  onCancel,
}: {
  song: Song
  existing: LyricsDocument | null
  onSaved: (document: LyricsDocument) => void
  onCancel: () => void
}) {
  const player = useSongPlayer()
  const { register: registerLyricsLeave } = useLyricsNavigationGuard()
  const initialDraft = useMemo(() => (existing ? draftFromDocument(existing) : { language: "en", lines: [] }), [existing])
  const initialText = useMemo(() => (existing ? existing.lines.map((line) => line.text).join("\n") : ""), [existing])
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [sourceText, setSourceText] = useState(initialText)
  const [sourceTab, setSourceTab] = useState<SourceTab>("paste")
  const [phase, setPhase] = useState<EditorPhase>(existing ? "source" : "source")
  const [selectedLine, setSelectedLine] = useState(0)
  const [selectedWord, setSelectedWord] = useState(0)
  const [past, setPast] = useState<HistoryEntry[]>([])
  const [future, setFuture] = useState<HistoryEntry[]>([])
  const [cancelPrompt, setCancelPrompt] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)
  const [timingError, setTimingError] = useState<string | null>(null)
  const [looping, setLooping] = useState(false)
  const [preserveWordTimingLine, setPreserveWordTimingLine] = useState(false)
  const pendingLeaveRef = useRef<(() => void) | null>(null)

  const requestLyricsLeave = useCallback((continuation: () => void) => {
    pendingLeaveRef.current = continuation
    setCancelPrompt(true)
  }, [])

  useEffect(() => registerLyricsLeave(requestLyricsLeave), [registerLyricsLeave, requestLyricsLeave])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [])

  const { getCurrentTime } = player
  const nowMs = useCallback(() => Math.max(0, Math.round(getCurrentTime() * 1000)), [getCurrentTime])
  const commit = useCallback((next: Draft) => {
    setPast((current) => [...current, { draft, selectedLine, selectedWord }])
    setFuture([])
    setDraft(next)
    setTimingError(null)
  }, [draft, selectedLine, selectedWord])
  const undo = useCallback(() => {
    const previous = past[past.length - 1]
    if (!previous) return
    setPast((current) => current.slice(0, -1))
    setFuture((current) => [{ draft, selectedLine, selectedWord }, ...current])
    setDraft(previous.draft)
    setSelectedLine(previous.selectedLine)
    setSelectedWord(previous.selectedWord)
  }, [draft, past, selectedLine, selectedWord])
  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setFuture((current) => current.slice(1))
    setPast((current) => [...current, { draft, selectedLine, selectedWord }])
    setDraft(next.draft)
    setSelectedLine(next.selectedLine)
    setSelectedWord(next.selectedWord)
  }, [draft, future, selectedLine, selectedWord])
  const moveLine = (delta: number) => {
    setSelectedLine((current) => clamp(current + delta, 0, Math.max(0, draft.lines.length - 1)))
    setSelectedWord(0)
  }
  const setLanguage = (event: ChangeEvent<HTMLInputElement>) => {
    const language = event.target.value
    commit({ ...draft, language })
  }
  const applySource = () => {
    const parsed = parseText(sourceText)
    if (parsed.length === 0) {
      setTextError("Paste at least one lyric line first.")
      return
    }
    setTextError(null)
    const hasTiming = draft.lines.some((line) => line.startMs !== null || line.words.some((word) => word.startMs !== null))
    if (hasTiming && !isCompatible(draft.lines, parsed) && !window.confirm("Changing the line or word structure will clear timing for the affected lines. Continue?")) return
    const next = hasTiming ? applyText(draft, sourceText) : { language: draft.language, lines: parsed }
    commit(next)
    setSelectedLine(0)
    setSelectedWord(0)
    setPreserveWordTimingLine(false)
    setPhase("text-preview")
  }
  const continueFromTextPreview = () => {
    const allStarts = draft.lines.every((line) => line.startMs !== null)
    const allWords = draft.lines.every((line) => line.words.every((word) => word.startMs !== null) && line.endMs !== null)
    setPreserveWordTimingLine(false)
    if (allWords) setPhase("preview")
    else if (allStarts) setPhase("word-timing")
    else setPhase("line-starts")
  }
  const tapLineStart = useCallback(() => {
    const line = draft.lines[selectedLine]
    if (!line) return
    const previous = selectedLine > 0 ? draft.lines[selectedLine - 1]?.startMs ?? 0 : 0
    const startMs = Math.max(previous, nowMs())
    const nextStart = draft.lines[selectedLine + 1]?.startMs
    if (nextStart !== null && nextStart !== undefined && startMs > nextStart) {
      setTimingError("This line starts after the next timed line. Move the next line later first.")
      return
    }
    const lines = draft.lines.map((item, index) => index === selectedLine ? { ...item, startMs } : item)
    commit({ ...draft, lines })
    if (selectedLine < draft.lines.length - 1) setSelectedLine((current) => current + 1)
    else if (!preserveWordTimingLine) setSelectedLine(0)
  }, [draft, nowMs, preserveWordTimingLine, selectedLine, commit])
  const adjustLineStart = (delta: number) => {
    const line = draft.lines[selectedLine]
    if (!line || line.startMs === null) return
    const min = selectedLine > 0 ? (draft.lines[selectedLine - 1]?.startMs ?? 0) : 0
    const nextStart = draft.lines[selectedLine + 1]?.startMs
    const maximum = Math.min(
      nextStart === null || nextStart === undefined ? Number.MAX_SAFE_INTEGER : nextStart,
      line.endMs === null ? Number.MAX_SAFE_INTEGER : line.endMs - 1,
    )
    if (maximum < min) {
      setTimingError("This line has no valid gap before the next line.")
      return
    }
    const startMs = Math.min(maximum, Math.max(min, line.startMs as number + delta))
    const lines = draft.lines.map((item, index) => index === selectedLine ? { ...item, startMs } : item)
    commit({ ...draft, lines })
  }
  const adjustLineEnd = (delta: number) => {
    const line = draft.lines[selectedLine]
    if (!line || line.endMs === null) return
    const explicitWordEnd = Math.max(0, ...line.words.map((word) => word.endMs ?? 0))
    const minimum = Math.max(line.startMs ?? 0, (line.words[line.words.length - 1]?.startMs ?? line.startMs ?? 0) + 50, explicitWordEnd + 1)
    const nextLineStart = draft.lines[selectedLine + 1]?.startMs
    const maximum = nextLineStart === null || nextLineStart === undefined ? Number.MAX_SAFE_INTEGER : nextLineStart
    if (maximum < minimum) {
      setTimingError("This line has no valid ending before the next line.")
      return
    }
    const endMs = Math.min(maximum, Math.max(minimum, line.endMs + delta))
    commit({ ...draft, lines: draft.lines.map((item, index) => index === selectedLine ? { ...item, endMs } : item) })
  }
  const tapWord = useCallback(() => {
    const line = draft.lines[selectedLine]
    const word = line?.words[selectedWord]
    if (!line || !word || line.startMs === null) return
    const previous = selectedWord > 0 ? line.words[selectedWord - 1]?.startMs ?? line.startMs : line.startMs
    const nextStart = line.words[selectedWord + 1]?.startMs
    const candidate = Math.max(previous, nowMs(), line.startMs)
    if (nextStart !== null && nextStart !== undefined && candidate > nextStart) {
      setTimingError("This word starts after the next timed word. Move the next word later first.")
      return
    }
    const startMs = Math.min(nextStart ?? Number.MAX_SAFE_INTEGER, candidate)
    const lines = draft.lines.map((item, lineIndex) => lineIndex !== selectedLine ? item : {
      ...item,
      words: item.words.map((itemWord, wordIndex) => wordIndex === selectedWord
        ? { ...itemWord, startMs, endMs: itemWord.endMs !== null && itemWord.endMs <= startMs ? null : itemWord.endMs }
        : itemWord),
    })
    commit({ ...draft, lines })
    if (selectedWord < line.words.length - 1) setSelectedWord((current) => current + 1)
  }, [draft, nowMs, selectedLine, selectedWord, commit])
  const adjustWord = (delta: number) => {
    const line = draft.lines[selectedLine]
    const word = line?.words[selectedWord]
    if (!line || !word || word.startMs === null) return
    const min = selectedWord > 0 ? (line.words[selectedWord - 1]?.startMs ?? line.startMs ?? 0) : line.startMs ?? 0
    const nextStart = line.words[selectedWord + 1]?.startMs
    const maximum = nextStart ?? line.endMs ?? Number.MAX_SAFE_INTEGER
    if (maximum < min) {
      setTimingError("This word has no valid gap before the next word.")
      return
    }
    const lines = draft.lines.map((item, lineIndex) => lineIndex !== selectedLine ? item : {
      ...item,
      words: item.words.map((itemWord, wordIndex) => {
        if (wordIndex !== selectedWord) return itemWord
        const startMs = Math.min(maximum, Math.max(min, word.startMs as number + delta))
        return { ...itemWord, startMs, endMs: itemWord.endMs !== null && itemWord.endMs <= startMs ? null : itemWord.endMs }
      }),
    })
    commit({ ...draft, lines })
  }
  const adjustWordEnd = (delta: number) => {
    const line = draft.lines[selectedLine]
    const word = line?.words[selectedWord]
    if (!line || !word || word.startMs === null) return
    const nextWordStart = line.words[selectedWord + 1]?.startMs
    const nextLineStart = draft.lines[selectedLine + 1]?.startMs
    const maximum = nextWordStart
      ?? line.endMs
      ?? nextLineStart
      ?? (player.duration === null ? null : Math.round(player.duration * 1000))
    if (maximum === null) {
      setTimingError("Play the audio once before setting a word ending.")
      return
    }
    const minimum = word.startMs + 1
    if (maximum < minimum) {
      setTimingError("This word has no valid ending before the next word.")
      return
    }
    const currentEnd = word.endMs ?? maximum
    const endMs = Math.min(maximum, Math.max(minimum, currentEnd + delta))
    const lines = draft.lines.map((item, lineIndex) => lineIndex !== selectedLine ? item : {
      ...item,
      words: item.words.map((itemWord, wordIndex) => wordIndex === selectedWord ? { ...itemWord, endMs } : itemWord),
    })
    commit({ ...draft, lines })
  }
  const restartLine = () => {
    if (!draft.lines[selectedLine]) return
    const lines = draft.lines.map((line, index) => index !== selectedLine ? line : ({
      ...line,
      startMs: null,
      endMs: null,
      words: line.words.map((word) => ({ ...word, startMs: null, endMs: null })),
    }))
    commit({ ...draft, lines })
    setSelectedWord(0)
    setLooping(false)
    setPreserveWordTimingLine(true)
    setPhase("line-starts")
  }
  const finishLine = () => {
    const line = draft.lines[selectedLine]
    if (!line || line.startMs === null || line.words.some((word) => word.startMs === null)) return
    const lastWord = line.words[line.words.length - 1]?.startMs ?? line.startMs
    const explicitWordEnd = Math.max(0, ...line.words.map((word) => word.endMs ?? 0))
    const minimum = Math.max(lastWord + 50, line.startMs + 50, explicitWordEnd + 1)
    const nextLineStart = draft.lines[selectedLine + 1]?.startMs
    const maximum = nextLineStart === null || nextLineStart === undefined ? Number.MAX_SAFE_INTEGER : nextLineStart
    if (maximum < minimum) {
      setTimingError("The next line starts too soon for this line. Move it later, then finish this line.")
      return
    }
    // Keep an explicit gap when possible, but never let this line overlap the next one.
    const endMs = Math.min(maximum, Math.max(minimum, nowMs()))
    const lines = draft.lines.map((item, index) => index === selectedLine ? { ...item, endMs } : item)
    const next = { ...draft, lines }
    commit(next)
    setLooping(false)
    if (selectedLine < draft.lines.length - 1) {
      setSelectedLine((current) => current + 1)
      setSelectedWord(0)
    } else {
      setPhase("preview")
    }
  }
  const replayLine = () => {
    const line = draft.lines[selectedLine]
    if (line?.startMs === null || line?.startMs === undefined) return
    if (looping) {
      setLooping(false)
      return
    }
    setLooping(true)
    player.seekTo(line.startMs / 1000)
    if (player.phase !== "playing") void player.togglePlay()
  }
  const restartAudio = () => {
    setLooping(false)
    player.seekTo(0)
    if (player.phase !== "playing") void player.togglePlay()
  }
  const { duration: playerDuration, phase: playerPhase, seekTo, togglePlay } = player
  useEffect(() => {
    if (!looping || (phase !== "line-starts" && phase !== "word-timing")) return
    const interval = window.setInterval(() => {
      const line = draft.lines[selectedLine]
      if (!line || line.startMs === null) return
      const endMs = line.endMs ?? draft.lines[selectedLine + 1]?.startMs ?? (playerDuration ?? Number.POSITIVE_INFINITY) * 1000
      if (getCurrentTime() * 1000 < endMs) return
      seekTo(line.startMs / 1000)
      if (playerPhase !== "playing") void togglePlay()
    }, 80)
    return () => window.clearInterval(interval)
  }, [draft.lines, getCurrentTime, looping, phase, playerDuration, playerPhase, seekTo, selectedLine, togglePlay])
  const keyboardActions = useRef({ undo, redo, tapLineStart, tapWord })
  useEffect(() => {
    keyboardActions.current = { undo, redo, tapLineStart, tapWord }
  }, [redo, tapLineStart, tapWord, undo])
  useEffect(() => {
    const isTextControl = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setCancelPrompt((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !isTextControl(event.target)) {
        event.preventDefault()
        if (event.shiftKey) keyboardActions.current.redo()
        else keyboardActions.current.undo()
        return
      }
      if (event.code === "Space" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTextControl(event.target)) {
        if (phase === "line-starts") {
          event.preventDefault()
          keyboardActions.current.tapLineStart()
        } else if (phase === "word-timing") {
          event.preventDefault()
          keyboardActions.current.tapWord()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [phase])
  const complete = toCompleteDocument(draft, song)
  const validationError = draftValidationMessage(draft)
  const save = async () => {
    if (!complete) return
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveLyrics(song.id, requestFromDocument(complete))
      player.setPlaybackRate(1)
      onSaved(saved)
    } catch (error) {
      setSaveError(error instanceof ApiRequestError ? error.message : error instanceof Error ? error.message : "Could not save lyrics")
    } finally {
      setSaving(false)
    }
  }
  const discard = () => {
    player.setPlaybackRate(1)
    const continuation = pendingLeaveRef.current
    pendingLeaveRef.current = null
    onCancel()
    continuation?.()
  }

  return (
    <section className="lyrics-editor" aria-labelledby="lyrics-editor-heading">
      <div className="lyrics-editor-topline">
        <div>
          <span className="eyebrow">LYRICS · {existing ? "EDIT" : "NEW"}</span>
          <h2 id="lyrics-editor-heading" className="lyrics-editor-title">
            {phase === "source" ? "Find the words." : phase === "text-preview" ? "Check the text." : phase === "line-starts" ? "Tap the lines." : phase === "word-timing" ? "Tap every word." : "Preview and save."}
          </h2>
        </div>
          <div className="lyrics-editor-top-actions"><Button type="button" variant="outline" size="sm" onClick={() => void player.togglePlay()}>{player.phase === "playing" ? "Pause" : "Play"}</Button><Button type="button" variant="ghost" size="sm" onClick={() => setCancelPrompt(true)}>Cancel</Button></div>
      </div>

      {phase === "source" && (
        <>
          <div className="lyrics-source-tabs" role="tablist" aria-label="Lyrics source">
            <button type="button" role="tab" aria-selected={sourceTab === "find"} className={sourceTab === "find" ? "lyrics-source-tab active" : "lyrics-source-tab"} onClick={() => setSourceTab("find")}>Find lyrics</button>
            <button type="button" role="tab" aria-selected={sourceTab === "paste"} className={sourceTab === "paste" ? "lyrics-source-tab active" : "lyrics-source-tab"} onClick={() => setSourceTab("paste")}>Paste lyrics</button>
          </div>
          {sourceTab === "find" ? (
            <div className="lyrics-find-panel">
              <p>Open a search tab, copy the words you want to use, then return here and paste them.</p>
              <a className="lyrics-search-link" href={`https://www.google.com/search?q=${encodeURIComponent(`${song.artist} ${song.title} lyrics`)}`} target="_blank" rel="noreferrer">Open web search</a>
              <Button type="button" variant="outline" onClick={() => setSourceTab("paste")}>Paste copied lyrics</Button>
            </div>
          ) : (
            <>
              <label className="lyrics-field">
                <span>Lyrics text</span>
                <textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setTextError(null) }} placeholder="One line at a time…" rows={5} />
              </label>
              <div className="lyrics-text-preview" aria-label="Lyrics preview">
                {sourceText.trim() ? sourceText.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => <span key={`${index}-${line}`}>{line}</span>) : <span className="lyrics-muted">Your pasted lines will preview here.</span>}
              </div>
            </>
          )}
          <div className="lyrics-editor-fields">
            <label className="lyrics-field lyrics-language-field"><span>Language</span><input value={draft.language} onChange={setLanguage} maxLength={32} /></label>
            {textError && <p className="lyrics-error" role="alert">{textError}</p>}
          </div>
          <div className="lyrics-editor-actions">
            <Button type="button" className="button-yellow" onClick={applySource}>Use lyrics</Button>
          </div>
        </>
      )}

      {phase === "text-preview" && (
        <>
          <p className="lyrics-editor-instruction">Check the line breaks and words before timing. You can return to the source to make a change.</p>
          <div className="lyrics-text-preview lyrics-text-preview-large" aria-label="Text preview">
            {draft.lines.map((line) => <span key={line.id}>{line.text}</span>)}
          </div>
          <div className="lyrics-editor-footer">
            <Button type="button" variant="outline" onClick={() => setPhase("source")}>Edit text</Button>
            <Button type="button" variant="outline" onClick={undo} disabled={past.length === 0}>Undo</Button>
            <Button type="button" variant="outline" onClick={redo} disabled={future.length === 0}>Redo</Button>
            <Button type="button" className="button-yellow" onClick={continueFromTextPreview}>Continue to timing</Button>
          </div>
        </>
      )}

      {phase === "line-starts" && (
        <>
          <p className="lyrics-editor-instruction">Play the song and tap each line when it begins. You can undo or nudge a timestamp later.</p>
          <div className="lyrics-timing-toolbar">
            <Button type="button" variant="outline" onClick={restartAudio}>Restart audio</Button>
            <Button type="button" variant="outline" onClick={restartLine}>Restart line</Button>
            <Button type="button" variant="outline" onClick={() => moveLine(-1)}>Previous</Button>
            <Button type="button" variant="outline" onClick={() => moveLine(1)}>Next</Button>
            <Button type="button" variant="outline" onClick={replayLine}>{looping ? "Stop looping" : "Replay line"}</Button>
            <label className="lyrics-speed">Speed <select value={player.playbackRate} onChange={(event) => player.setPlaybackRate(Number(event.target.value))}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label>
          </div>
          <div className="lyrics-line-list" role="list">
            {draft.lines.map((line, index) => <button type="button" role="listitem" key={line.id} className={`lyrics-timing-line${index === selectedLine ? " selected" : ""}${line.startMs !== null ? " timed" : ""}`} onClick={() => setSelectedLine(index)}><span>{line.text}</span><small>{formatStamp(line.startMs)}</small></button>)}
          </div>
          <div className="lyrics-current-actions">
            <Button type="button" variant="outline" onClick={() => adjustLineStart(-TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.startMs === null}>Earlier</Button>
            <Button type="button" variant="outline" onClick={() => adjustLineStart(TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.startMs === null}>Later</Button>
            <Button type="button" className="button-yellow" onClick={tapLineStart}>Tap line start</Button>
          </div>
          {timingError && <p className="lyrics-error" role="alert">{timingError}</p>}
          <div className="lyrics-editor-footer"><Button type="button" variant="outline" onClick={undo} disabled={past.length === 0}>Undo</Button><Button type="button" variant="outline" onClick={redo} disabled={future.length === 0}>Redo</Button><Button type="button" className="button-yellow" disabled={!draft.lines.every((line) => line.startMs !== null)} onClick={() => { if (!preserveWordTimingLine) setSelectedLine(0); setPreserveWordTimingLine(false); setLooping(false); setPhase("word-timing") }}>Start word timing</Button></div>
        </>
      )}

      {phase === "word-timing" && (
        <>
          <p className="lyrics-editor-instruction">Replay the selected line, tap each word as it starts, then finish the line when it ends.</p>
          <div className="lyrics-timing-toolbar">
            <Button type="button" variant="outline" onClick={restartAudio}>Restart audio</Button>
            <Button type="button" variant="outline" onClick={restartLine}>Restart line</Button>
            <Button type="button" variant="outline" onClick={() => moveLine(-1)}>Previous line</Button>
            <Button type="button" variant="outline" onClick={() => moveLine(1)}>Next line</Button>
            <Button type="button" variant="outline" onClick={replayLine}>{looping ? "Stop looping" : "Replay line"}</Button>
            <label className="lyrics-speed">Speed <select value={player.playbackRate} onChange={(event) => player.setPlaybackRate(Number(event.target.value))}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label>
          </div>
          <div className="lyrics-word-line" aria-label={`Timing line ${selectedLine + 1}`}>
            {draft.lines[selectedLine]?.words.map((word, index) => <button type="button" key={word.id} className={`lyrics-word-button${index === selectedWord ? " selected" : ""}${word.startMs !== null ? " timed" : ""}`} onClick={() => setSelectedWord(index)}><span>{word.text}</span><small>{formatStamp(word.startMs)}</small></button>)}
          </div>
          <p className="lyrics-active-line">{draft.lines[selectedLine]?.text}</p>
          <div className="lyrics-current-actions">
            <Button type="button" variant="outline" onClick={() => adjustWord(-TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.words[selectedWord]?.startMs === null}>Earlier</Button>
            <Button type="button" variant="outline" onClick={() => adjustWord(TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.words[selectedWord]?.startMs === null}>Later</Button>
            <Button type="button" variant="outline" onClick={tapWord} disabled={draft.lines[selectedLine]?.words[selectedWord]?.startMs !== null && selectedWord >= (draft.lines[selectedLine]?.words.length ?? 1) - 1}>Tap word</Button>
            <Button type="button" className="button-yellow" onClick={finishLine} disabled={!draft.lines[selectedLine] || draft.lines[selectedLine].startMs === null || draft.lines[selectedLine].words.some((word) => word.startMs === null)}>Finish line</Button>
          </div>
          <div className="lyrics-current-actions lyrics-word-end-actions">
            <span className="lyrics-progress">Word end {formatStamp(draft.lines[selectedLine]?.words[selectedWord]?.endMs ?? null)}</span>
            <Button type="button" variant="outline" onClick={() => adjustWordEnd(-TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.words[selectedWord]?.startMs === null}>Word end earlier</Button>
            <Button type="button" variant="outline" onClick={() => adjustWordEnd(TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.words[selectedWord]?.startMs === null}>Word end later</Button>
          </div>
          <div className="lyrics-current-actions lyrics-line-end-actions">
            <span className="lyrics-progress">Line end {formatStamp(draft.lines[selectedLine]?.endMs ?? null)}</span>
            <Button type="button" variant="outline" onClick={() => adjustLineEnd(-TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.endMs === null}>Line end earlier</Button>
            <Button type="button" variant="outline" onClick={() => adjustLineEnd(TIMESTAMP_STEP_MS)} disabled={draft.lines[selectedLine]?.endMs === null}>Line end later</Button>
          </div>
          {timingError && <p className="lyrics-error" role="alert">{timingError}</p>}
          <div className="lyrics-editor-footer"><Button type="button" variant="outline" onClick={() => { setLooping(false); setPhase("source") }}>Edit text</Button><Button type="button" variant="outline" onClick={() => { setLooping(false); setPhase("line-starts") }}>Edit line starts</Button><Button type="button" variant="outline" onClick={undo} disabled={past.length === 0}>Undo</Button><Button type="button" variant="outline" onClick={redo} disabled={future.length === 0}>Redo</Button><span className="lyrics-progress">Line {selectedLine + 1} / {draft.lines.length}</span></div>
        </>
      )}

      {phase === "preview" && (
        <>
          <p className="lyrics-editor-instruction">Listen through the complete karaoke preview, then save when every line and word feels right.</p>
          {complete ? <KaraokeLyrics document={complete} /> : <p className="lyrics-error" role="alert">{validationError ?? "Complete every timing before previewing."}</p>}
          <div className="lyrics-editor-actions"><Button type="button" variant="outline" onClick={() => { setLooping(false); setPhase("source") }}>Edit text</Button><Button type="button" variant="outline" onClick={() => { setLooping(false); setPhase("line-starts") }}>Edit line starts</Button><Button type="button" variant="outline" onClick={() => { setLooping(false); setPhase("word-timing") }}>Edit word timings</Button><Button type="button" className="button-yellow" onClick={() => void save()} disabled={!complete || saving}>{saving ? "Saving…" : "Save lyrics"}</Button></div>
          {saveError && <p className="lyrics-error" role="alert">{saveError} <Button type="button" variant="outline" size="sm" onClick={() => void save()} disabled={saving}>Retry save</Button></p>}
        </>
      )}

      {cancelPrompt && (
        <div className="lyrics-modal-backdrop" role="presentation">
          <div className="lyrics-modal" role="dialog" aria-modal="true" aria-labelledby="lyrics-cancel-heading">
            <h3 id="lyrics-cancel-heading">Discard this session?</h3>
            <p>Timing is kept only until you save. Your existing lyrics will stay unchanged.</p>
            <div className="lyrics-editor-actions"><Button type="button" variant="outline" onClick={() => { pendingLeaveRef.current = null; setCancelPrompt(false) }}>Keep editing</Button><Button type="button" className="button-yellow" onClick={discard}>Discard</Button></div>
          </div>
        </div>
      )}
    </section>
  )
}
