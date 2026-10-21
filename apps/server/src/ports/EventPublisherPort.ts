import type { KeyStackEvent } from "keystack-shared"

export interface EventPublisherPort {
  publish(event: KeyStackEvent): void
}
