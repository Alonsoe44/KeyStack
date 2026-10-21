import type { NearbyNetwork, NetworkErrorCode, NetworkStatusResponse } from "keystack-shared"

export class NetworkPortError extends Error {
  constructor(
    readonly code: Exclude<NetworkErrorCode, "INVALID_REQUEST" | "BUSY">,
    message: string
  ) {
    super(message)
  }
}

/** The Pi's Wi-Fi. Failures with a user-facing cause throw NetworkPortError. */
export interface NetworkPort {
  status(): Promise<NetworkStatusResponse>
  /** Rescans; strongest first, one entry per SSID, hidden networks left out. */
  nearby(): Promise<NearbyNetwork[]>
  /** Creates or updates the hotspot profile. A null password keeps the saved one. */
  saveHotspot(ssid: string, password: string | null): Promise<void>
  /** Switches to the saved hotspot; resolves once it is connected. */
  connectHotspot(): Promise<void>
}
