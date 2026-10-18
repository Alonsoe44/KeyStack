import type { Server } from "node:http"
import type { KeyStackEvent } from "keystack-shared"
import { WebSocket, WebSocketServer } from "ws"
import type { EventPublisherPort } from "../../ports/EventPublisherPort"
import type { LoggerPort } from "../../ports/LoggerPort"

export class WebSocketEventPublisher implements EventPublisherPort {
  private readonly wss: WebSocketServer

  /** `snapshot` is sent to every client as soon as it connects. */
  constructor(
    server: Server,
    path: string,
    snapshot: () => KeyStackEvent,
    logger: LoggerPort
  ) {
    this.wss = new WebSocketServer({ server, path })
    this.wss.on("connection", (socket) => {
      socket.on("error", (err) =>
        logger.warn(`WebSocket client error: ${err.message}`)
      )
      socket.send(JSON.stringify(snapshot()))
    })
  }

  publish(event: KeyStackEvent): void {
    const payload = JSON.stringify(event)
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    }
  }

  close(): void {
    for (const client of this.wss.clients) client.terminate()
    this.wss.close()
  }
}
