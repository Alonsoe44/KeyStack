import { describe, expect, it } from "vitest"
import type { SynthControlPort } from "../../ports/SynthControlPort"
import { DEFAULT_VOLUME, INSTRUMENT_PROGRAMS, InstrumentService, isInstrumentId, isVolume, volumeToGain } from "./instruments"

const silentLogger = { info() {}, warn() {}, error() {} }

function fakeSynth(fail = false) {
  const programs: number[] = []
  const gains: number[] = []
  const synth: SynthControlPort = {
    async setProgram(program) {
      if (fail) throw new Error("The synth is not running")
      programs.push(program)
    },
    async setGain(gain) {
      if (fail) throw new Error("The synth is not running")
      gains.push(gain)
    },
  }
  return { synth, programs, gains }
}

describe("InstrumentService", () => {
  it("starts on the piano", () => {
    expect(new InstrumentService(fakeSynth().synth, silentLogger).getSelected()).toBe("piano")
  })

  it("sends the voice's program and remembers the selection", async () => {
    const { synth, programs } = fakeSynth()
    const service = new InstrumentService(synth, silentLogger)

    await service.select("electric-piano")

    expect(programs).toEqual([INSTRUMENT_PROGRAMS["electric-piano"].program])
    expect(service.getSelected()).toBe("electric-piano")
  })

  it("keeps the previous selection when the synth fails", async () => {
    const service = new InstrumentService(fakeSynth(true).synth, silentLogger)

    await expect(service.select("stevie-wonder-piano")).rejects.toThrow("not running")
    expect(service.getSelected()).toBe("piano")
  })

  it("re-applies the selected voice and volume, and never throws doing so", async () => {
    const { synth, programs, gains } = fakeSynth()
    const service = new InstrumentService(synth, silentLogger)
    await service.select("stevie-wonder-piano")
    await service.setVolume(100)

    await service.reapply()
    await new InstrumentService(fakeSynth(true).synth, silentLogger).reapply()

    expect(programs).toEqual([7, 7])
    expect(gains).toEqual([0.8, 0.8])
  })

  it("maps volume onto gain and keeps the old volume when the synth fails", async () => {
    const { synth, gains } = fakeSynth()
    const service = new InstrumentService(synth, silentLogger)
    const failing = new InstrumentService(fakeSynth(true).synth, silentLogger)

    await service.setVolume(50)
    await expect(failing.setVolume(10)).rejects.toThrow()

    expect(gains).toEqual([0.4])
    expect(service.getVolume()).toBe(50)
    expect(failing.getVolume()).toBe(DEFAULT_VOLUME)
    // The default volume matches the unit's `-g 0.5`.
    expect(volumeToGain(DEFAULT_VOLUME)).toBeCloseTo(0.5, 1)
    expect([isVolume(0), isVolume(100), isVolume(101), isVolume(2.5), isVolume("50")]).toEqual([true, true, false, false, false])
  })

  it("only accepts known instrument ids", () => {
    expect(isInstrumentId("piano")).toBe(true)
    expect(isInstrumentId("toString")).toBe(false)
    expect(isInstrumentId("organ")).toBe(false)
    expect(isInstrumentId(4)).toBe(false)
  })
})
