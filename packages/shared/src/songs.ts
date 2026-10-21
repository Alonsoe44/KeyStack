// Contracts of the SongStreamer API on the cloud/server Pi.
// See backend-endpoints.md.

export type Song = {
  id: string
  title: string
  artist: string
  album: string | null
  /** Seconds, e.g. 306.676009 */
  duration: number
  /** True when complete lyrics exist for this exact recording. */
  hasLyrics: boolean
  /** SHA-256 of the exact published recording, or null for legacy rows. */
  audioSha256: string | null
}

export type SongsResponse = { songs: Song[] }

export type SongStreamerError = { error: { code: string; message: string } }
