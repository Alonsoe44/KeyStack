import { cn } from "@/lib/utils"

function PianoCard({
  name,
  image,
  selected = false,
  disabled = false,
  onClick,
  className,
}: {
  name: string
  image: string
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
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "piano-card flex w-full cursor-pointer flex-col items-center gap-4 border-2 border-border bg-card p-4 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50",
        selected && "piano-card-selected",
        className
      )}
    >
      <div className="piano-card-art flex aspect-square w-full items-center justify-center overflow-hidden border-2 border-border bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="size-full object-contain mix-blend-multiply" />
      </div>
      <span className="piano-card-name text-card-foreground">{name}</span>
      <span className="piano-card-action" aria-hidden="true">SELECT</span>
    </button>
  )
}

export { PianoCard }
