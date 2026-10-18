import type { SeqAddress, SeqClient } from "../domain/midi-connection/types"

export interface SequencerPort {
  listClients(): Promise<SeqClient[]>
  connect(from: SeqAddress, to: SeqAddress): Promise<void>
}
