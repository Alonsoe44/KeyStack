let sharedContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext()
  }
  if (sharedContext.state === "suspended") {
    void sharedContext.resume()
  }
  return sharedContext
}

let noiseBuffer: AudioBuffer | null = null

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const duration = 0.05
    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    noiseBuffer = buffer
  }
  return noiseBuffer
}

interface WoodBlockOptions {
  gain?: number
}

// A short, woody knock made of a filtered noise transient (the "crack")
// plus a fast pitch-dropping tone (the "body"), standing in for a real
// wood block sample so the metronome doesn't sound like a digital beep.
export function scheduleClick(
  ctx: AudioContext,
  time: number,
  { gain = 0.35 }: WoodBlockOptions = {}
) {
  const noise = ctx.createBufferSource()
  noise.buffer = getNoiseBuffer(ctx)

  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = "bandpass"
  noiseFilter.frequency.value = 2400
  noiseFilter.Q.value = 1.4

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(gain, time)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025)

  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination)
  noise.start(time)
  noise.stop(time + 0.03)

  const body = ctx.createOscillator()
  body.type = "triangle"
  body.frequency.setValueAtTime(450, time)
  body.frequency.exponentialRampToValueAtTime(220, time + 0.05)

  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(gain * 0.7, time)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07)

  body.connect(bodyGain).connect(ctx.destination)
  body.start(time)
  body.stop(time + 0.08)
}

function scheduleTone(
  ctx: AudioContext,
  time: number,
  {
    frequency = 880,
    duration = 0.15,
    gain = 0.2,
  }: { frequency?: number; duration?: number; gain?: number } = {}
) {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.type = "square"
  osc.frequency.setValueAtTime(frequency, time)
  gainNode.gain.setValueAtTime(gain, time)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration)

  osc.connect(gainNode).connect(ctx.destination)
  osc.start(time)
  osc.stop(time + duration)
}

export function playChime(ctx: AudioContext) {
  const now = ctx.currentTime
  scheduleTone(ctx, now, { frequency: 880, duration: 0.15, gain: 0.2 })
  scheduleTone(ctx, now + 0.16, { frequency: 1320, duration: 0.25, gain: 0.2 })
}
