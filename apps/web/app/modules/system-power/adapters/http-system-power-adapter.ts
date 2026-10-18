import type { PowerOffResponse } from "keystack-shared"
import type { SystemPowerPort } from "../core/system-power-port"

const DEFAULT_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export function createHttpSystemPowerAdapter(basePath: string = DEFAULT_BASE_PATH): SystemPowerPort {
  return {
    async powerOff(): Promise<PowerOffResponse> {
      try {
        const res = await fetch(`${basePath}/api/system/poweroff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
        const body = (await res.json()) as PowerOffResponse
        if (!res.ok || !body.ok) {
          return { ok: false, error: body.error ?? `Request failed (${res.status})` }
        }
        return body
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Network error" }
      }
    },
  }
}
