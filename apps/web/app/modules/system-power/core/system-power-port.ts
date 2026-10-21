import type { PowerOffResponse } from "keystack-shared"

export interface SystemPowerPort {
  powerOff(): Promise<PowerOffResponse>
}
