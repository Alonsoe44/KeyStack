"use client"

import { useEffect, useState, type FormEvent } from "react"
import type { LyricsCandidate, Song } from "keystack-shared"

import { Button } from "@/components/ui/button"
import { LyricsLookupError, lookupLyrics, searchLyrics } from "../adapters/lyrics-lookup-client"

type Request = { kind: "lookup" } | { kind: "search"; query: string }
type Status = { kind: "loading"; request: Request } | { kind: "ready" } | { kind: "error"; request: Request; message: string }

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "–:––"
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

const usable = (candidate: LyricsCandidate) => !candidate.instrumental && candidate.plainText !== null
const defaultQuery = (song: Song) => `${song.artist} ${song.title}`

type Outcome = { kind: "ready"; results: LyricsCandidate[]; exactId: number | null } | Extract<Status, { kind: "error" }>

/** The exact recording first; when LRCLIB has none, a search for it. */
async function find(song: Song, request: Request, signal: AbortSignal): Promise<Outcome> {
  let current = request
  try {
    if (request.kind === "lookup") {
      const match = await lookupLyrics(song, signal)
      if (match) return { kind: "ready", results: [match], exactId: match.id }
      current = { kind: "search", query: defaultQuery(song) }
    }
    const results = await searchLyrics(current.kind === "search" ? current.query : defaultQuery(song), signal)
    return { kind: "ready", results, exactId: null }
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error
    const message = error instanceof LyricsLookupError ? error.message : "Lyrics lookup failed"
    // Retry only the step that failed, not the lookup that already missed.
    return { kind: "error", request: current, message }
  }
}

/**
 * Finds plain lyrics on LRCLIB through the local server: the exact recording
 * first (matched on its duration), then a search the user can refine.
 */
export function LyricsFinder({ song, onUse, onPaste }: { song: Song; onUse: (text: string) => void; onPaste: () => void }) {
  const [query, setQuery] = useState(defaultQuery(song))
  const [results, setResults] = useState<LyricsCandidate[]>([])
  const [exactId, setExactId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ kind: "loading", request: { kind: "lookup" } })
  // A new object per attempt, so "Try again" re-runs the same request.
  const [pending, setPending] = useState<{ request: Request }>({ request: { kind: "lookup" } })

  useEffect(() => {
    const controller = new AbortController()
    find(song, pending.request, controller.signal)
      .then((outcome) => {
        if (outcome.kind === "error") {
          setStatus(outcome)
          return
        }
        setResults(outcome.results)
        setExactId(outcome.exactId)
        setSelectedId(outcome.results.find(usable)?.id ?? null)
        setStatus({ kind: "ready" })
      })
      .catch(() => {
        // Aborted by a newer request or by leaving the tab.
      })
    return () => controller.abort()
  }, [song, pending])

  const start = (request: Request) => {
    setStatus({ kind: "loading", request })
    setPending({ request })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed) start({ kind: "search", query: trimmed })
  }

  const selected = results.find((candidate) => candidate.id === selectedId) ?? null
  const loading = status.kind === "loading"

  return (
    <div className="lyrics-finder">
      <form className="lyrics-finder-search" onSubmit={submit} role="search">
        <label className="lyrics-field">
          <span>Search lyrics</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} enterKeyHint="search" />
        </label>
        <Button type="submit" variant="outline" disabled={loading || !query.trim()}>Search</Button>
      </form>

      {status.kind === "loading" && (
        <p className="lyrics-muted" role="status">{status.request.kind === "lookup" ? "Looking for this recording…" : "Searching…"}</p>
      )}
      {status.kind === "error" && (
        <div className="lyrics-error lyrics-finder-error" role="alert">
          <p className="lyrics-error">{status.message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => start(status.request)}>Try again</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onPaste}>Paste lyrics instead</Button>
        </div>
      )}
      {status.kind === "ready" && results.length === 0 && (
        <div className="lyrics-finder-empty">
          <p className="lyrics-muted">No lyrics found. Change the search or paste them.</p>
          <Button type="button" variant="outline" size="sm" onClick={onPaste}>Paste lyrics</Button>
        </div>
      )}

      {status.kind === "ready" && results.length > 0 && (
        <>
          <div className="lyrics-finder-results" role="listbox" aria-label="Lyrics results">
            {results.map((candidate) => (
              <button
                type="button"
                role="option"
                key={candidate.id}
                aria-selected={candidate.id === selectedId}
                disabled={!usable(candidate)}
                className={`lyrics-finder-result${candidate.id === selectedId ? " selected" : ""}`}
                onClick={() => setSelectedId(candidate.id)}
              >
                <span className="lyrics-finder-result-title">{candidate.title}</span>
                <span className="lyrics-finder-result-meta">
                  {candidate.artist}
                  {candidate.album ? ` · ${candidate.album}` : ""} · {formatDuration(candidate.duration)}
                </span>
                <small>{candidate.id === exactId ? "Matches this recording" : candidate.instrumental ? "Instrumental" : candidate.plainText === null ? "No words" : ""}</small>
              </button>
            ))}
          </div>
          {selected?.plainText && (
            <>
              <div className="lyrics-text-preview" aria-label="Found lyrics preview">
                {selected.plainText.split("\n").filter((line) => line.trim()).map((line, index) => <span key={`${index}-${line}`}>{line}</span>)}
              </div>
              <div className="lyrics-editor-actions">
                <Button type="button" className="button-yellow" onClick={() => onUse(selected.plainText as string)}>Use these lyrics</Button>
              </div>
            </>
          )}
          <p className="lyrics-muted">Lyrics from LRCLIB. Timing is done here, against this recording.</p>
        </>
      )}
    </div>
  )
}
