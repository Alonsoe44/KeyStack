"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ChevronsLeft, ChevronsRight, Pause, Play, RotateCcw } from "lucide-react"
import type { LyricsDocument, Song } from "keystack-shared"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ApiRequestError, loadLyrics, loadSong } from "../adapters/songstreamer-client"
import { formatTime } from "../core/playback"
import { useSongPlayer } from "./SongPlayerProvider"
import { KaraokeLyrics } from "./KaraokeLyrics"
import { LyricsEditor } from "./LyricsEditor"
import { useLyricsNavigationGuard } from "./LyricsNavigationGuard"

const SKIP_SECONDS = 10

type LoadState = { status: "loading" } | { status: "ready" } | { status: "missing" } | { status: "error"; message: string }

function backToList() {
  window.location.hash = "#/"
}

export function SongPlayerScreen({ id }: { id: string }) {
  const player = useSongPlayer()
  const { songs, setSongs, open } = player
  const [cached] = useState<Song | undefined>(() => songs?.find((song) => song.id === id))
  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [lyrics, setLyrics] = useState<LyricsDocument | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(true)
  const [lyricsError, setLyricsError] = useState<string | null>(null)
  const [editingLyrics, setEditingLyrics] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { request: requestLyricsLeave } = useLyricsNavigationGuard()

  // Always confirm the song still exists; the cached list may be stale.
  useEffect(() => {
    const controller = new AbortController()
    loadSong(id, controller.signal)
      .then(async (song) => {
        open(song)
        setLoad({ status: "ready" })
        setLyricsLoading(true)
        setLyricsError(null)
        try {
          setLyrics(await loadLyrics(id, controller.signal))
        } catch (lyricsReason) {
          if (controller.signal.aborted || (lyricsReason as Error).name === "AbortError") return
          if (lyricsReason instanceof ApiRequestError && lyricsReason.code === "LYRICS_NOT_FOUND") {
            setLyrics(null)
          } else {
            setLyricsError(lyricsReason instanceof Error ? lyricsReason.message : "Could not load lyrics")
          }
        } finally {
          if (!controller.signal.aborted) setLyricsLoading(false)
        }
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return
        if (error instanceof ApiRequestError && error.code === "SONG_NOT_FOUND") {
          setSongs(null)
          setLoad({ status: "missing" })
        } else {
          setLoad({ status: "error", message: error.message })
        }
      })
    return () => controller.abort()
  }, [id, open, setSongs, attempt])

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const isCurrent = player.song?.id === id
  const song = isCurrent ? player.song : cached

  const savedLyrics = (document: LyricsDocument) => {
    setLyrics(document)
    setLyricsError(null)
    setEditingLyrics(false)
    player.setPlaybackRate(1)
    if (song) open({ ...song, hasLyrics: true })
    if (songs) setSongs(songs.map((item) => item.id === id ? { ...item, hasLyrics: true } : item))
  }

  return (
    <section className="song-player" aria-labelledby="song-player-title">
      <Button variant="ghost" size="sm" className="back-link" onClick={() => { if (!requestLyricsLeave(backToList)) backToList() }} aria-label="Back to songs">
        <ArrowLeft aria-hidden="true" />
        Songs
      </Button>

      {load.status === "missing" ? (
        <div className="song-player-body">
          <h1 id="song-player-title" ref={headingRef} tabIndex={-1} className="song-player-title">
            Not here anymore.
          </h1>
          <p className="status-error">This song is no longer available.</p>
          <a href="#/" className="song-player-link">Back to songs</a>
        </div>
      ) : (
        <>
          <div className="song-player-body">
            <span className="eyebrow">NOW PLAYING</span>
            <h1 id="song-player-title" ref={headingRef} tabIndex={-1} className="song-player-title">
              {song?.title ?? "Loading…"}
            </h1>
            <p className="song-player-artist">{song?.artist ?? " "}</p>
            <div className="song-lyrics" aria-label="Lyrics" role="region">
              {editingLyrics && song ? (
                <div className="lyrics-editor-overlay">
                  <LyricsEditor
                    song={song}
                    existing={lyrics}
                    onSaved={savedLyrics}
                    onCancel={() => {
                      setEditingLyrics(false)
                      player.setPlaybackRate(1)
                    }}
                  />
                </div>
              ) : lyrics ? (
                <>
                  <KaraokeLyrics document={lyrics} />
                  <Button type="button" variant="outline" size="sm" className="lyrics-edit-button" onClick={() => setEditingLyrics(true)}>Edit lyrics</Button>
                </>
              ) : lyricsLoading ? (
                <p className="lyrics-empty-message">Loading lyrics…</p>
              ) : (
                <div className="lyrics-empty-message">
                  {lyricsError ? <p className="status-error">{lyricsError}</p> : <p>No lyrics yet.</p>}
                  <Button type="button" className="button-yellow" onClick={() => setEditingLyrics(true)}>Add lyrics</Button>
                </div>
              )}
            </div>
          </div>

          {load.status === "error" ? (
            <div className="song-list-message">
              <p className="status-error">{load.message}</p>
              <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
                <RotateCcw aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : (
            <PlayerControls fallbackDuration={song?.duration ?? 0} active={isCurrent} />
          )}
        </>
      )}
    </section>
  )
}

function PlayerControls({ fallbackDuration, active }: { fallbackDuration: number; active: boolean }) {
  const { phase, currentTime, duration, bufferedEnd, buffering, errorMessage, togglePlay, seekBy, seekTo, retry } =
    useSongPlayer()
  const [preview, setPreview] = useState<number | null>(null)
  const previewRef = useRef<number | null>(null)
  const sliderRef = useRef<HTMLInputElement>(null)

  // React's onChange fires on every input; seek only on the native `change` (release).
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider) return
    const commit = () => {
      if (previewRef.current !== null) seekTo(previewRef.current)
      previewRef.current = null
      setPreview(null)
    }
    const cancel = () => {
      previewRef.current = null
      setPreview(null)
    }
    slider.addEventListener("change", commit)
    slider.addEventListener("pointercancel", cancel)
    return () => {
      slider.removeEventListener("change", commit)
      slider.removeEventListener("pointercancel", cancel)
    }
  }, [seekTo])

  const canSeek = active && duration !== null
  const canPlay = active && phase !== "loading" && phase !== "error"
  const isPlaying = active && phase === "playing"
  const position = preview ?? (active ? currentTime : 0)
  const total = duration ?? fallbackDuration
  const status = !active
    ? "Loading…"
    : phase === "error"
      ? null
      : errorMessage ?? (buffering ? "Buffering…" : phase === "loading" ? "Loading audio…" : "")

  return (
    <div className="player-bar">
      <div className="player-buttons">
        <Button
          variant="outline"
          size="lg"
          onClick={() => seekBy(-SKIP_SECONDS)}
          disabled={!canSeek}
          aria-label="Back 10 seconds"
        >
          <ChevronsLeft aria-hidden="true" />
          10
        </Button>
        <Button
          size="lg"
          className="button-yellow player-play"
          onClick={() => void togglePlay()}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => seekBy(SKIP_SECONDS)}
          disabled={!canSeek}
          aria-label="Forward 10 seconds"
        >
          10
          <ChevronsRight aria-hidden="true" />
        </Button>
      </div>

      <div className="player-timeline">
        <label htmlFor="timeline" className="sr-only">
          Playback position
        </label>
        <div
          className="player-buffered"
          aria-hidden="true"
          style={{ width: total > 0 ? `${Math.min(100, (bufferedEnd / total) * 100)}%` : "0%" }}
        />
        <input
          ref={sliderRef}
          id="timeline"
          type="range"
          min={0}
          max={duration ?? 0}
          step={0.01}
          value={position}
          disabled={!canSeek}
          aria-valuetext={formatTime(position)}
          onChange={(event) => {
            const value = Number(event.target.value)
            previewRef.current = value
            setPreview(value)
          }}
        />
      </div>

      <span className="player-time">
        {formatTime(position)} / {formatTime(total)}
      </span>

      <div className={cn("player-status", phase === "error" && "player-status-error")} aria-live="polite">
        {active && phase === "error" ? (
          <>
            <span>{errorMessage}</span>
            <Button variant="outline" size="sm" onClick={retry}>
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          </>
        ) : (
          status
        )}
      </div>
    </div>
  )
}
