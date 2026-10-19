import { describe, expect, it } from "vitest"
import { decodeLaunchkeyMessage } from "./decode"
import { MidiStreamParser } from "./midiStream"

const decode = (...bytes: number[]) => decodeLaunchkeyMessage(bytes, 42)

describe("decodeLaunchkeyMessage", () => {
  it("names pads by row, left to right", () => {
    expect(decode(0x90, 0x60, 1)).toMatchObject({ name: "pad-1" })
    expect(decode(0x90, 0x67, 1)).toMatchObject({ name: "pad-8" })
    expect(decode(0x90, 0x70, 1)).toMatchObject({ name: "pad-9" })
    expect(decode(0x90, 0x77, 1)).toMatchObject({ name: "pad-16" })
    expect(decode(0x90, 0x68, 1)).toBeNull()
  })

  it("treats Note Off as a release", () => {
    expect(decode(0x80, 0x60, 0x40)).toEqual({
      type: "pad",
      name: "pad-1",
      pressed: false,
      velocity: 0,
      time: 42,
    })
  })

  it("names knobs 1 to 8 and turns relative values into steps", () => {
    expect(decode(0xbf, 0x55, 0x41)).toEqual({ type: "knob", name: "knob-1", delta: 1, time: 42 })
    expect(decode(0xbf, 0x5c, 0x3d)).toEqual({ type: "knob", name: "knob-8", delta: -3, time: 42 })
    expect(decode(0xbf, 0x55, 0x40)).toBeNull()
    expect(decode(0xbf, 0x5d, 0x41)).toBeNull()
  })

  it("ignores buttons on other channels, unknown CCs and short messages", () => {
    expect(decode(0xbf, 0x73, 0x7f)).toBeNull()
    expect(decode(0xb0, 0x01, 0x7f)).toBeNull()
    expect(decode(0xb0, 0x73)).toBeNull()
    expect(decode(0xfa)).toBeNull()
  })
})

describe("MidiStreamParser", () => {
  const collect = (chunks: number[][]) => {
    const parser = new MidiStreamParser()
    const messages: number[][] = []
    for (const chunk of chunks) parser.push(chunk, (m) => messages.push(Array.from(m)))
    return messages
  }

  it("joins messages split across reads", () => {
    expect(collect([[0xb0, 0x73], [0x7f, 0x90], [0x60, 0x10]])).toEqual([
      [0xb0, 0x73, 0x7f],
      [0x90, 0x60, 0x10],
    ])
  })

  it("supports running status", () => {
    expect(collect([[0x90, 0x60, 0x10, 0x60, 0x00]])).toEqual([
      [0x90, 0x60, 0x10],
      [0x90, 0x60, 0x00],
    ])
  })

  it("skips SysEx and keeps real-time bytes", () => {
    expect(
      collect([[0xf0, 0x00, 0x20, 0x29, 0xf7, 0x90, 0x60, 0xf8, 0x10]])
    ).toEqual([[0xf8], [0x90, 0x60, 0x10]])
  })

  it("drops data bytes with no status", () => {
    expect(collect([[0x60, 0x10, 0xb0, 0x73, 0x7f]])).toEqual([[0xb0, 0x73, 0x7f]])
  })
})
