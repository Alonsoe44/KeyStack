import type { NetworkConnectivity, NetworkStatusResponse } from "keystack-shared"
import type { NetworkFailureCode } from "./network-port"

export const HOTSPOT_HELP = "On your iPhone open Settings › Personal Hotspot and keep that screen open while KeyStack connects."

/** What to tell the player when connecting to the hotspot fails. */
export function failureMessage(code: NetworkFailureCode, message: string, ssid: string | null): string {
  const name = ssid ? `"${ssid}"` : "The hotspot"
  switch (code) {
    case "NETWORK_NOT_FOUND":
      return `Can't see ${name}. ${HOTSPOT_HELP}`
    case "WRONG_PASSWORD":
      return `Wrong password for ${name}. Check it under Personal Hotspot › Wi-Fi Password.`
    case "CONNECT_TIMEOUT":
      return `${name} didn't answer in time. Keep Personal Hotspot open and try again.`
    case "HOTSPOT_NOT_SAVED":
      return "Set up your hotspot first."
    case "BUSY":
      return "Already connecting — hold on a moment."
    case "OFFLINE":
      return "Can't reach the KeyStack server."
    default:
      return message
  }
}

const CONNECTIVITY: Record<NetworkConnectivity, string> = {
  full: "Online",
  limited: "No internet",
  portal: "Needs a sign-in page",
  none: "Offline",
  unknown: "Connected",
}

/** The one-word state for the panel's chip. */
export function connectionLabel(status: NetworkStatusResponse): string {
  if (!status.wifi) return status.connectivity === "full" ? "Online" : "No Wi-Fi"
  return CONNECTIVITY[status.connectivity]
}

/** Only "full" is a confirmed internet connection; "unknown" means NetworkManager doesn't check. */
export function isOnline(status: NetworkStatusResponse): boolean {
  return status.connectivity === "full" || (status.connectivity === "unknown" && status.wifi !== null)
}
