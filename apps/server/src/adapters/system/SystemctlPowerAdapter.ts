import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { SystemPowerPort } from "../../ports/SystemPowerPort"

const execFileAsync = promisify(execFile)

// No sudo needed: logind lets the user of the active desktop session power
// the machine off.
export class SystemctlPowerAdapter implements SystemPowerPort {
  constructor(private readonly timeoutMs = 5000) {}

  async powerOff(): Promise<void> {
    try {
      await execFileAsync("systemctl", ["poweroff"], {
        timeout: this.timeoutMs,
      })
    } catch (err) {
      const { stderr, message } = err as Error & { stderr?: string }
      throw new Error(`systemctl poweroff: ${stderr?.trim() || message}`)
    }
  }
}
