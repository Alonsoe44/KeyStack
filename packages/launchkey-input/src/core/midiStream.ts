/** Data bytes that follow a status byte, or 0 for single-byte messages. */
function dataLength(status: number): number {
  if (status < 0xc0 || (status >= 0xe0 && status < 0xf0)) return 2
  if (status < 0xe0) return 1
  if (status === 0xf1 || status === 0xf3) return 1
  if (status === 0xf2) return 2
  return 0
}

/**
 * Splits a raw MIDI byte stream into whole messages. Handles running status
 * and messages split across reads; skips SysEx bodies and stray data bytes.
 */
export class MidiStreamParser {
  private status = 0
  private data: number[] = []
  private inSysex = false

  push(bytes: Iterable<number>, onMessage: (message: Uint8Array) => void): void {
    for (const byte of bytes) {
      if (byte >= 0xf8) {
        // Real-time bytes can appear anywhere and leave running status alone.
        onMessage(Uint8Array.of(byte))
      } else if (byte === 0xf0) {
        this.inSysex = true
        this.status = 0
      } else if (byte === 0xf7) {
        this.inSysex = false
      } else if (byte >= 0x80) {
        this.inSysex = false
        this.status = byte
        this.data = []
        if (dataLength(byte) === 0) this.finish(onMessage)
      } else if (!this.inSysex && this.status !== 0) {
        this.data.push(byte)
        if (this.data.length === dataLength(this.status)) this.finish(onMessage)
      }
    }
  }

  private finish(onMessage: (message: Uint8Array) => void): void {
    onMessage(Uint8Array.of(this.status, ...this.data))
    this.data = []
    // Only channel messages may use running status.
    if (this.status >= 0xf0) this.status = 0
  }
}
