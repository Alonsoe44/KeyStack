import { getPianoLayout, type OctaveCount } from "@/lib/chromatic-scale"
import { cn } from "@/lib/utils"

interface PianoProps {
  octaves: OctaveCount
}

export function Piano({ octaves }: PianoProps) {
  const keys = getPianoLayout(octaves)
  const whiteKeys = keys.filter((key) => !key.isBlack)
  const blackKeys = keys.filter((key) => key.isBlack)
  const whiteCount = whiteKeys.length

  return (
    <div className="practice-piano-keys relative flex h-28 w-full select-none sm:h-32" aria-label={`${octaves} octave piano keyboard`} role="img">
      {whiteKeys.map((key) => (
        <div
          key={key.index}
          className={cn(
            "piano-white-key flex flex-1 flex-col justify-end border border-border bg-primary/10",
            key.name === "C" &&
              key.index !== 0 &&
              "border-l-2 border-l-foreground/30"
          )}
        >
          <span className="pb-1 text-center font-mono text-[10px] text-muted-foreground">
            {key.name}
          </span>
        </div>
      ))}
      {blackKeys.map((key) => (
        <div
          key={key.index}
          className="piano-black-key absolute top-0 h-[60%] w-[7%] max-w-6 bg-primary/70"
          style={{
            left: `calc(${((key.precedingWhiteIndex + 1) * 100) / whiteCount}% - 3.5%)`,
          }}
        />
      ))}
    </div>
  )
}
