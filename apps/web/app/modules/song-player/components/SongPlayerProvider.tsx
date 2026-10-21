"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Song } from "keystack-shared"

import { songAudioUrl } from "../adapters/songstreamer-client"
import { clamp, seekTarget, type PlaybackPhase } from "../core/playback"

export type PlayerState = {
  song: Song | null
  phase: PlaybackPhase
  currentTime: number
  /** From the media element once metadata arrives; the source of truth for seeking. */
  duration: number | null
  bufferedEnd: number
  buffering: boolean
  errorMessage: string | null
  playbackRate: number
}

type SongPlayer = PlayerState & {
  /** Load a song; a no-op when it is already loaded, so position and play state survive. */
  open(song: Song): void
  togglePlay(): Promise<void>
  seekBy(seconds: number): void
  seekTo(seconds: number): void
  retry(): void
  /** Read the media clock directly, including between React timeupdate events. */
  getCurrentTime(): number
  setPlaybackRate(rate: number): void
  /** In-memory song list cache, so returning to the list does not refetch. */
  songs: Song[] | null
  setSongs(songs: Song[] | null): void
}

const initialState: PlayerState = {
  song: null,
  phase: "idle",
  currentTime: 0,
  duration: null,
  bufferedEnd: 0,
  buffering: false,
  errorMessage: null,
  playbackRate: 1,
}

const SongPlayerContext = createContext<SongPlayer | null>(null)

const finiteDuration = (audio: HTMLAudioElement) =>
  Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null

/**
 * Owns the app's single HTMLAudioElement. Mounted in the root layout so
 * playback keeps going while the kiosk moves between routes.
 */
export function SongPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const songIdRef = useRef<string | null>(null)
  const audioHashRef = useRef<string | null>(null)
  const [state, setState] = useState<PlayerState>(initialState)
  const [songs, setSongs] = useState<Song[] | null>(null)

  useEffect(() => {
    const audio = new Audio()
    audio.preload = "metadata"
    audioRef.current = audio

    const patch = (next: Partial<PlayerState>) => setState((prev) => ({ ...prev, ...next }))
    const readDuration = () => patch({ duration: finiteDuration(audio) })
    const handlers: Record<string, () => void> = {
      loadstart: () => patch({ phase: "loading", errorMessage: null, duration: null, bufferedEnd: 0 }),
      loadedmetadata: readDuration,
      durationchange: readDuration,
      canplay: () =>
        setState((prev) => ({
          ...prev,
          buffering: false,
          phase: prev.phase === "loading" ? "ready" : prev.phase,
        })),
      play: () => patch({ phase: "playing", errorMessage: null }),
      playing: () => patch({ buffering: false }),
      pause: () => setState((prev) => ({ ...prev, phase: audio.ended ? "ended" : "paused" })),
      ended: () => patch({ phase: "ended", buffering: false }),
      timeupdate: () => patch({ currentTime: audio.currentTime }),
      progress: () => {
        const { buffered } = audio
        patch({ bufferedEnd: buffered.length > 0 ? buffered.end(buffered.length - 1) : 0 })
      },
      waiting: () => patch({ buffering: true }),
      stalled: () => patch({ buffering: true }),
      error: () => patch({ phase: "error", buffering: false, errorMessage: "Playback failed" }),
    }
    for (const [type, handler] of Object.entries(handlers)) audio.addEventListener(type, handler)

    return () => {
      for (const [type, handler] of Object.entries(handlers)) audio.removeEventListener(type, handler)
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      audioRef.current = null
    }
  }, [])

  const open = useCallback((song: Song) => {
    const audio = audioRef.current
    if (!audio) return
    // Same recording: keep the stream. A changed hash means new audio behind the same ID.
    if (songIdRef.current === song.id && audioHashRef.current === song.audioSha256) {
      setState((prev) => ({ ...prev, song }))
      return
    }
    audioHashRef.current = song.audioSha256
    songIdRef.current = song.id
    audio.pause()
    audio.playbackRate = 1
    setState({ ...initialState, song, phase: "loading" })
    // The browser streams with native Range requests; never fetch the file ourselves.
    // The hash query keeps a cached older recording from being reused after a replacement.
    audio.src = song.audioSha256 ? `${songAudioUrl(song.id)}?v=${song.audioSha256}` : songAudioUrl(song.id)
    audio.load()
  }, [])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    const songAtClick = songIdRef.current
    if (!audio || !songAtClick) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (audio.ended) audio.currentTime = 0
    try {
      await audio.play()
    } catch (error) {
      if (songAtClick !== songIdRef.current) return
      const message =
        (error as Error)?.name === "NotAllowedError" ? "Press Play to start audio" : "Playback could not start"
      setState((prev) => ({ ...prev, errorMessage: message }))
    }
  }, [])

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !songIdRef.current) return
    const { seekable } = audio
    const target = seekTarget(
      audio.currentTime,
      seconds,
      audio.duration,
      seekable.length > 0 ? { start: seekable.start(0), end: seekable.end(seekable.length - 1) } : null
    )
    if (target === null) return
    audio.currentTime = target
    setState((prev) => ({ ...prev, currentTime: target }))
  }, [])

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    const duration = audio ? finiteDuration(audio) : null
    if (!audio || duration === null) return
    const target = clamp(seconds, 0, duration)
    audio.currentTime = target
    setState((prev) => ({ ...prev, currentTime: target }))
  }, [])

  const retry = useCallback(() => {
    audioRef.current?.load()
  }, [])

  const getCurrentTime = useCallback(() => {
    const time = audioRef.current?.currentTime
    return time !== undefined && Number.isFinite(time) ? time : 0
  }, [])

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current
    const next = Math.min(1.25, Math.max(0.5, Number.isFinite(rate) ? rate : 1))
    if (audio) audio.playbackRate = next
    setState((prev) => ({ ...prev, playbackRate: next }))
  }, [])

  const value = useMemo<SongPlayer>(
    () => ({ ...state, open, togglePlay, seekBy, seekTo, retry, getCurrentTime, setPlaybackRate, songs, setSongs }),
    [state, open, togglePlay, seekBy, seekTo, retry, getCurrentTime, setPlaybackRate, songs]
  )

  return <SongPlayerContext.Provider value={value}>{children}</SongPlayerContext.Provider>
}

export function useSongPlayer(): SongPlayer {
  const player = useContext(SongPlayerContext)
  if (!player) throw new Error("useSongPlayer must be used inside SongPlayerProvider")
  return player
}
