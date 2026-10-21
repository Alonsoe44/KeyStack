import { Router } from "express"
import type { PowerOffResponse } from "keystack-shared"
import type { LoggerPort } from "../../ports/LoggerPort"
import type { SystemPowerPort } from "../../ports/SystemPowerPort"

export function systemRoutes(
  power: SystemPowerPort,
  logger: LoggerPort
): Router {
  const router = Router()

  router.post("/system/poweroff", async (req, res) => {
    // A JSON content type can't be sent cross-origin without a CORS
    // preflight, so another website open in a browser on the network can't
    // switch the Pi off with a plain form post.
    if (!req.get("content-type")?.startsWith("application/json")) {
      res.status(415).json({
        ok: false,
        error: "Content-Type must be application/json",
      } satisfies PowerOffResponse)
      return
    }

    logger.warn("Power off requested from the UI")
    try {
      await power.powerOff()
      res.json({ ok: true } satisfies PowerOffResponse)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.error(`Power off failed: ${error}`)
      res.status(500).json({ ok: false, error } satisfies PowerOffResponse)
    }
  })

  return router
}
