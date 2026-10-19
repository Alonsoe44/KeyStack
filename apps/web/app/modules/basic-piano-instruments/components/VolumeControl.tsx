"use client"

import { useState } from "react"
import { Volume2 } from "lucide-react"

import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { usePianoVolume } from "./usePianoVolume"

const single = (value: number | readonly number[]) => (typeof value === "number" ? value : value[0])

/** The piano's volume. Songs in the song player keep their own level. */
function VolumeControl({ className }: { className?: string }) {
  const { volume, error, commit } = usePianoVolume()
  // While dragging, show the thumb where the finger is; send on release.
  const [dragging, setDragging] = useState<number | null>(null)
  const value = dragging ?? volume ?? 0

  return (
    <div data-slot="volume-control" className={cn("flex items-center gap-3", className)}>
      <Volume2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <Slider
        aria-label="Piano volume"
        value={value}
        disabled={volume === null}
        onValueChange={(next) => setDragging(single(next))}
        onValueCommitted={(next) => {
          setDragging(null)
          void commit(single(next))
        }}
        className="w-32"
      >
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <span className="volume-value" aria-hidden="true">
        {volume === null ? "--" : Math.round(value)}
      </span>
      {error && (
        <span role="alert" className="volume-error">
          {error}
        </span>
      )}
    </div>
  )
}

export { VolumeControl }
