import type { InstrumentId } from "keystack-shared"

import { cn } from "@/lib/utils"
import { VoiceArt } from "./VoiceArt"

function PianoCard({
  id,
  name,
  description,
  selected = false,
  disabled = false,
  onClick,
  className,
}: {
  id: InstrumentId
  name: string
  description: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      data-slot="piano-card"
      data-selected={selected || undefined}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "piano-card flex w-full cursor-pointer flex-col gap-4 border-2 border-border bg-card p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
        selected && "piano-card-selected",
        className
      )}
    >
      <div className="piano-card-art flex w-full items-center justify-center border-2 border-border bg-secondary">
        <VoiceArt voice={id} />
      </div>
      <span className="piano-card-name">{name}</span>
      <span className="piano-card-description">{description}</span>
      <span className="piano-card-action" aria-hidden="true">{selected ? "PLAYING" : "SELECT"}</span>
    </button>
  )
}

export { PianoCard }
