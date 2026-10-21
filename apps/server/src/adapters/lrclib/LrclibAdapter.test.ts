import { describe, expect, it } from "vitest"
import { LyricsSourceError } from "../../ports/LyricsSourcePort"
import { LrclibAdapter } from "./LrclibAdapter"

// Invented lyrics: fixtures never carry real song text.
const record = {
  id: 42,
  trackName: "Paper Boats",
  artistName: "The Test Band",
  albumName: "Fixtures",
  duration: 201.5,
  instrumental: false,
  plainLyrics: "Paper boats on the river\nCarry nothing home",
  syncedLyrics: "[00:01.00]Paper boats on the river\n[00:04.00]Carry nothing home",
}

type Call = { url: string; init: RequestInit | undefined }

function adapter(respond: (url: string) => Response | Promise<Response>, calls: Call[] = []) {
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return respond(String(input))
  }) as typeof fetch
  return new LrclibAdapter({ baseUrl: "https://lrclib.test", timeoutMs: 1000, userAgent: "KeyStack-test", fetch: fetchStub })
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const err = await promise.then(() => null, (e: unknown) => e)
  expect(err).toBeInstanceOf(LyricsSourceError)
  return (err as LyricsSourceError).code
}

describe("LrclibAdapter", () => {
  it("looks up the exact recording with a rounded duration and a User-Agent", async () => {
    const calls: Call[] = []
    const match = await adapter(() => json(record), calls).lookup({ title: "Paper Boats", artist: "The Test Band", album: "Fixtures", duration: 201.6 })

    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe("/api/get")
    expect(Object.fromEntries(url.searchParams)).toEqual({ track_name: "Paper Boats", artist_name: "The Test Band", album_name: "Fixtures", duration: "202" })
    expect((calls[0]!.init?.headers as Record<string, string>)["User-Agent"]).toBe("KeyStack-test")
    expect(match).toEqual({
      id: 42,
      title: "Paper Boats",
      artist: "The Test Band",
      album: "Fixtures",
      duration: 201.5,
      instrumental: false,
      plainText: "Paper boats on the river\nCarry nothing home",
    })
  })

  it("leaves out album and duration when the song has none", async () => {
    const calls: Call[] = []
    await adapter(() => json(record), calls).lookup({ title: "Paper Boats", artist: "The Test Band", album: null, duration: null })

    expect([...new URL(calls[0]!.url).searchParams.keys()]).toEqual(["track_name", "artist_name"])
  })

  it("treats a 404 as no match", async () => {
    const lyrics = adapter(() => json({ code: 404, name: "TrackNotFound" }, 404))

    expect(await lyrics.lookup({ title: "Unknown", artist: "Nobody", album: null, duration: 100 })).toBeNull()
  })

  it("falls back to synced lyrics without timing and blanks instrumentals", async () => {
    const results = await adapter(() =>
      json([
        { ...record, id: 1, plainLyrics: null },
        { ...record, id: 2, instrumental: true, plainLyrics: "", syncedLyrics: null },
      ])
    ).search("paper boats")

    expect(results.map((result) => [result.id, result.instrumental, result.plainText])).toEqual([
      [1, false, "Paper boats on the river\nCarry nothing home"],
      [2, true, null],
    ])
  })

  it("skips malformed search records", async () => {
    const results = await adapter(() => json([record, { id: "x" }, null])).search("paper boats")

    expect(results.map((result) => result.id)).toEqual([42])
  })

  it("reports timeouts, network failures, server errors and bad JSON explicitly", async () => {
    const query = { title: "Paper Boats", artist: "The Test Band", album: null, duration: null }
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" })

    expect(await codeOf(adapter(() => Promise.reject(timeout)).lookup(query))).toBe("LYRICS_SOURCE_TIMEOUT")
    expect(await codeOf(adapter(() => Promise.reject(new TypeError("fetch failed"))).lookup(query))).toBe("LYRICS_SOURCE_UNAVAILABLE")
    expect(await codeOf(adapter(() => json({}, 500)).search("x"))).toBe("LYRICS_SOURCE_UNAVAILABLE")
    expect(await codeOf(adapter(() => json({}, 404)).search("x"))).toBe("LYRICS_SOURCE_UNAVAILABLE")
    expect(await codeOf(adapter(() => new Response("<html>", { status: 200 })).lookup(query))).toBe("LYRICS_SOURCE_INVALID_RESPONSE")
    expect(await codeOf(adapter(() => json({ id: 1 })).lookup(query))).toBe("LYRICS_SOURCE_INVALID_RESPONSE")
    expect(await codeOf(adapter(() => json({ results: [] })).search("x"))).toBe("LYRICS_SOURCE_INVALID_RESPONSE")
  })
})
