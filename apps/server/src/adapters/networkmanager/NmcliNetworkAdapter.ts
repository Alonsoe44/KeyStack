import { execFile } from "node:child_process"
import type { NearbyNetwork, NetworkStatusResponse } from "keystack-shared"
import { NetworkPortError, type NetworkPort } from "../../ports/NetworkPort"
import { nearbyNetworks, parseConnectivity, parseWifiList, splitTerse } from "./parseNmcli"

/** The NetworkManager profile KeyStack owns. Other saved networks are left alone. */
export const HOTSPOT_PROFILE = "keystack-hotspot"
// Below the default 0, so the home network wins whenever both are in range.
const HOTSPOT_PRIORITY = "-10"
// nmcli's own exit code for "connection, device or access point does not exist".
const NOT_FOUND_EXIT = 10

export class NmcliError extends Error {
  constructor(
    readonly exitCode: number | null,
    readonly stderr: string,
    readonly timedOut: boolean
  ) {
    super(stderr || `nmcli exited with ${exitCode}`)
  }
}

export type NmcliRunner = (args: string[], timeoutMs: number) => Promise<string>

export const execNmcli: NmcliRunner = (args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile("nmcli", args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout)
      const { code, killed } = err as Error & { code?: number | string; killed?: boolean }
      reject(new NmcliError(typeof code === "number" ? code : null, stderr.trim() || err.message, Boolean(killed)))
    })
  })

/** Turns an `nmcli connection up` failure into a reason the screen can show. */
export function connectFailure(err: unknown, ssid: string): NetworkPortError {
  if (!(err instanceof NmcliError)) return new NetworkPortError("NETWORK_UNAVAILABLE", (err as Error).message)
  const text = err.stderr.toLowerCase()
  if (text.includes("secrets were required") || text.includes("802-1x supplicant")) {
    return new NetworkPortError("WRONG_PASSWORD", `Wrong password for "${ssid}"`)
  }
  if (text.includes("could not be found") || text.includes("no network with ssid")) {
    return new NetworkPortError("NETWORK_NOT_FOUND", `"${ssid}" is not in range`)
  }
  if (err.timedOut || text.includes("timeout expired")) {
    return new NetworkPortError("CONNECT_TIMEOUT", `"${ssid}" did not answer in time`)
  }
  if (err.exitCode === NOT_FOUND_EXIT) {
    return new NetworkPortError("HOTSPOT_NOT_SAVED", "No hotspot has been set up yet")
  }
  return new NetworkPortError("NETWORK_UNAVAILABLE", err.stderr)
}

type Options = { connectTimeoutSeconds: number }

export class NmcliNetworkAdapter implements NetworkPort {
  constructor(
    private readonly run: NmcliRunner = execNmcli,
    private readonly options: Options = { connectTimeoutSeconds: 45 }
  ) {}

  async status(): Promise<NetworkStatusResponse> {
    const [scan, connectivity, hotspot] = await Promise.all([
      this.scan(false),
      this.run(["-t", "-f", "CONNECTIVITY", "general"], 5000).then(parseConnectivity, () => "unknown" as const),
      this.hotspotSsid(),
    ])
    const active = scan.find((entry) => entry.active)
    return {
      wifi: active ? { ssid: active.ssid, signal: active.signal } : null,
      connectivity,
      hotspot: hotspot === null ? null : { ssid: hotspot },
    }
  }

  async nearby(): Promise<NearbyNetwork[]> {
    return nearbyNetworks(await this.scan(true))
  }

  async saveHotspot(ssid: string, password: string | null): Promise<void> {
    const security = password === null ? [] : ["wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]
    try {
      if ((await this.hotspotSsid()) === null) {
        if (password === null) throw new NetworkPortError("HOTSPOT_NOT_SAVED", "A password is needed the first time")
        await this.run(
          [
            "connection", "add", "type", "wifi", "con-name", HOTSPOT_PROFILE,
            "ssid", ssid, ...security,
            "connection.autoconnect", "yes",
            "connection.autoconnect-priority", HOTSPOT_PRIORITY,
          ],
          15_000
        )
      } else {
        await this.run(["connection", "modify", HOTSPOT_PROFILE, "802-11-wireless.ssid", ssid, ...security], 15_000)
      }
    } catch (err) {
      if (err instanceof NetworkPortError) throw err
      throw new NetworkPortError("NETWORK_UNAVAILABLE", `Could not save the hotspot: ${(err as Error).message}`)
    }
  }

  async connectHotspot(): Promise<void> {
    const ssid = await this.hotspotSsid()
    if (ssid === null) throw new NetworkPortError("HOTSPOT_NOT_SAVED", "No hotspot has been set up yet")

    // An iPhone only shows its hotspot while Personal Hotspot is open, so a
    // fresh scan answers "not in range" in seconds instead of a long timeout.
    const scan = await this.scan(true)
    if (scan.some((entry) => entry.active && entry.ssid === ssid)) return
    if (!scan.some((entry) => entry.ssid === ssid)) {
      throw new NetworkPortError("NETWORK_NOT_FOUND", `"${ssid}" is not in range`)
    }

    const { connectTimeoutSeconds } = this.options
    try {
      await this.run(
        ["--wait", String(connectTimeoutSeconds), "connection", "up", "id", HOTSPOT_PROFILE],
        (connectTimeoutSeconds + 5) * 1000
      )
    } catch (err) {
      throw connectFailure(err, ssid)
    }
    // Refreshes the connectivity state the next status() reads; not fatal.
    await this.run(["networking", "connectivity", "check"], 15_000).catch(() => {})
  }

  private async hotspotSsid(): Promise<string | null> {
    try {
      const output = await this.run(["-t", "-g", "802-11-wireless.ssid", "connection", "show", HOTSPOT_PROFILE], 5000)
      return splitTerse(output.replace(/\r?\n$/, "")).join(":")
    } catch (err) {
      if (err instanceof NmcliError && err.exitCode === NOT_FOUND_EXIT) return null
      throw new NetworkPortError("NETWORK_UNAVAILABLE", `NetworkManager is not available: ${(err as Error).message}`)
    }
  }

  private async scan(rescan: boolean) {
    const list = (mode: string) =>
      this.run(["-t", "-f", "ACTIVE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", mode], 20_000)
    let output: string
    try {
      // NetworkManager refuses back-to-back scans; the cached list is then fresh enough.
      output = rescan ? await list("yes").catch(() => list("no")) : await list("no")
    } catch (err) {
      throw new NetworkPortError("NETWORK_UNAVAILABLE", `Could not read Wi-Fi networks: ${(err as Error).message}`)
    }
    return parseWifiList(output)
  }
}
