import type { NearbyNetwork, NetworkConnectivity } from "keystack-shared"

/**
 * Splits one line of `nmcli -t` output. Terse mode separates fields with ':'
 * and escapes ':' and '\' inside values with a backslash.
 */
export function splitTerse(line: string): string[] {
  const fields: string[] = []
  let current = ""
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === "\\" && i + 1 < line.length) {
      current += line[++i]
    } else if (char === ":") {
      fields.push(current)
      current = ""
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

function lines(output: string): string[] {
  return output.split(/\r?\n/).filter((line) => line !== "")
}

type ScanEntry = { active: boolean; ssid: string; signal: number; security: string }

/** Parses `nmcli -t -f ACTIVE,SSID,SIGNAL,SECURITY device wifi list`. */
export function parseWifiList(output: string): ScanEntry[] {
  return lines(output).flatMap((line) => {
    const [active, ssid, signal, security = ""] = splitTerse(line)
    if (ssid === undefined || signal === undefined) return []
    const strength = Number(signal)
    return [
      {
        active: active === "yes",
        ssid,
        signal: Number.isFinite(strength) ? strength : 0,
        security: security.trim(),
      },
    ]
  })
}

/** Visible networks, strongest first, one per SSID; hidden ones are dropped. */
export function nearbyNetworks(entries: ScanEntry[]): NearbyNetwork[] {
  const bySsid = new Map<string, NearbyNetwork>()
  for (const entry of entries) {
    if (entry.ssid === "") continue
    const known = bySsid.get(entry.ssid)
    if (known && known.signal >= entry.signal) continue
    bySsid.set(entry.ssid, {
      ssid: entry.ssid,
      signal: entry.signal,
      secured: entry.security !== "" && entry.security !== "--",
    })
  }
  return [...bySsid.values()].sort((a, b) => b.signal - a.signal)
}

const CONNECTIVITY = new Set<NetworkConnectivity>(["full", "limited", "portal", "none"])

/** Parses `nmcli -t -f CONNECTIVITY general`. */
export function parseConnectivity(output: string): NetworkConnectivity {
  const value = output.trim() as NetworkConnectivity
  return CONNECTIVITY.has(value) ? value : "unknown"
}
