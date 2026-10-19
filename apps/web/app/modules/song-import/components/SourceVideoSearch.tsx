"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SourceVideo } from "keystack-shared"
import { ArrowLeft, Check, LoaderCircle, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchSourceVideos } from "../adapters/songstreamer-import-client"
import { SourceVideoPreview } from "./SourceVideoPreview"

// Videos longer than this get a badge; they are usually loops or compilations.
const LONG_VIDEO_SECONDS = 15 * 60

function formatDuration(seconds: number | null) {
  if (seconds === null) return ""
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; query: string; videos: SourceVideo[] }
  | { kind: "error"; message: string }

/**
 * Full-screen YouTube search for the kiosk, which has no tabs or address bar.
 * It stays mounted while hidden so the last search survives closing it; the
 * preview is dropped on close so nothing keeps playing in the background.
 */
export function SourceVideoSearch({
  open,
  onClose,
  onUse,
}: {
  open: boolean
  onClose: () => void
  onUse: (video: SourceVideo) => void
}) {
  const [query, setQuery] = useState("")
  const [state, setState] = useState<SearchState>({ kind: "idle" })
  const [selected, setSelected] = useState<SourceVideo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const close = useCallback(() => {
    setSelected(null)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    if (!selected) inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (selected) setSelected(null)
      else close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close, open, selected])

  useEffect(() => () => abortRef.current?.abort(), [])

  const search = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSelected(null)
    setState({ kind: "loading" })
    try {
      const videos = await searchSourceVideos(text, controller.signal)
      if (!controller.signal.aborted) setState({ kind: "done", query: text, videos })
    } catch (reason) {
      if (controller.signal.aborted) return
      setState({ kind: "error", message: reason instanceof Error ? reason.message : "Search failed" })
    }
  }, [query])

  return (
    <div
      className="source-search"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-search-heading"
      hidden={!open}
    >
      <div className="source-search-top">
        <h2 id="source-search-heading" className="sr-only">Find a song on YouTube</h2>
        {selected ? (
          <Button type="button" variant="outline" onClick={() => setSelected(null)}>
            <ArrowLeft aria-hidden="true" />
            Back to results
          </Button>
        ) : (
          <form className="source-search-form" onSubmit={(event) => void search(event)}>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Song or artist, e.g. Let It Be piano"
              aria-label="Search YouTube"
              autoComplete="off"
              enterKeyHint="search"
            />
            <Button type="submit" className="button-yellow" disabled={state.kind === "loading" || !query.trim()}>
              {state.kind === "loading" ? <LoaderCircle className="import-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
              Search
            </Button>
          </form>
        )}
        <Button type="button" variant="outline" className="source-search-close" onClick={close} aria-label="Close search">
          <X aria-hidden="true" />
        </Button>
      </div>

      {open && selected ? (
        <div className="source-preview">
          <SourceVideoPreview video={selected} />
          <div className="source-preview-side">
            <div className="source-preview-copy">
              <span className="eyebrow">PREVIEW</span>
              <strong>{selected.title}</strong>
              <span>{[selected.channel, formatDuration(selected.durationSeconds)].filter(Boolean).join(" · ")}</span>
            </div>
            <Button
              type="button"
              className="button-yellow source-use"
              onClick={() => {
                const video = selected
                setSelected(null)
                onUse(video)
              }}
            >
              <Check aria-hidden="true" />
              Use this song
            </Button>
          </div>
        </div>
      ) : (
        <ScrollArea className="source-results" viewportProps={{ "aria-live": "polite", "aria-busy": state.kind === "loading" }}>
          {state.kind === "idle" && <p className="source-search-note">Search YouTube, tap a result to preview it, then use it.</p>}
          {state.kind === "loading" && <p className="source-search-note">Searching YouTube…</p>}
          {state.kind === "error" && <p className="status-error" role="alert">{state.message}</p>}
          {state.kind === "done" && state.videos.length === 0 && (
            <p className="source-search-note">No videos found for “{state.query}”. Try different words.</p>
          )}
          {state.kind === "done" && state.videos.length > 0 && (
            <ul className="source-result-list">
              {state.videos.map((video) => (
                <li key={video.id}>
                  <button type="button" className="source-result" onClick={() => setSelected(video)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- static export, YouTube-hosted thumbnail */}
                    <img src={video.thumbnailUrl} alt="" loading="lazy" />
                    <span className="source-result-copy">
                      <strong>{video.title}</strong>
                      <span>{video.channel ?? "Unknown channel"}</span>
                    </span>
                    <span className="source-result-meta">
                      {formatDuration(video.durationSeconds)}
                      {video.durationSeconds !== null && video.durationSeconds > LONG_VIDEO_SECONDS && (
                        <span className="source-long-badge">{Math.round(video.durationSeconds / 60)} min</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      )}
    </div>
  )
}
