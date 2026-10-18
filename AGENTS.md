# KeyStack repository instructions

These instructions apply to the whole repository. More specific `AGENTS.md`
files may add constraints for a subdirectory.

## Product and deployment shape

KeyStack is a Raspberry Pi piano based system. Keep the two Pi
roles separate in the code and documentation:

- **Local/client Pi:** runs the interactive React frontend and the local Node.js
  backend. The local backend owns device-facing behavior like midi connections, and device local configs (volume, brigness) 
- **Cloud/server Pi:** runs the Fastify service and SQLite catalogue for songs,
  MP3 assets, and timed karaoke lyrics. It is the source for catalogue and
  content synchronization.

The current repository already contains a Next.js-based web app and a Node
server for the hardware client. Treat the planned React frontend, local
Express/Node backend, and cloud Fastify/SQLite backend as separate boundaries;
do not couple frontend components directly to SQLite or hardware adapters.

When introducing the new services, prefer a clear layout such as:

```text
apps/
  web/                 # React frontend and karaoke timing editor/player
  local-server/        # Express + Node service for the client Pi
  cloud-server/        # Fastify + SQLite service for the server Pi
packages/
  shared/              # API contracts, domain types, validation, utilities
```

Reuse the existing layout when it is still appropriate; do not move code just
to match this example. Update documentation when the actual layout differs.

## Technology rules

- Frontend: React with TypeScript.
- Local backend: Node.js with Express and TypeScript.
- Cloud backend: Node.js with Fastify and TypeScript.
- Catalogue metadata and timed lyrics: SQLite on the cloud/server Pi.
- Song audio: MP3 files stored as filesystem/object assets, with metadata and
  stable paths or URLs in SQLite. Do not store MP3 binary data in SQLite unless
  there is a documented, measured reason to do so.
- Use shared TypeScript contracts for API payloads. Validate data at service
  boundaries and return explicit errors.
- Keep the karaoke lyrics timing format versioned. The exact format is not
  decided yet; isolate it behind domain types and serialization code so it can
  change without rewriting the editor or player.

## Karaoke data direction

The timing editor should use the audio player's current playback position as
the clock. A timed lyric must be associated with the exact recording/version of
the MP3. At minimum, the future format needs:

- track identity and version;
- language and lyric text;
- ordered lines and words;
- start times, and optionally end times, in integer milliseconds;
- schema/format version and review status.

Keep timestamps deterministic and editable. Support draft data and validation
for monotonic timestamps before publishing it to clients.

## Docker-first setup

Keep development, tests, migrations, and service startup reproducible from the
repository. Prefer Docker and Docker Compose files checked into the codebase
over host-wide installation or manual configuration.

- Pin base images and package versions where practical.
- Keep persistent SQLite and MP3 data in named volumes or explicitly mounted
  data directories; never bake user content into an image.
- Provide `.env.example` files and document every required variable. Never
  commit secrets, private keys, or real credentials.
- Make containers configurable for ARM64 Raspberry Pi images as well as local
  development.
- Add health checks and a documented startup order for services that depend on
  one another.
- Prefer non-root containers and least-privilege filesystem permissions.

If a Raspberry Pi host still needs system packages, kernel/device access,
network setup, USB/MIDI permissions, or boot/autostart configuration, keep the
application setup in Docker and document the unavoidable host step in the
relevant `README` or `deploy` document. Avoid modifying global system files
from application scripts.

## API and storage conventions

- Version public APIs (for example, `/api/v1`).
- Keep local-to-cloud synchronization explicit and retryable; do not assume a
  request succeeds exactly once.
- Use stable IDs, content hashes, and created/updated timestamps for songs,
  audio assets, lyric versions, and sync records.
- Store filesystem paths relative to a configured media root, or store opaque
  asset keys, rather than hard-coded absolute paths.
- Enforce path traversal protection and validate MP3 uploads before publishing
  them.
- Add migrations for every SQLite schema change. Do not edit production SQLite
  tables manually without documenting the migration.

## Development workflow

- Read the relevant package and framework documentation in `node_modules`
  before changing framework integration. This repository uses a Next.js setup
  whose APIs and conventions may differ from commonly known Next.js versions.
- Use the repository package scripts and Docker workflows first.
- Run focused tests and type checks for changed packages, then the relevant
  workspace-wide checks before handing off work.
- Keep hardware-specific adapters behind interfaces so frontend and cloud code
  can be tested without a Raspberry Pi.
- Update architecture and deployment documentation whenever service ownership,
  ports, volumes, environment variables, or synchronization behavior changes.

## Existing Pi deployment

The existing `deploy/` scripts provision and deploy the current hardware client
using a user-level Node installation and systemd user services. Preserve this
behavior while the Docker migration is designed. Any replacement must document
the migration path and must not silently remove FluidSynth, kiosk, MIDI, or
audio-device setup.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
