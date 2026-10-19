import { LaunchkeyInput, type Scheduler } from "./core/LaunchkeyInput"
import { AmidiTransport, type AmidiTransportOptions } from "./node/AmidiTransport"

export * from "./core"
export { AmidiTransport, type AmidiTransportOptions } from "./node/AmidiTransport"
export { AmidiDumpParser, parseAmidiList, toAmidiHex } from "./node/parseAmidi"

export type CreateLaunchkeyInputOptions = AmidiTransportOptions & {
  searchIntervalMs?: number
  scheduler?: Scheduler
}

/** A LaunchkeyInput that talks to the controller through `amidi` (Linux). */
export function createLaunchkeyInput(
  options: CreateLaunchkeyInputOptions = {}
): LaunchkeyInput {
  const { searchIntervalMs, scheduler, ...transport } = options
  return new LaunchkeyInput({
    transport: new AmidiTransport(transport),
    searchIntervalMs,
    scheduler,
  })
}
