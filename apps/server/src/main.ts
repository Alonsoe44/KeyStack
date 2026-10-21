import { createServer } from "node:http"
import path from "node:path"
import express from "express"
import type { KeyStackEvent } from "keystack-shared"
import { createLaunchkeyInput } from "launchkey-input"
import { AconnectSequencerAdapter } from "./adapters/alsa/AconnectSequencerAdapter"
import { FluidSynthShellAdapter } from "./adapters/fluidsynth/FluidSynthShellAdapter"
import { instrumentRoutes } from "./adapters/http/instrumentRoutes"
import { lyricsRoutes } from "./adapters/http/lyricsRoutes"
import { networkRoutes } from "./adapters/http/networkRoutes"
import { statusRoutes } from "./adapters/http/statusRoutes"
import { systemRoutes } from "./adapters/http/systemRoutes"
import { LaunchkeyForwarder } from "./adapters/launchkey/LaunchkeyForwarder"
import { LrclibAdapter } from "./adapters/lrclib/LrclibAdapter"
import { NmcliNetworkAdapter } from "./adapters/networkmanager/NmcliNetworkAdapter"
import { SystemctlPowerAdapter } from "./adapters/system/SystemctlPowerAdapter"
import { WebSocketEventPublisher } from "./adapters/ws/WebSocketEventPublisher"
import { type Config, loadConfig } from "./config"
import { InstrumentService } from "./domain/instruments/instruments"
import { MidiConnectionReconciler } from "./domain/midi-connection/reconciler"
import { systemClock } from "./ports/ClockPort"
import { consoleLogger as logger } from "./ports/LoggerPort"

function main(): void {
  let config: Config
  try {
    config = loadConfig()
  } catch (err) {
    logger.error(`Configuration error: ${(err as Error).message}`)
    process.exit(1)
  }

  const app = express()
  const server = createServer(app)

  // The publisher needs the reconciler's and the forwarder's status and they
  // need the publisher; the snapshot callback only runs once all exist.
  const publisher = new WebSocketEventPublisher(
    server,
    "/ws",
    (): KeyStackEvent[] => [
      { type: "midi.status", status: reconciler.getStatus() },
      launchkey.snapshot(),
    ],
    logger
  )
  const launchkey = new LaunchkeyForwarder(
    config.launchkeyInputEnabled ? createLaunchkeyInput() : null,
    publisher,
    logger
  )
  const instruments = new InstrumentService(
    new FluidSynthShellAdapter(config.synthShellPort),
    logger
  )
  // A new synth client name means a new FluidSynth process, which starts on
  // program 0: put it back on the selected voice.
  let lastSynthName: string | undefined
  const publishAndTrackSynth = {
    publish(event: KeyStackEvent) {
      publisher.publish(event)
      if (event.type !== "midi.status") return
      const { synth } = event.status
      if (synth.present && synth.name !== lastSynthName) void instruments.reapply()
      lastSynthName = synth.present ? synth.name : undefined
    },
  }
  const reconciler: MidiConnectionReconciler = new MidiConnectionReconciler(
    new AconnectSequencerAdapter(config.aconnectTimeoutMs),
    publishAndTrackSynth,
    config,
    systemClock,
    logger
  )

  const { corsOrigin } = config
  if (corsOrigin) {
    app.use("/api", (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin)
      res.setHeader("Access-Control-Allow-Headers", "Content-Type")
      if (req.method === "OPTIONS") {
        res.sendStatus(204)
        return
      }
      next()
    })
  }
  app.use(
    "/api",
    statusRoutes(() => reconciler.getStatus())
  )
  app.use("/api", systemRoutes(new SystemctlPowerAdapter(), logger))
  app.use("/api", instrumentRoutes(instruments))
  app.use(
    "/api/v1",
    lyricsRoutes(
      new LrclibAdapter({
        baseUrl: config.lrclibBaseUrl,
        timeoutMs: config.lrclibTimeoutMs,
        // LRCLIB asks clients to identify themselves.
        userAgent: "KeyStack/0.0.1 (piano kiosk lyrics editor)",
      }),
      logger
    )
  )
  app.use("/api/v1", networkRoutes(new NmcliNetworkAdapter(), logger))
  // The static export has both scales.html and a scales/ directory, so
  // /scales has to be mapped to the .html file before express.static sees it.
  app.get(/.*/, (req, res, next) => {
    if (req.path.endsWith("/") || path.extname(req.path)) return next()
    res.sendFile(`${req.path}.html`, { root: config.staticDir }, (err) => {
      if (err) next()
    })
  })
  app.use(express.static(config.staticDir))

  server.on("error", (err) => {
    logger.error(`HTTP server error: ${err.message}`)
    process.exit(1)
  })
  server.listen(config.port, () => {
    logger.info(
      `Listening on :${config.port}, serving ${config.staticDir}; ` +
        `keyboard '${config.keyboardClientPrefix}*' port '*${config.keyboardPortMatch}*' or 'KOMPLETE KONTROL*' port '*MIDI 1*' -> synth '${config.synthClientPrefix}*', ` +
        `poll ${config.pollIntervalMs}ms`
    )
    reconciler.start()
    void launchkey.start()
  })

  // The route itself lives in the kernel, so shutting down never stops sound.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`)
    reconciler.stop()
    setTimeout(() => process.exit(0), 2000).unref()
    // Put the Launchkey back in standalone mode before exiting.
    void launchkey.stop().finally(() => {
      publisher.close()
      server.close(() => process.exit(0))
    })
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main()
