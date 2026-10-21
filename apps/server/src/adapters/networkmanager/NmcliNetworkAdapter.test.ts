import { describe, expect, it } from "vitest"
import { NetworkPortError } from "../../ports/NetworkPort"
import { HOTSPOT_PROFILE, NmcliError, NmcliNetworkAdapter, type NmcliRunner } from "./NmcliNetworkAdapter"
import { nearbyNetworks, parseConnectivity, parseWifiList, splitTerse } from "./parseNmcli"

describe("nmcli terse output", () => {
  it("unescapes colons and backslashes inside values", () => {
    expect(splitTerse("yes:Cafe\\: 2nd floor:72:WPA2")).toEqual(["yes", "Cafe: 2nd floor", "72", "WPA2"])
    expect(splitTerse("no:back\\\\slash:10:")).toEqual(["no", "back\\slash", "10", ""])
  })

  it("keeps one entry per SSID, strongest first, without hidden networks", () => {
    const entries = parseWifiList(
      ["no:Home:40:WPA2", "yes:Home:81:WPA2", "no::55:WPA2", "no:Emiliano’s iPhone:63:WPA2 WPA3", "no:Library:20:--", ""].join("\n")
    )
    expect(nearbyNetworks(entries)).toEqual([
      { ssid: "Home", signal: 81, secured: true },
      { ssid: "Emiliano’s iPhone", signal: 63, secured: true },
      { ssid: "Library", signal: 20, secured: false },
    ])
  })

  it("reads connectivity, falling back to unknown", () => {
    expect(parseConnectivity("full\n")).toBe("full")
    expect(parseConnectivity("portal")).toBe("portal")
    expect(parseConnectivity("")).toBe("unknown")
  })
})

type Call = string[]

/** A fake nmcli: `respond` returns stdout or throws for each call. */
function fake(respond: (args: string[]) => string) {
  const calls: Call[] = []
  const run: NmcliRunner = async (args) => {
    calls.push(args)
    return respond(args)
  }
  return { calls, adapter: new NmcliNetworkAdapter(run, { connectTimeoutSeconds: 30 }) }
}

const noProfile = () => {
  throw new NmcliError(10, `Error: ${HOTSPOT_PROFILE} - no such connection profile.`, false)
}
const isProfileLookup = (args: string[]) => args.includes("show") && args.includes(HOTSPOT_PROFILE)
const isScan = (args: string[]) => args.includes("list")
const isUp = (args: string[]) => args.includes("up")

describe("NmcliNetworkAdapter", () => {
  it("reports the current network, connectivity and saved hotspot without a rescan", async () => {
    const { adapter, calls } = fake((args) => {
      if (isScan(args)) return "yes:Home:81:WPA2\nno:Phone:50:WPA2\n"
      if (args.includes("CONNECTIVITY")) return "full\n"
      if (isProfileLookup(args)) return "Phone\n"
      return ""
    })

    expect(await adapter.status()).toEqual({
      wifi: { ssid: "Home", signal: 81 },
      connectivity: "full",
      hotspot: { ssid: "Phone" },
    })
    expect(calls.find(isScan)).toContain("no")
  })

  it("creates the profile with a low autoconnect priority the first time", async () => {
    const { adapter, calls } = fake((args) => (isProfileLookup(args) ? noProfile() : ""))

    await adapter.saveHotspot("Phone", "secret-pass")

    const add = calls.find((args) => args.includes("add"))!
    expect(add).toEqual(expect.arrayContaining(["con-name", HOTSPOT_PROFILE, "ssid", "Phone", "wifi-sec.psk", "secret-pass"]))
    expect(add[add.indexOf("connection.autoconnect-priority") + 1]).toBe("-10")
  })

  it("needs a password to create the profile", async () => {
    const { adapter } = fake((args) => (isProfileLookup(args) ? noProfile() : ""))

    await expect(adapter.saveHotspot("Phone", null)).rejects.toMatchObject({ code: "HOTSPOT_NOT_SAVED" })
  })

  it("keeps the saved password when only the SSID changes", async () => {
    const { adapter, calls } = fake((args) => (isProfileLookup(args) ? "Old\n" : ""))

    await adapter.saveHotspot("New", null)

    const modify = calls.find((args) => args.includes("modify"))!
    expect(modify).toEqual(["connection", "modify", HOTSPOT_PROFILE, "802-11-wireless.ssid", "New"])
  })

  it("says the hotspot is not in range without trying to connect", async () => {
    const { adapter, calls } = fake((args) => {
      if (isProfileLookup(args)) return "Phone\n"
      if (isScan(args)) return "yes:Home:81:WPA2\n"
      return ""
    })

    await expect(adapter.connectHotspot()).rejects.toMatchObject({ code: "NETWORK_NOT_FOUND" })
    expect(calls.some(isUp)).toBe(false)
  })

  it("does nothing when already on the hotspot", async () => {
    const { adapter, calls } = fake((args) => {
      if (isProfileLookup(args)) return "Phone\n"
      if (isScan(args)) return "yes:Phone:70:WPA2\n"
      return ""
    })

    await adapter.connectHotspot()
    expect(calls.some(isUp)).toBe(false)
  })

  it("connects with nmcli's wait and maps a wrong password", async () => {
    const { adapter, calls } = fake((args) => {
      if (isProfileLookup(args)) return "Phone\n"
      if (isScan(args)) return "yes:Home:81:WPA2\nno:Phone:60:WPA2\n"
      if (isUp(args)) {
        throw new NmcliError(4, "Error: Connection activation failed: Secrets were required, but not provided.", false)
      }
      return ""
    })

    const error = await adapter.connectHotspot().catch((err: unknown) => err)
    expect(error).toBeInstanceOf(NetworkPortError)
    expect(error).toMatchObject({ code: "WRONG_PASSWORD" })
    expect(calls.find(isUp)).toEqual(["--wait", "30", "connection", "up", "id", HOTSPOT_PROFILE])
  })

  it("maps a timeout", async () => {
    const { adapter } = fake((args) => {
      if (isProfileLookup(args)) return "Phone\n"
      if (isScan(args)) return "no:Phone:60:WPA2\n"
      if (isUp(args)) throw new NmcliError(3, "Error: Timeout expired (30 seconds)", false)
      return ""
    })

    await expect(adapter.connectHotspot()).rejects.toMatchObject({ code: "CONNECT_TIMEOUT" })
  })

  it("falls back to the cached list when a rescan is refused", async () => {
    const { adapter } = fake((args) => {
      if (isScan(args) && args.includes("yes")) throw new NmcliError(1, "Error: Scanning not allowed immediately following previous scan.", false)
      if (isScan(args)) return "no:Phone:60:WPA2\n"
      return ""
    })

    expect(await adapter.nearby()).toEqual([{ ssid: "Phone", signal: 60, secured: true }])
  })
})
