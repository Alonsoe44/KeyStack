import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { SeqAddress, SeqClient } from "../../domain/midi-connection/types"
import type { SequencerPort } from "../../ports/SequencerPort"
import { parseAconnectList } from "./parseAconnectList"

const execFileAsync = promisify(execFile)

type ExecError = Error & { stderr?: string; killed?: boolean }

export class AconnectSequencerAdapter implements SequencerPort {
  constructor(
    private readonly timeoutMs: number,
    private readonly binary = "aconnect"
  ) {}

  async listClients(): Promise<SeqClient[]> {
    return parseAconnectList(await this.run(["-l"]))
  }

  async connect(from: SeqAddress, to: SeqAddress): Promise<void> {
    await this.run([
      `${from.clientId}:${from.portId}`,
      `${to.clientId}:${to.portId}`,
    ])
  }

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(this.binary, args, {
        timeout: this.timeoutMs,
      })
      return stdout
    } catch (err) {
      const { stderr, killed, message } = err as ExecError
      const command = `${this.binary} ${args.join(" ")}`
      if (killed) {
        throw new Error(`${command} timed out after ${this.timeoutMs}ms`)
      }
      throw new Error(`${command}: ${stderr?.trim() || message}`)
    }
  }
}
