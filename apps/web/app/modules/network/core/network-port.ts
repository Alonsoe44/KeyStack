import type { NearbyNetwork, NetworkErrorCode, NetworkStatusResponse } from "keystack-shared"

/** OFFLINE: the local KeyStack server itself could not be reached. */
export type NetworkFailureCode = NetworkErrorCode | "OFFLINE"

export type NetworkResult<T> = { ok: true; value: T } | { ok: false; code: NetworkFailureCode; message: string }

export interface NetworkPort {
  status(): Promise<NetworkResult<NetworkStatusResponse>>
  nearby(): Promise<NetworkResult<NearbyNetwork[]>>
  /** Leave the password out to keep the saved one. */
  saveHotspot(ssid: string, password?: string): Promise<NetworkResult<NetworkStatusResponse>>
  connectHotspot(): Promise<NetworkResult<NetworkStatusResponse>>
}
