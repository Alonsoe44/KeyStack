/**
 * Lyrics lookup on the local server, backed by LRCLIB (https://lrclib.net).
 *
 * Only plain text is returned: the editor times every line and word against
 * the exact recording, so LRCLIB's own timings are never used.
 */
export type LyricsCandidate = {
  /** LRCLIB record id. */
  id: number
  title: string
  artist: string
  album: string | null
  /** Seconds, as reported by LRCLIB. */
  duration: number | null
  instrumental: boolean
  /** One lyric line per text line; null when the record has no words. */
  plainText: string | null
}

/** GET /api/v1/lyrics/lookup?title=&artist=&album=&duration= */
export type LyricsLookupResponse = { match: LyricsCandidate | null }

/** GET /api/v1/lyrics/search?q= */
export type LyricsSearchResponse = { results: LyricsCandidate[] }

export type LyricsLookupErrorCode =
  | "INVALID_REQUEST"
  | "LYRICS_SOURCE_TIMEOUT"
  | "LYRICS_SOURCE_UNAVAILABLE"
  | "LYRICS_SOURCE_INVALID_RESPONSE"

export type LyricsLookupError = { error: { code: LyricsLookupErrorCode; message: string } }
