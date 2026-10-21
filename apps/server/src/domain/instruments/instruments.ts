import type { InstrumentId } from "keystack-shared"
import type { LoggerPort } from "../../ports/LoggerPort"
import type { SynthControlPort } from "../../ports/SynthControlPort"

/** General MIDI programs in FluidR3_GM, bank 0. */
export const INSTRUMENT_PROGRAMS: Record<InstrumentId, { program: number; label: string }> = {
  piano: { program: 0, label: "Yamaha Grand Piano" },
  "electric-piano": { program: 4, label: "Rhodes EP" },
  // Superstition's clavinet.
  "stevie-wonder-piano": { program: 7, label: "Clavinet" },
}

/**
 * The volume slider (0-100) maps linearly onto FluidSynth's gain. 100 is
 * gain 0.8: louder than FluidR3_GM tolerates with many notes held clips.
 */
export const MAX_GAIN = 0.8
/** Matches `-g 0.5` in deploy/systemd/fluidsynth.service. */
export const DEFAULT_VOLUME = 63

export const volumeToGain = (volume: number) => (volume / 100) * MAX_GAIN

export function isVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === "string" && Object.hasOwn(INSTRUMENT_PROGRAMS, value)
}

/**
 * Owns the piano's voice and volume and keeps FluidSynth on them.
 * FluidSynth forgets both when it restarts, so `reapply()` runs whenever a
 * new synth instance appears.
 */
export class InstrumentService {
  private selected: InstrumentId = "piano"
  private volume = DEFAULT_VOLUME

  constructor(
    private readonly synth: SynthControlPort,
    private readonly logger: LoggerPort
  ) {}

  getSelected(): InstrumentId {
    return this.selected
  }

  getVolume(): number {
    return this.volume
  }

  /** Changes the synth first; the stored volume only changes if that worked. */
  async setVolume(volume: number): Promise<void> {
    await this.synth.setGain(volumeToGain(volume))
    this.volume = volume
  }

  /** Switches the synth first; the selection only changes if that worked. */
  async select(instrumentId: InstrumentId): Promise<void> {
    const { program, label } = INSTRUMENT_PROGRAMS[instrumentId]
    await this.synth.setProgram(program)
    this.selected = instrumentId
    this.logger.info(`Voice selected: ${instrumentId} (program ${program}, ${label})`)
  }

  async reapply(): Promise<void> {
    const { program } = INSTRUMENT_PROGRAMS[this.selected]
    try {
      await this.synth.setProgram(program)
      await this.synth.setGain(volumeToGain(this.volume))
      this.logger.info(`Re-applied to the synth: ${this.selected} (program ${program}), volume ${this.volume}`)
    } catch (err) {
      this.logger.warn(`Could not re-apply voice and volume: ${(err as Error).message}`)
    }
  }
}
