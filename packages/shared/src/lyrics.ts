/**
 * Versioned karaoke data shared by the editor, player, and SongStreamer API.
 *
 * Timestamps are integer milliseconds from the beginning of the exact audio
 * recording identified by songId/audioSha256. Drafts are editor-only and are
 * never represented by this persisted contract.
 */
export const LYRICS_SCHEMA_VERSION = 1 as const

export type LyricsReviewStatus = "complete"

export type LyricWord = {
  id: string
  text: string
  startMs: number
  endMs?: number
}

export type LyricLine = {
  id: string
  text: string
  startMs: number
  endMs: number
  words: LyricWord[]
}

export type LyricsDocument = {
  schemaVersion: typeof LYRICS_SCHEMA_VERSION
  songId: string
  /** SHA-256 of the published recording. Legacy manually-added files may be null. */
  audioSha256: string | null
  language: string
  reviewStatus: LyricsReviewStatus
  lines: LyricLine[]
  /** Monotonically increasing replacement number assigned by SongStreamer. */
  documentVersion: number
  createdAt?: string
  updatedAt?: string
}

export type LyricsSaveRequest = Pick<
  LyricsDocument,
  "schemaVersion" | "songId" | "audioSha256" | "language" | "reviewStatus" | "lines"
>

export type LyricsResponse = LyricsDocument
