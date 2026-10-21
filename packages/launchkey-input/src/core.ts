// Portable entry point: no Node APIs, so it also runs in a browser with a
// Web MIDI transport. The Node entry point (`launchkey-input`) adds amidi.
export {
  DAW_MODE_EXIT,
  DAW_MODE_SETUP,
  decodeLaunchkeyMessage,
} from "./core/decode"
export { Emitter } from "./core/emitter"
export { FakeTransport } from "./core/FakeTransport"
export {
  defaultScheduler,
  LaunchkeyInput,
  type LaunchkeyInputOptions,
  type Scheduler,
} from "./core/LaunchkeyInput"
export { MidiStreamParser } from "./core/midiStream"
export type * from "./core/types"
