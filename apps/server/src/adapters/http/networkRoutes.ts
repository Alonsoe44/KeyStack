import { Router, json, type Request, type Response } from "express"
import type { HotspotResponse, NearbyNetworksResponse, NetworkError, NetworkErrorCode, NetworkStatusResponse } from "keystack-shared"
import type { LoggerPort } from "../../ports/LoggerPort"
import { NetworkPortError, type NetworkPort } from "../../ports/NetworkPort"

const STATUS: Record<NetworkErrorCode, number> = {
  INVALID_REQUEST: 400,
  HOTSPOT_NOT_SAVED: 409,
  BUSY: 409,
  NETWORK_NOT_FOUND: 404,
  WRONG_PASSWORD: 422,
  CONNECT_TIMEOUT: 504,
  NETWORK_UNAVAILABLE: 503,
}

function fail(res: Response, code: NetworkErrorCode, message: string): void {
  res.status(STATUS[code]).json({ error: { code, message } } satisfies NetworkError)
}

/** An SSID is 1-32 bytes; control characters would break nmcli's output. */
export function validSsid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= 32 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  )
}

/** A WPA passphrase: 8-63 printable ASCII characters, or 64 hex digits. */
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && (/^[\x20-\x7e]{8,63}$/.test(value) || /^[0-9a-fA-F]{64}$/.test(value))
}

export function networkRoutes(network: NetworkPort, logger: LoggerPort): Router {
  const router = Router()
  // One change at a time: a second tap while connecting gets a clear answer
  // instead of racing the first.
  let busy = false

  const failed = (res: Response, err: unknown, action: string) => {
    if (err instanceof NetworkPortError) {
      logger.warn(`${action} failed: ${err.code} ${err.message}`)
      return fail(res, err.code, err.message)
    }
    logger.error(`${action} crashed: ${(err as Error).message}`)
    fail(res, "NETWORK_UNAVAILABLE", `${action} failed`)
  }

  const exclusive = async (req: Request, res: Response, action: string, work: () => Promise<void>) => {
    // A JSON content type can't be sent cross-origin without a CORS
    // preflight, so another page on the network can't change the Wi-Fi.
    if (!req.is("application/json")) return fail(res, "INVALID_REQUEST", "Content-Type must be application/json")
    if (busy) return fail(res, "BUSY", "Already changing the Wi-Fi, wait for it to finish")
    busy = true
    try {
      await work()
      res.json({ status: await network.status() } satisfies HotspotResponse)
    } catch (err) {
      failed(res, err, action)
    } finally {
      busy = false
    }
  }

  router.get("/network", async (_req, res) => {
    try {
      res.json((await network.status()) satisfies NetworkStatusResponse)
    } catch (err) {
      failed(res, err, "Network status")
    }
  })

  router.get("/network/nearby", async (_req, res) => {
    try {
      res.json({ networks: await network.nearby() } satisfies NearbyNetworksResponse)
    } catch (err) {
      failed(res, err, "Wi-Fi scan")
    }
  })

  router.put("/network/hotspot", json({ limit: "1kb" }), (req, res) => {
    const ssid: unknown = req.body?.ssid
    const password: unknown = req.body?.password
    if (req.is("application/json")) {
      if (!validSsid(ssid)) return fail(res, "INVALID_REQUEST", "The network name must be 1 to 32 bytes")
      if (password !== undefined && !validPassword(password)) {
        return fail(res, "INVALID_REQUEST", "The password must be 8 to 63 characters")
      }
    }
    return exclusive(req, res, "Saving the hotspot", async () => {
      logger.info(`Saving hotspot "${ssid as string}"`)
      await network.saveHotspot(ssid as string, (password as string | undefined) ?? null)
    })
  })

  router.post("/network/hotspot/connect", (req, res) =>
    exclusive(req, res, "Connecting to the hotspot", async () => {
      logger.info("Connecting to the hotspot")
      await network.connectHotspot()
    })
  )

  return router
}
