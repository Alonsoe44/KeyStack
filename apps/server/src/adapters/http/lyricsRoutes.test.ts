import type { AddressInfo } from "node:net"
import express from "express"
import type { LyricsCandidate, LyricsLookupError } from "keystack-shared"
import { afterEach, describe, expect, it } from "vitest"
import { type LyricsLookupQuery, LyricsSourceError, type LyricsSourcePort } from "../../ports/LyricsSourcePort"
import { lyricsRoutes } from "./lyricsRoutes"

const silentLogger = { info() {}, warn() {}, error() {} }

// Invented lyrics: fixtures never carry real song text.
const candidate: LyricsCandidate = {
  id: 7,
  title: "Lantern Song",
  artist: "The Test Band",
  album: null,
  duration: 180,
  instrumental: false,
  plainText: "Lanterns glow\nAcross the bay",
}

let close: (() => void) | undefined
afterEach(() => close?.())

async function serve(source: Partial<LyricsSourcePort>): Promise<string> {
  const port: LyricsSourcePort = {
    lookup: source.lookup ?? (async () => null),
    search: source.search ?? (async () => []),
  }
  const server = express().use("/api/v1", lyricsRoutes(port, silentLogger)).listen(0)
  close = () => server.close()
  await new Promise((resolve) => server.once("listening", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/lyrics`
}

describe("lyrics routes", () => {
  it("passes a validated lookup to the source", async () => {
    const queries: LyricsLookupQuery[] = []
    const url = await serve({ async lookup(query) { queries.push(query); return candidate } })

    const res = await fetch(`${url}/lookup?title=%20Lantern%20Song%20&artist=The%20Test%20Band&album=&duration=180.4`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ match: candidate })
    expect(queries).toEqual([{ title: "Lantern Song", artist: "The Test Band", album: null, duration: 180.4 }])
  })

  it("answers no match as an empty result, not an error", async () => {
    const url = await serve({})

    const res = await fetch(`${url}/lookup?title=a&artist=b`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ match: null })
  })

  it("rejects bad lookup and search requests without calling the source", async () => {
    let calls = 0
    const url = await serve({ async lookup() { calls++; return null }, async search() { calls++; return [] } })
    const long = "x".repeat(201)

    for (const query of ["artist=b", "title=a", "title=%20&artist=b", `title=${long}&artist=b`, `title=a&artist=b&album=${long}`, "title=a&artist=b&duration=0", "title=a&artist=b&duration=abc", "title=a&artist=b&duration=1&duration=2"]) {
      const res = await fetch(`${url}/lookup?${query}`)
      expect(res.status, query).toBe(400)
      expect(((await res.json()) as LyricsLookupError).error.code).toBe("INVALID_REQUEST")
    }
    expect((await fetch(`${url}/search`)).status).toBe(400)
    expect((await fetch(`${url}/search?q=${long}`)).status).toBe(400)
    expect(calls).toBe(0)
  })

  it("returns search results", async () => {
    const searched: string[] = []
    const url = await serve({ async search(query) { searched.push(query); return [candidate] } })

    const res = await fetch(`${url}/search?q=lantern%20song`)

    expect(await res.json()).toEqual({ results: [candidate] })
    expect(searched).toEqual(["lantern song"])
  })

  it("maps source failures to explicit gateway errors", async () => {
    const url = await serve({
      async lookup() { throw new LyricsSourceError("LYRICS_SOURCE_TIMEOUT", "The lyrics service took too long to answer") },
      async search() { throw new LyricsSourceError("LYRICS_SOURCE_UNAVAILABLE", "Could not reach the lyrics service") },
    })

    const timeout = await fetch(`${url}/lookup?title=a&artist=b`)
    expect(timeout.status).toBe(504)
    expect(await timeout.json()).toEqual({ error: { code: "LYRICS_SOURCE_TIMEOUT", message: "The lyrics service took too long to answer" } })

    const down = await fetch(`${url}/search?q=a`)
    expect(down.status).toBe(502)
    expect(((await down.json()) as LyricsLookupError).error.code).toBe("LYRICS_SOURCE_UNAVAILABLE")
  })
})
