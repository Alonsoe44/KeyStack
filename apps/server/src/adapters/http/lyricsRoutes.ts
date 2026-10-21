import { Router, type Response } from "express"
import type { LyricsLookupError, LyricsLookupResponse, LyricsSearchResponse } from "keystack-shared"
import type { LoggerPort } from "../../ports/LoggerPort"
import { LyricsSourceError, type LyricsSourcePort } from "../../ports/LyricsSourcePort"

const MAX_TEXT = 200
// Longer than any song in the catalogue; rejects nonsense, not long tracks.
const MAX_DURATION_SECONDS = 4 * 60 * 60

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" || trimmed.length > MAX_TEXT ? null : trimmed
}

function invalid(res: Response, message: string): void {
  res.status(400).json({ error: { code: "INVALID_REQUEST", message } } satisfies LyricsLookupError)
}

export function lyricsRoutes(source: LyricsSourcePort, logger: LoggerPort): Router {
  const router = Router()

  const failed = (res: Response, err: unknown) => {
    if (err instanceof LyricsSourceError) {
      logger.warn(`Lyrics lookup failed: ${err.code} ${err.message}`)
      res.status(err.code === "LYRICS_SOURCE_TIMEOUT" ? 504 : 502).json({ error: { code: err.code, message: err.message } } satisfies LyricsLookupError)
      return
    }
    logger.error(`Lyrics lookup crashed: ${(err as Error).message}`)
    res.status(502).json({ error: { code: "LYRICS_SOURCE_UNAVAILABLE", message: "Could not look up lyrics" } } satisfies LyricsLookupError)
  }

  router.get("/lyrics/lookup", async (req, res) => {
    const title = text(req.query.title)
    const artist = text(req.query.artist)
    if (!title || !artist) return invalid(res, `title and artist are required, up to ${MAX_TEXT} characters`)
    let album: string | null = null
    if (req.query.album !== undefined && req.query.album !== "") {
      album = text(req.query.album)
      if (!album) return invalid(res, `album must be up to ${MAX_TEXT} characters`)
    }
    let duration: number | null = null
    if (req.query.duration !== undefined && req.query.duration !== "") {
      duration = Number(req.query.duration)
      if (typeof req.query.duration !== "string" || !Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
        return invalid(res, "duration must be a positive number of seconds")
      }
    }
    try {
      res.json({ match: await source.lookup({ title, artist, album, duration }) } satisfies LyricsLookupResponse)
    } catch (err) {
      failed(res, err)
    }
  })

  router.get("/lyrics/search", async (req, res) => {
    const q = text(req.query.q)
    if (!q) return invalid(res, `q is required, up to ${MAX_TEXT} characters`)
    try {
      res.json({ results: await source.search(q) } satisfies LyricsSearchResponse)
    } catch (err) {
      failed(res, err)
    }
  })

  return router
}
