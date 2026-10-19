"use client"

import { useEffect, useRef, useState } from "react"
import type { SourceVideo } from "keystack-shared"

// Minimal surface of the YouTube IFrame Player API that the preview uses.
type YouTubePlayer = { destroy(): void }
type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host: string
      videoId: string
      playerVars: Record<string, string | number>
      events: { onError: () => void }
    }
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error("YouTube player API did not initialise"))
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => reject(new Error("YouTube player API could not load"))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    // Allow a later preview to try again, e.g. after the network returns.
    apiPromise = null
    throw error
  })
  return apiPromise
}

/**
 * Plays one Source Video through YouTube's embeddable player. Uploaders can
 * disable embedding, and the player API may not load offline; both fall back
 * to the thumbnail so the video can still be chosen.
 */
export function SourceVideoPreview({ video }: { video: SourceVideo }) {
  const mountRef = useRef<HTMLDivElement>(null)
  // Keyed by video so a new preview starts without the previous failure.
  const [failedVideoId, setFailedVideoId] = useState<string | null>(null)
  const failed = failedVideoId === video.id

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let player: YouTubePlayer | null = null
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        // The API replaces the element it is given, so hand it a disposable child.
        const target = document.createElement("div")
        mount.replaceChildren(target)
        player = new YT.Player(target, {
          host: "https://www.youtube-nocookie.com",
          videoId: video.id,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 0 },
          events: { onError: () => setFailedVideoId(video.id) },
        })
      })
      .catch(() => {
        if (!cancelled) setFailedVideoId(video.id)
      })
    return () => {
      cancelled = true
      player?.destroy()
      mount.replaceChildren()
    }
  }, [video.id])

  return (
    // The thumbnail shows behind the player while YouTube loads.
    <div className="source-preview-frame" style={{ backgroundImage: `url(${JSON.stringify(video.thumbnailUrl)})` }}>
      <div ref={mountRef} className="source-preview-player" hidden={failed} />
      {failed && (
        <div className="source-preview-fallback">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, YouTube-hosted thumbnail */}
          <img src={video.thumbnailUrl} alt="" />
          <p>Preview not available here. You can still use this song.</p>
        </div>
      )}
    </div>
  )
}
