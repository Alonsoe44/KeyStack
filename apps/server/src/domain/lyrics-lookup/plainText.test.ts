import { describe, expect, it } from "vitest"
import { plainTextFrom, stripLrcTimestamps } from "./plainText"

describe("stripLrcTimestamps", () => {
  it("drops line tags, word tags and header lines", () => {
    const synced = [
      "[ar:Test Artist]",
      "[length:03:20]",
      "[00:12.34]Paper boats on the river",
      "[00:15.00][01:15.00]Repeat this  chorus line",
      "[00:18.5]<00:18.50>Every <00:19.10>word <00:19.80>tagged",
      "[00:21.000]",
    ].join("\n")

    expect(stripLrcTimestamps(synced)).toBe("Paper boats on the river\nRepeat this chorus line\nEvery word tagged\n")
  })

  it("keeps square brackets that are not timestamps", () => {
    expect(stripLrcTimestamps("[00:01.00][Chorus] Lanterns glow")).toBe("[Chorus] Lanterns glow")
  })
})

describe("plainTextFrom", () => {
  it("prefers plain lyrics and trims them", () => {
    expect(plainTextFrom("  First line  \r\nSecond line\n\n\n\nThird line\n", "[00:01.00]Ignored")).toBe("First line\nSecond line\n\nThird line")
  })

  it("falls back to synced lyrics without their timing", () => {
    expect(plainTextFrom(null, "[00:01.00]Quiet harbour\n[00:04.00]Morning tide")).toBe("Quiet harbour\nMorning tide")
    expect(plainTextFrom("   \n ", "[00:01.00]Quiet harbour")).toBe("Quiet harbour")
  })

  it("returns null when there are no words", () => {
    expect(plainTextFrom(null, null)).toBeNull()
    expect(plainTextFrom("", "[00:01.00]\n[00:02.00]")).toBeNull()
  })
})
