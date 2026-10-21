export interface SystemPowerPort {
  /** Shuts the machine down. Resolves once the shutdown has been accepted. */
  powerOff(): Promise<void>
}
