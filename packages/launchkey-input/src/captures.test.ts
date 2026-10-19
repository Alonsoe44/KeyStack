import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { decodeLaunchkeyMessage } from "./core/decode"
import { MidiStreamParser } from "./core/midiStream"
import type { ControlEvent } from "./core/types"
import { AmidiDumpParser } from "./node/parseAmidi"

/** Plays a hardware capture through the same path the transport uses. */
function replay(file: string): Omit<ControlEvent, "time">[] {
  const text = readFileSync(new URL(`./__fixtures__/${file}`, import.meta.url), "utf8")
  const dump = new AmidiDumpParser()
  const stream = new MidiStreamParser()
  const events: Omit<ControlEvent, "time">[] = []
  stream.push(dump.push(text), (message) => {
    const event = decodeLaunchkeyMessage(message, 0)
    if (event) {
      const { time: _time, ...rest } = event
      events.push(rest)
    }
  })
  return events
}

const press = (name: string) => [
  { type: "button", name, pressed: true },
  { type: "button", name, pressed: false },
]
const pad = (name: string, velocity: number) => [
  { type: "pad", name, pressed: true, velocity },
  { type: "pad", name, pressed: false, velocity: 0 },
]

describe("hardware captures", () => {
  it("test 3: pads report velocity; absolute knobs and pressure are ignored", () => {
    expect(replay("test3-pads-absolute-knobs.txt")).toEqual([
      ...pad("pad-1", 0x5c),
      ...pad("pad-1", 0x54),
      ...pad("pad-2", 0x1d),
      ...pad("pad-2", 0x5a),
      ...pad("pad-4", 0x52),
      ...pad("pad-5", 0x6b),
    ])
  })

  it("test 4: every button, two pads held at once, Shift ignored", () => {
    expect(replay("test4-buttons-relative.txt")).toEqual([
      ...press("play"),
      ...press("record"),
      ...press("back"),
      ...press("select"),
      ...press("down"),
      { type: "pad", name: "pad-16", pressed: true, velocity: 0x22 },
      { type: "pad", name: "pad-8", pressed: true, velocity: 0x24 },
      { type: "pad", name: "pad-16", pressed: false, velocity: 0 },
      { type: "pad", name: "pad-8", pressed: false, velocity: 0 },
      ...press("next"),
      ...press("previous"),
      ...press("previous"),
      ...pad("pad-16", 0x16),
      ...press("back"),
      ...press("select"),
      ...press("up"),
      ...press("down"),
    ])
  })

  it("test 5: relative knob clicks and the Track buttons", () => {
    expect(replay("test5-knob-and-track.txt")).toEqual([
      { type: "knob", name: "knob-1", delta: 1 },
      { type: "knob", name: "knob-1", delta: 1 },
      { type: "knob", name: "knob-1", delta: 1 },
      { type: "knob", name: "knob-1", delta: -1 },
      { type: "knob", name: "knob-1", delta: -1 },
      { type: "knob", name: "knob-1", delta: -1 },
      ...press("previous"),
      ...press("next"),
    ])
  })
})
