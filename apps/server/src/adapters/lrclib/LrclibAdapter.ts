import type { LyricsCandidate } from "keystack-shared"
import { plainTextFrom } from "../../domain/lyrics-lookup/plainText"
import { type LyricsLookupQuery, LyricsSourceError, type LyricsSourcePort } from "../../ports/LyricsSourcePort"

export type LrclibOptions = {
  baseUrl: string
  timeoutMs: number
  userAgent: string
  fetch?: typeof fetch
}

const MAX_SEARCH_RESULTS = 20

/** One record as LRCLIB returns it from /api/get and /api/search. */
function toCandidate(value: unknown): LyricsCandidate | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  const optionalString = (field: unknown) => field === null || field === undefined || typeof field === "string"
  if (
    !Number.isInteger(record.id) ||
    typeof record.trackName !== "string" ||
    typeof record.artistName !== "string" ||
    !optionalString(record.albumName) ||
    !(record.duration === null || record.duration === undefined || typeof record.duration === "number") ||
    !optionalString(record.plainLyrics) ||
    !optionalString(record.syncedLyrics)
  ) {
    return null
  }
  const instrumental = record.instrumental === true
  return {
    id: record.id as number,
    title: record.trackName,
    artist: record.artistName,
    album: (record.albumName as string | null | undefined) || null,
    duration: (record.duration as number | null | undefined) ?? null,
    instrumental,
    plainText: instrumental
      ? null
      : plainTextFrom((record.plainLyrics as string | null | undefined) ?? null, (record.syncedLyrics as string | null | undefined) ?? null),
  }
}

export class LrclibAdapter implements LyricsSourcePort {
  private readonly fetch: typeof fetch

  constructor(private readonly options: LrclibOptions) {
    this.fetch = options.fetch ?? globalThis.fetch
  }

  async lookup(query: LyricsLookupQuery): Promise<LyricsCandidate | null> {
    const params = new URLSearchParams({ track_name: query.title, artist_name: query.artist })
    if (query.album) params.set("album_name", query.album)
    // LRCLIB matches the duration within about two seconds.
    if (query.duration !== null) params.set("duration", String(Math.round(query.duration)))
    const body = await this.get(`/api/get?${params}`, true)
    if (body === null) return null
    const candidate = toCandidate(body)
    if (!candidate) throw new LyricsSourceError("LYRICS_SOURCE_INVALID_RESPONSE", "The lyrics service sent an unexpected answer")
    return candidate
  }

  async search(query: string): Promise<LyricsCandidate[]> {
    const body = await this.get(`/api/search?${new URLSearchParams({ q: query })}`, false)
    if (!Array.isArray(body)) throw new LyricsSourceError("LYRICS_SOURCE_INVALID_RESPONSE", "The lyrics service sent an unexpected answer")
    // A malformed record is skipped rather than failing the whole list.
    return body
      .map(toCandidate)
      .filter((candidate): candidate is LyricsCandidate => candidate !== null)
      .slice(0, MAX_SEARCH_RESULTS)
  }

  /** Parsed JSON, or null for a 404 when `notFoundIsEmpty`. */
  private async get(path: string, notFoundIsEmpty: boolean): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetch(`${this.options.baseUrl}${path}`, {
        headers: { Accept: "application/json", "User-Agent": this.options.userAgent },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      })
    } catch (err) {
      if ((err as Error).name === "TimeoutError") {
        throw new LyricsSourceError("LYRICS_SOURCE_TIMEOUT", "The lyrics service took too long to answer")
      }
      throw new LyricsSourceError("LYRICS_SOURCE_UNAVAILABLE", "Could not reach the lyrics service")
    }
    if (response.status === 404 && notFoundIsEmpty) return null
    if (!response.ok) {
      throw new LyricsSourceError("LYRICS_SOURCE_UNAVAILABLE", `The lyrics service answered ${response.status}`)
    }
    try {
      return await response.json()
    } catch {
      throw new LyricsSourceError("LYRICS_SOURCE_INVALID_RESPONSE", "The lyrics service sent an unexpected answer")
    }
  }
}
