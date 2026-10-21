import type { ControllerControlEvent, ControllerStatus, KeyStackEvent } from "keystack-shared"

const DEFAULT_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

const INITIAL_RETRY_MS = 500
const MAX_RETRY_MS = 5000

/** The part of the browser WebSocket this client uses, so tests can stub it. */
export interface ControllerSocket {
  onopen: (() => void) | null
  onmessage: ((message: { data: unknown }) => void) | null
  onclose: (() => void) | null
  close(): void
}

export type ControllerSocketFactory = (url: string) => ControllerSocket

function webSocketUrl(basePath: string): string {
  const url = new URL(`${basePath}/ws`, window.location.href)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

export interface ControllerListener {
  onControl(control: ControllerControlEvent): void
  onStatus(status: ControllerStatus): void
  /** Whether the local server is currently reachable. */
  onOnline(online: boolean): void
}

export interface ControllerSubscriptionOptions {
  basePath?: string
  createSocket?: ControllerSocketFactory
}

/**
 * Follows the Launchkey's `controller.control` and `controller.status`
 * events on /ws. The server sends a status snapshot on every connect, so a
 * reconnect re-syncs on its own. Returns a function that stops it.
 */
export function subscribeToController(
  listener: ControllerListener,
  {
    basePath = DEFAULT_BASE_PATH,
    createSocket = (url) => new WebSocket(url) as unknown as ControllerSocket,
  }: ControllerSubscriptionOptions = {}
): () => void {
  let stopped = false
  let socket: ControllerSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryMs = INITIAL_RETRY_MS

  const connect = () => {
    socket = createSocket(webSocketUrl(basePath))

    socket.onopen = () => {
      retryMs = INITIAL_RETRY_MS
      listener.onOnline(true)
    }
    socket.onmessage = (message) => {
      let event: KeyStackEvent
      try {
        event = JSON.parse(String(message.data)) as KeyStackEvent
      } catch {
        return // Ignore malformed frames.
      }
      if (event.type === "controller.control") listener.onControl(event.control)
      else if (event.type === "controller.status") listener.onStatus(event.status)
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
