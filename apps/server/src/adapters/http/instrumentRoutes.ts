import { Router, json } from "express"
import type { InstrumentSelectResponse, InstrumentStateResponse } from "keystack-shared"
import { type InstrumentService, isInstrumentId, isVolume } from "../../domain/instruments/instruments"

export function instrumentRoutes(instruments: InstrumentService): Router {
  const router = Router()

  router.get("/instruments", (_req, res) => {
    res.json({
      selected: instruments.getSelected(),
      volume: instruments.getVolume(),
    } satisfies InstrumentStateResponse)
  })

  router.post("/instruments/volume", json({ limit: "1kb" }), async (req, res) => {
    if (!req.is("application/json")) {
      res.status(415).json({ ok: false, error: "Content-Type must be application/json" } satisfies InstrumentSelectResponse)
      return
    }
    const volume: unknown = req.body?.volume
    if (!isVolume(volume)) {
      res.status(400).json({ ok: false, error: "volume must be an integer from 0 to 100" } satisfies InstrumentSelectResponse)
      return
    }
    try {
      await instruments.setVolume(volume)
      res.json({ ok: true } satisfies InstrumentSelectResponse)
    } catch (err) {
      res.status(503).json({ ok: false, error: (err as Error).message } satisfies InstrumentSelectResponse)
    }
  })

  router.post("/instruments/select", json({ limit: "1kb" }), async (req, res) => {
    // Same rule as power off: JSON only, so a cross-site form can't post here.
    if (!req.is("application/json")) {
      res.status(415).json({ ok: false, error: "Content-Type must be application/json" } satisfies InstrumentSelectResponse)
      return
    }
    const instrumentId: unknown = req.body?.instrumentId
    if (!isInstrumentId(instrumentId)) {
      res.status(400).json({ ok: false, error: "Unknown instrumentId" } satisfies InstrumentSelectResponse)
      return
    }
    try {
      await instruments.select(instrumentId)
      res.json({ ok: true } satisfies InstrumentSelectResponse)
    } catch (err) {
      // The synth being down is temporary, not a client error.
      res.status(503).json({ ok: false, error: (err as Error).message } satisfies InstrumentSelectResponse)
    }
  })

  return router
}
