import type { HotspotResponse, NearbyNetworksResponse, NetworkErrorCode, NetworkStatusResponse } from "keystack-shared"
import type { NetworkPort, NetworkResult } from "../core/network-port"

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "")

async function request<T>(path: string, init?: RequestInit): Promise<NetworkResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/v1/network${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    })
  } catch {
    return { ok: false, code: "OFFLINE", message: "Can't reach the KeyStack server" }
  }
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown; message?: unknown } } | null
  if (!response.ok || body === null) {
    return {
      ok: false,
      code: typeof body?.error?.code === "string" ? (body.error.code as NetworkErrorCode) : "NETWORK_UNAVAILABLE",
      message: typeof body?.error?.message === "string" ? body.error.message : `Request failed (${response.status})`,
    }
  }
  return { ok: true, value: body as T }
}

const unwrap = <T, U>(result: NetworkResult<T>, pick: (value: T) => U): NetworkResult<U> =>
  result.ok ? { ok: true, value: pick(result.value) } : result

export function createHttpNetworkAdapter(): NetworkPort {
  return {
    status: () => request<NetworkStatusResponse>(""),
    nearby: async () => unwrap(await request<NearbyNetworksResponse>("/nearby"), (body) => body.networks),
    saveHotspot: async (ssid, password) =>
      unwrap(
        await request<HotspotResponse>("/hotspot", { method: "PUT", body: JSON.stringify({ ssid, password }) }),
        (body) => body.status
      ),
    connectHotspot: async () =>
      unwrap(await request<HotspotResponse>("/hotspot/connect", { method: "POST", body: "{}" }), (body) => body.status),
  }
}
