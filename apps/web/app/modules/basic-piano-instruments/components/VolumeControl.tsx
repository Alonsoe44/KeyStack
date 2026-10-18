import { Volume2 } from "lucide-react"

import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider"
import { cn } from "@/lib/utils"

function VolumeControl({
  defaultValue = 70,
  className,
}: {
  defaultValue?: number
  className?: string
}) {
  return (
    <div
      data-slot="volume-control"
      className={cn("flex items-center gap-3", className)}
    >
      <Volume2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <Slider aria-label="Output volume" defaultValue={defaultValue} className="w-32">
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb />
          </SliderTrack>
        </SliderControl>
      </Slider>
    </div>
  )
}

export { VolumeControl }
