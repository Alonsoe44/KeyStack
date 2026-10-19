import { describe, expect, it } from "vitest"

import { applyKey, type FieldState } from "./editing"
import { charForShift, LAYERS, nextShiftState } from "./layouts"

const at = (value: string, start = value.length, end = start): FieldState => ({ value, selectionStart: start, selectionEnd: end })

describe("applyKey", () => {
  it("inserts text at the caret", () => {
    expect(applyKey(at("let be", 3), { kind: "text", text: " it" })).toEqual(at("let it be", 6))
  })

  it("replaces a selection", () => {
    expect(applyKey(at("let it be", 4, 6), { kind: "text", text: "me" })).toEqual(at("let me be", 6))
  })

  it("deletes the character before the caret, or the selection", () => {
    expect(applyKey(at("abc", 2), { kind: "backspace" })).toEqual(at("ac", 1))
    expect(applyKey(at("abcdef", 1, 4), { kind: "backspace" })).toEqual(at("aef", 1))
    expect(applyKey(at("abc", 0), { kind: "backspace" })).toEqual(at("abc", 0))
  })

  it("never splits an emoji or other surrogate pair", () => {
    expect(applyKey(at("a🎹"), { kind: "backspace" })).toEqual(at("a"))
  })

  it("respects maxlength, including when replacing a selection", () => {
    expect(applyKey(at("abc"), { kind: "text", text: "de" }, { maxLength: 4 })).toEqual(at("abcd"))
    expect(applyKey(at("abcd"), { kind: "text", text: "e" }, { maxLength: 4 })).toEqual(at("abcd"))
    expect(applyKey(at("abcd", 1, 3), { kind: "text", text: "xyz" }, { maxLength: 4 })).toEqual(at("axyd", 3))
  })

  it("adds a line break only in multiline fields", () => {
    expect(applyKey(at("one"), { kind: "newline" }, { multiline: true })).toEqual(at("one\n"))
    expect(applyKey(at("one"), { kind: "newline" })).toEqual(at("one"))
  })

  it("clamps a stale selection to the current value", () => {
    expect(applyKey(at("ab", 9, 12), { kind: "text", text: "c" })).toEqual(at("abc"))
  })
})

describe("layouts", () => {
  it("gives every layer a way back to letters or another layer, a space and a hide key", () => {
    for (const rows of Object.values(LAYERS)) {
      const keys = rows.flat()
      expect(keys.some((key) => key.kind === "space")).toBe(true)
      expect(keys.some((key) => key.kind === "hide")).toBe(true)
      expect(keys.some((key) => key.kind === "backspace")).toBe(true)
      expect(keys.some((key) => key.kind === "enter")).toBe(true)
      expect(keys.some((key) => key.kind === "layer")).toBe(true)
    }
  })

  it("covers the characters a YouTube URL needs", () => {
    const typeable = new Set(Object.values(LAYERS).flat(2).flatMap((key) => (key.kind === "char" ? [key.value] : [])))
    for (const char of "https://www.youtube.com/watch?v=dQw4w9WgXcQ_-&".toLowerCase()) {
      expect(typeable.has(char), char).toBe(true)
    }
  })

  it("shift is one-shot, double tap locks, and lock turns off", () => {
    expect(nextShiftState("off", false)).toBe("once")
    expect(nextShiftState("once", false)).toBe("off")
    expect(nextShiftState("once", true)).toBe("lock")
    expect(nextShiftState("lock", false)).toBe("off")
    expect(charForShift("ñ", "once")).toBe("Ñ")
    expect(charForShift("ñ", "off")).toBe("ñ")
  })
})
