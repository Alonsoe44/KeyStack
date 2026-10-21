import type { InstrumentId } from "keystack-shared"
import { PianoCard } from "@/app/modules/basic-piano-instruments/components/PianoCard"
import { INSTRUMENTS, type Instrument } from "@/app/modules/basic-piano-instruments/core/instrument"

function PianoRack({
  instruments = INSTRUMENTS.map((instrument) => ({ ...instrument, selected: false })),
  onSelect,
  disabled = false,
}: {
  instruments?: (Instrument & { selected?: boolean })[]
  onSelect?: (instrumentId: InstrumentId) => void
  disabled?: boolean
}) {
  return (
    <div data-slot="piano-rack" className="flex w-7/8 items-stretch gap-4">
      {instruments.map((instrument) => (
        <PianoCard
          key={instrument.id}
          id={instrument.id}
          name={instrument.name}
          description={instrument.description}
          selected={instrument.selected}
          disabled={disabled}
          onClick={() => onSelect?.(instrument.id)}
        />
      ))}
    </div>
  )
}

export { PianoRack }
