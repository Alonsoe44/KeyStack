export interface ClockPort {
  now(): Date
  /** Runs `fn` once after `ms`; returns a function that cancels it. */
  schedule(fn: () => void, ms: number): () => void
}

export const systemClock: ClockPort = {
  now: () => new Date(),
  schedule(fn, ms) {
    const handle = setTimeout(fn, ms)
    return () => clearTimeout(handle)
  },
}
