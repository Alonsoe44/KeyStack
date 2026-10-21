"use client"

import { useEffect, useSyncExternalStore } from "react"

import { parseSongsRoute } from "../core/songs-route"
import { SongList } from "./SongList"
import { SongPlayerScreen } from "./SongPlayerScreen"

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

/** Hash routing keeps deep links working on the static export without server routes. */
export function SongsScreen() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "")
  const route = parseSongsRoute(hash)
  const screenKey = route.screen === "player" ? route.id : ""

  // The kiosk screen is short: start each screen at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screenKey])

  if (route.screen === "player") return <SongPlayerScreen key={route.id} id={route.id} />
  return <SongList />
}
