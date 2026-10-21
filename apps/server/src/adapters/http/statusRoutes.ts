import { Router } from "express"
import type {
  HealthResponse,
  MidiConnectionStatus,
  StatusResponse,
} from "keystack-shared"

export function statusRoutes(
  getMidiStatus: () => MidiConnectionStatus
): Router {
  const router = Router()

  router.get("/status", (_req, res) => {
    res.json({ midi: getMidiStatus() } satisfies StatusResponse)
  })

  router.get("/health", (_req, res) => {
    res.json({ ok: true } satisfies HealthResponse)
  })

  return router
}
