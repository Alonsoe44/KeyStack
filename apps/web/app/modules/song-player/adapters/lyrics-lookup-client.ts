import type { LyricsCandidate, LyricsLookupResponse, LyricsSearchResponse, Song } from "keystack-shared"

// The local KeyStack server proxies LRCLIB; the browser never calls it directly.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "")

export class LyricsLookupError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

function isCandidate(value: unknown): value is LyricsCandidate {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.artist === "string" &&
    (candidate.album === null || typeof candidate.album === "string") &&
    (candidate.duration === null || typeof candidate.duration === "number") &&
    typeof candidate.instrumental === "boolean" &&
    (candidate.plainText === null || typeof candidate.plainText === "string")
  )
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" }, signal })
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error
    throw new LyricsLookupError("NETWORK_ERROR", "Can't reach the piano server")
  }
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown; message?: unknown } } | null
  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : `HTTP_${response.status}`
    const message = typeof body?.error?.message === "string" ? body.error.message : "Lyrics lookup failed"
    throw new LyricsLookupError(code, message)
  }
  if (body === null) throw new LyricsLookupError("INVALID_JSON", "Invalid lyrics lookup response")
  return body
}

/** LRCLIB's record for this exact recording, matched on its duration. */
export async function lookupLyrics(song: Song, signal?: AbortSignal): Promise<LyricsCandidate | null> {
  const params = new URLSearchParams({ title: song.title, artist: song.artist, duration: String(song.duration) })
  if (song.album) params.set("album", song.album)
  const body = (await getJson(`/api/v1/lyrics/lookup?${params}`, signal)) as Partial<LyricsLookupResponse>
  if (body.match === null) return null
  if (!isCandidate(body.match)) throw new LyricsLookupError("INVALID_RESPONSE", "Invalid lyrics lookup response")
  return body.match
}

export async function searchLyrics(query: string, signal?: AbortSignal): Promise<LyricsCandidate[]> {
  const body = (await getJson(`/api/v1/lyrics/search?${new URLSearchParams({ q: query })}`, signal)) as Partial<LyricsSearchResponse>
  if (!Array.isArray(body.results) || !body.results.every(isCandidate)) {
    throw new LyricsLookupError("INVALID_RESPONSE", "Invalid lyrics search response")
  }
  return body.results
}
