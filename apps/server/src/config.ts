import path from "node:path"

export type Config = {
  port: number
  staticDir: string
  corsOrigin: string | undefined
  keyboardClientPrefix: string
  keyboardPortMatch: string
  synthClientPrefix: string
  pollIntervalMs: number
  aconnectTimeoutMs: number
  /** FluidSynth's command shell (`-o shell.port=`), used to switch voices. */
  synthShellPort: number
}

type Env = Record<string, string | undefined>

function integer(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = env[name]
  if (raw === undefined || raw === "") return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `Invalid ${name}="${raw}": expected an integer between ${min} and ${max}`
    )
  }
  return value
}

function nonEmpty(env: Env, name: string, fallback: string): string {
  const raw = env[name]
  if (raw === undefined) return fallback
  if (raw.trim() === "") {
    throw new Error(`Invalid ${name}: must not be empty`)
  }
  return raw
}

/** Throws with a clear message on the first invalid value. */
export function loadConfig(env: Env = process.env): Config {
  return {
    port: integer(env, "PORT", 3000, 1, 65535),
    // The static export of apps/web; `npm run dev`/`start` run from apps/server.
    staticDir: nonEmpty(env, "STATIC_DIR", path.resolve("../web/out")),
    // Only needed in dev, where `next dev` runs on a different origin.
    corsOrigin: env.CORS_ORIGIN || undefined,
    keyboardClientPrefix: nonEmpty(env, "KEYBOARD_CLIENT_PREFIX", "Launchkey"),
    keyboardPortMatch: nonEmpty(env, "KEYBOARD_PORT_MATCH", "MIDI In"),
    synthClientPrefix: nonEmpty(env, "SYNTH_CLIENT_PREFIX", "FLUID Synth"),
    pollIntervalMs: integer(env, "POLL_INTERVAL_MS", 500, 50, 60_000),
    aconnectTimeoutMs: integer(env, "ACONNECT_TIMEOUT_MS", 2000, 100, 60_000),
    synthShellPort: integer(env, "SYNTH_SHELL_PORT", 9800, 1, 65535),
  }
}
