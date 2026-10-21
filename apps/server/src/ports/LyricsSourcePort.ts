import type { LyricsCandidate, LyricsLookupErrorCode } from "keystack-shared"

export type LyricsLookupQuery = {
  title: string
  artist: string
  album: string | null
  /** Seconds of the exact recording, so a different version is not matched. */
  duration: number | null
}

export interface LyricsSourcePort {
  /** The single record matching this recording, or null when there is none. */
  lookup(query: LyricsLookupQuery): Promise<LyricsCandidate | null>
  search(query: string): Promise<LyricsCandidate[]>
}

/** A failure of the lyrics source itself, not of the caller's request. */
export class LyricsSourceError extends Error {
  constructor(
    readonly code: Exclude<LyricsLookupErrorCode, "INVALID_REQUEST">,
    message: string
  ) {
    super(message)
  }
}
