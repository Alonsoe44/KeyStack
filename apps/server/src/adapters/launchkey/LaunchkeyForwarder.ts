import type {
  ControllerControlEvent,
  ControllerStatus,
  KeyStackEvent,
} from "keystack-shared"
import type { LaunchkeyInput } from "launchkey-input/core"
import type { EventPublisherPort } from "../../ports/EventPublisherPort"
import type { LoggerPort } from "../../ports/LoggerPort"

/**
 * Forwards the Launchkey's control events to WebSocket clients as they are;
 * each React screen decides what a control does. `input` is null when
 * LAUNCHKEY_INPUT_ENABLED=false.
 */
export class LaunchkeyForwarder {
  private status: ControllerStatus

  constructor(
    private readonly input: LaunchkeyInput | null,
    private readonly publisher: EventPublisherPort,
    private readonly logger: LoggerPort
  ) {
    this.status = input ? input.getStatus() : { state: "disabled" }
    input?.on("control", (event) => {
      // Fails to compile if the library's events drift from the contract.
      const control: ControllerControlEvent = event
      this.publisher.publish({ type: "controller.control", control })
    })
    input?.on("status", (status) => {
      this.status = status
      this.log(status)
      this.publisher.publish({ type: "controller.status", status })
    })
  }

  snapshot(): KeyStackEvent {
    return { type: "controller.status", status: this.status }
  }

  async start(): Promise<void> {
    if (!this.input) {
      this.logger.info("Launchkey input disabled (LAUNCHKEY_INPUT_ENABLED=false)")
      return
    }
    await this.input.start()
  }

  async stop(): Promise<void> {
    await this.input?.stop()
  }

  private log(status: ControllerStatus): void {
    if (status.state === "connected") {
      this.logger.info(`Launchkey input connected on ${status.port}`)
    } else if (status.state === "error") {
      this.logger.warn(`Launchkey input: ${status.message}`)
    } else {
      this.logger.info("Launchkey input disconnected")
    }
  }
}
