"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowUpRight, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { isHealthy, loadSongs } from "../adapters/songstreamer-client"
import { formatTime } from "../core/playback"
import { songHref } from "../core/songs-route"
import { useSongPlayer } from "./SongPlayerProvider"

export function SongList() {
  const { songs, setSongs, song: loadedSong, phase } = useSongPlayer()
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (songs) return
    const controller = new AbortController()
    loadSongs(controller.signal)
      .then((list) => {
        setError(null)
        setSongs(list)
      })
      .catch(async (reason: Error) => {
        if (reason.name === "AbortError") return
        const reachable = await isHealthy()
        if (!controller.signal.aborted) {
          setError(reachable ? reason.message : "The song server is unreachable.")
        }
      })
    return () => controller.abort()
  }, [songs, setSongs, attempt])

  // Return focus to the card of the song that was open.
  useEffect(() => {
    if (!songs || !loadedSong) return
    document.querySelector<HTMLElement>(`[data-song-id="${CSS.escape(loadedSong.id)}"]`)?.focus()
  }, [songs, loadedSong])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  return (
    <section className="song-list-panel" aria-labelledby="song-list-heading" aria-busy={!songs && !error}>
      <div className="panel-topline">
        <div>
          <span className="eyebrow">SONG LIBRARY</span>
          <h1 id="song-list-heading" className="panel-heading">Pick a song.</h1>
        </div>
      </div>

      <div aria-live="polite">
        {error ? (
          <div className="song-list-message">
            <p className="status-error">{error}</p>
            <Button variant="outline" onClick={retry}>
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : !songs ? (
          <p className="song-list-message">Loading songs…</p>
        ) : songs.length === 0 ? (
          <p className="song-list-message">No songs yet.</p>
        ) : null}
      </div>

      {songs && songs.length > 0 && (
        <ul className="song-list">
          {songs.map((song) => {
            const isPlaying = loadedSong?.id === song.id && phase === "playing"
            return (
              <li key={song.id}>
                <a href={songHref(song.id)} className="song-card" data-song-id={song.id}>
                  <span className="song-card-copy">
                    <strong className="song-title">{song.title}</strong>
                    <span className="song-artist">{song.artist}</span>
                    <span className="song-meta">
                      {song.album ? `${song.album} / ` : ""}
                      {formatTime(song.duration)}
                    </span>
                  </span>
                  {isPlaying && <span className="song-playing-chip">PLAYING</span>}
                  <span className="scale-card-arrow" aria-hidden="true">
                    <ArrowUpRight />
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
