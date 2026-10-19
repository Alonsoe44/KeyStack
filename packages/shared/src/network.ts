/**
 * Wi-Fi on the client Pi, through NetworkManager. KeyStack keeps one saved
 * "hotspot" network (e.g. an iPhone's Personal Hotspot) as a fallback for when
 * the Pi is away from home. Its password is write-only: no response returns it.
 */

/** NetworkManager's own internet check; "unknown" when it is not configured. */
export type NetworkConnectivity = "full" | "limited" | "portal" | "none" | "unknown"

/** GET /api/v1/network */
export type NetworkStatusResponse = {
  /** The Wi-Fi network the Pi is on right now, or null. */
  wifi: { ssid: string; signal: number | null } | null
  connectivity: NetworkConnectivity
  /** The saved hotspot, or null when none has been set up. */
  hotspot: { ssid: string } | null
}

export type NearbyNetwork = {
  ssid: string
  /** 0-100. */
  signal: number
  secured: boolean
}

/** GET /api/v1/network/nearby (rescans, so it can take a few seconds) */
export type NearbyNetworksResponse = { networks: NearbyNetwork[] }

/**
 * PUT /api/v1/network/hotspot. Leave `password` out to keep the saved one;
 * it is required the first time.
 */
export type HotspotRequest = { ssid: string; password?: string }

/** POST /api/v1/network/hotspot/connect, and PUT /api/v1/network/hotspot. */
export type HotspotResponse = { status: NetworkStatusResponse }

export type NetworkErrorCode =
  | "INVALID_REQUEST"
  | "HOTSPOT_NOT_SAVED"
  | "NETWORK_NOT_FOUND"
  | "WRONG_PASSWORD"
  | "CONNECT_TIMEOUT"
  | "BUSY"
  | "NETWORK_UNAVAILABLE"

export type NetworkError = { error: { code: NetworkErrorCode; message: string } }
