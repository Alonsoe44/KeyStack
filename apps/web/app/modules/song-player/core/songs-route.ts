export type SongsRoute = { screen: "list" } | { screen: "player"; id: string }

/** `#/` or empty → list; `#/songs/<encoded id>` → player. */
export function parseSongsRoute(hash: string): SongsRoute {
  const match = hash.match(/^#\/songs\/([^/]+)$/)
  if (!match) return { screen: "list" }
  try {
    return { screen: "player", id: decodeURIComponent(match[1]) }
  } catch {
    return { screen: "list" }
  }
}

export const songHref = (id: string) => `#/songs/${encodeURIComponent(id)}`
