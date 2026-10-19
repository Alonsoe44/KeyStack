export interface SynthControlPort {
  /**
   * Sets the General MIDI program (0-127, bank 0) on every melodic channel,
   * so the voice changes whatever channel the keyboard sends on.
   */
  setProgram(program: number): Promise<void>
  /** FluidSynth master gain, 0-10 (it starts at the unit's `-g`). */
  setGain(gain: number): Promise<void>
}
