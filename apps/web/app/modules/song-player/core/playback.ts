export type PlaybackPhase = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error"

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** `m:ss`, or `h:mm:ss` past an hour. Non-finite and negative values read as 0:00. */
export function formatTime(value: number): string {
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

type SeekableRange = { start: number; end: number }

/**
 * Where a ±N second jump lands: clamped to [0, duration] and to the seekable
 * range when the media element reports one. Null when there is no finite
 * duration yet, so the caller does nothing.
 */
export function seekTarget(
  currentTime: number,
  delta: number,
  duration: number,
  seekable: SeekableRange | null
): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null
  let target = clamp((Number.isFinite(currentTime) ? currentTime : 0) + delta, 0, duration)
  if (seekable) target = clamp(target, seekable.start, Math.min(seekable.end, duration))
  return target
}
