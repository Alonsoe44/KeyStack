import type { NetworkStatusResponse } from "keystack-shared"
import { describe, expect, it } from "vitest"
import { connectionLabel, failureMessage, isOnline } from "./feedback"

const status = (overrides: Partial<NetworkStatusResponse>): NetworkStatusResponse => ({
  wifi: { ssid: "Home", signal: 80 },
  connectivity: "full",
  hotspot: null,
  ...overrides,
})

describe("network feedback", () => {
  it("tells the player what to do on the iPhone when the hotspot isn't visible", () => {
    expect(failureMessage("NETWORK_NOT_FOUND", "x", "Phone")).toMatch(/Can't see "Phone"\. On your iPhone open Settings › Personal Hotspot/)
    expect(failureMessage("WRONG_PASSWORD", "x", null)).toMatch(/^Wrong password for The hotspot/)
  })

  it("passes unexpected errors through", () => {
    expect(failureMessage("NETWORK_UNAVAILABLE", "Not authorized to control networking.", "Phone")).toBe(
      "Not authorized to control networking."
    )
  })

  it("labels the connection", () => {
    expect(connectionLabel(status({}))).toBe("Online")
    expect(connectionLabel(status({ connectivity: "limited" }))).toBe("No internet")
    expect(connectionLabel(status({ wifi: null, connectivity: "none" }))).toBe("No Wi-Fi")
    expect(connectionLabel(status({ connectivity: "unknown" }))).toBe("Connected")
  })

  it("treats an unchecked Wi-Fi connection as online, but not missing Wi-Fi", () => {
    expect(isOnline(status({ connectivity: "unknown" }))).toBe(true)
    expect(isOnline(status({ wifi: null, connectivity: "unknown" }))).toBe(false)
    expect(isOnline(status({ connectivity: "portal" }))).toBe(false)
  })
})
