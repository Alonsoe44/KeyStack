import type {
  KeyStackEvent,
  MidiConnectionStatus,
  StatusResponse,
} from "keystack-shared"

const DEFAULT_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

const INITIAL_RETRY_MS = 500
const MAX_RETRY_MS = 5000

function webSocketUrl(basePath: string): string {
  const url = new URL(`${basePath}/ws`, window.location.href)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

export interface MidiStatusListener {
  onStatus(status: MidiConnectionStatus): void
  /** Whether the backend is currently reachable. */
  onOnline(online: boolean): void
}

/**
 * Fetches the current status, then follows pushed `midi.status` snapshots.
 * Reconnects with backoff, re-fetching on every attempt so the view always
 * converges on the backend's state. Returns a function that stops it.
 */
export function subscribeToMidiStatus(
  listener: MidiStatusListener,
  basePath: string = DEFAULT_BASE_PATH
): () => void {
  let stopped = false
  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryMs = INITIAL_RETRY_MS

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${basePath}/api/status`)
      if (!res.ok) return
      const body = (await res.json()) as StatusResponse
      if (!stopped) listener.onStatus(body.midi)
    } catch {
      // The socket's close handler drives the retry.
    }
  }

  const connect = () => {
    void fetchStatus()
    socket = new WebSocket(webSocketUrl(basePath))

    socket.onopen = () => {
      retryMs = INITIAL_RETRY_MS
      listener.onOnline(true)
    }
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as KeyStackEvent
        if (event.type === "midi.status") listener.onStatus(event.status)
      } catch {
        // Ignore malformed frames.
      }
    }
    socket.onclose = () => {
      if (stopped) return
      listener.onOnline(false)
      retryTimer = setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
    }
  }

  connect()

  return () => {
    stopped = true
    if (retryTimer) clearTimeout(retryTimer)
    socket?.close()
  }
}
