import type { LyricsDocument, LyricsSaveRequest, Song } from "keystack-shared"

// The SongStreamer API is a separate origin (the cloud/server Pi).
const API_BASE = (process.env.NEXT_PUBLIC_SONGS_API_BASE_URL ?? "").replace(/\/+$/, "")

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export const songUrl = (id: string) => `${API_BASE}/songs/${encodeURIComponent(id)}`
export const songAudioUrl = (id: string) => `${songUrl(id)}/audio`
export const lyricsUrl = (id: string) => `${API_BASE}/api/v1/songs/${encodeURIComponent(id)}/lyrics`

function isSong(value: unknown): value is Song {
  if (typeof value !== "object" || value === null) return false
  const song = value as Record<string, unknown>
  return (
    typeof song.id === "string" &&
    typeof song.title === "string" &&
    typeof song.artist === "string" &&
    (song.album === null || typeof song.album === "string") &&
    typeof song.duration === "number" &&
    typeof song.hasLyrics === "boolean" &&
    (song.audioSha256 === null || typeof song.audioSha256 === "string")
  )
}

async function getJson(url: string, signal?: AbortSignal, init: RequestInit = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
      mode: "cors",
      signal,
    })
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error
    throw new ApiRequestError(0, "NETWORK_ERROR", "Could not reach the song server")
  }

  let body: { error?: { code?: unknown; message?: unknown } } | null = null
  try {
    body = await response.json()
  } catch {
    // Handled below.
  }

  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : `HTTP_${response.status}`
    const message = typeof body?.error?.message === "string" ? body.error.message : "Request failed"
    throw new ApiRequestError(response.status, code, message)
  }
  if (body === null) throw new ApiRequestError(response.status, "INVALID_JSON", "Invalid server response")
  return body
}

export async function loadSongs(signal?: AbortSignal): Promise<Song[]> {
  const body = (await getJson(`${API_BASE}/songs`, signal)) as { songs?: unknown }
  if (!Array.isArray(body.songs) || !body.songs.every(isSong)) {
    throw new ApiRequestError(200, "INVALID_SHAPE", "Invalid song list")
  }
  return body.songs
}

/** Throws ApiRequestError with code SONG_NOT_FOUND on 404. */
export async function loadSong(id: string, signal?: AbortSignal): Promise<Song> {
  const body = await getJson(songUrl(id), signal)
  if (!isSong(body)) throw new ApiRequestError(200, "INVALID_SHAPE", "Invalid song")
  return body
}

export async function isHealthy(): Promise<boolean> {
  try {
    const body = (await getJson(`${API_BASE}/health`)) as { status?: unknown }
    return body.status === "ok"
  } catch {
    return false
  }
}

export async function loadLyrics(id: string, signal?: AbortSignal): Promise<LyricsDocument> {
  return (await getJson(lyricsUrl(id), signal)) as LyricsDocument
}

export async function saveLyrics(id: string, request: LyricsSaveRequest): Promise<LyricsDocument> {
  return (await getJson(lyricsUrl(id), undefined, {
    method: "PUT",
    body: JSON.stringify(request),
    headers: { "Content-Type": "application/json" },
  })) as LyricsDocument
}
