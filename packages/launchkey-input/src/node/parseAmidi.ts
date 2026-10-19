export type AmidiPort = {
  /** "I", "O" or "IO". */
  direction: string
  /** For example "hw:1,0,1". */
  device: string
  name: string
}

/** Parses `amidi -l`. Lines that are not ports (the header) are skipped. */
export function parseAmidiList(output: string): AmidiPort[] {
  const ports: AmidiPort[] = []
  for (const line of output.split("\n")) {
    const match = /^\s*(IO|I|O)\s+(hw:\S+)\s+(.+?)\s*$/.exec(line)
    if (match) ports.push({ direction: match[1], device: match[2], name: match[3] })
  }
  return ports
}

/**
 * Turns `amidi -d` output into bytes. Output arrives in arbitrary chunks, so
 * a hex pair split across two chunks is held until the next one.
 */
export class AmidiDumpParser {
  private rest = ""

  push(chunk: string): number[] {
    const text = this.rest + chunk
    const lastSpace = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\n"))
    this.rest = text.slice(lastSpace + 1)
    const bytes: number[] = []
    for (const token of text.slice(0, lastSpace + 1).split(/\s+/)) {
      if (/^[0-9A-Fa-f]{2}$/.test(token)) bytes.push(parseInt(token, 16))
    }
    return bytes
  }
}

/** Bytes as `amidi -S` takes them: "9F 0C 7F". */
export function toAmidiHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")
}
