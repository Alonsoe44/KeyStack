import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AmidiDumpParser, parseAmidiList, toAmidiHex } from "./parseAmidi"

describe("parseAmidiList", () => {
  it("reads both Launchkey interfaces from the Pi's output", () => {
    const text = readFileSync(
      new URL("../__fixtures__/amidi-list.txt", import.meta.url),
      "utf8"
    )
    expect(parseAmidiList(text)).toEqual([
      { direction: "IO", device: "hw:1,0,0", name: "Launchkey Mini MK4 37 MIDI Out" },
      { direction: "IO", device: "hw:1,0,1", name: "Launchkey Mini MK4 37 DAW Out" },
    ])
  })

  it("returns nothing when no device is attached", () => {
    expect(parseAmidiList("Dir Device    Name\n")).toEqual([])
  })
})

describe("AmidiDumpParser", () => {
  it("holds a hex pair split across chunks", () => {
    const parser = new AmidiDumpParser()
    expect(parser.push("\nB0 7")).toEqual([0xb0])
    expect(parser.push("3 7F\n")).toEqual([0x73, 0x7f])
  })

  it("reads amidi's running-status layout", () => {
    expect(new AmidiDumpParser().push("90 60 10\n  60 00\n")).toEqual([
      0x90, 0x60, 0x10, 0x60, 0x00,
    ])
  })

  it("ignores text that is not a hex pair", () => {
    expect(new AmidiDumpParser().push("\n3 bytes read\n")).toEqual([])
  })
})

describe("toAmidiHex", () => {
  it("formats bytes the way amidi -S takes them", () => {
    expect(toAmidiHex(Uint8Array.of(0x9f, 0x0c, 0x00))).toBe("9F 0C 00")
  })
})
