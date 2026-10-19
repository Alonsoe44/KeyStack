import { CircleHelp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getChromaticScale, type OctaveCount } from "@/lib/chromatic-scale"
import { cn } from "@/lib/utils"

interface FingeringTableProps {
  octaves: OctaveCount
}

export function FingeringTable({ octaves }: FingeringTableProps) {
  const notes = getChromaticScale(octaves)

  return (
    <div className="fingering-table flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Fingering</span>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="What do the finger numbers mean?"
              />
            }
          >
            <CircleHelp />
          </PopoverTrigger>
          <PopoverContent>
            RH and LH show which finger plays each note. Fingers are numbered 1
            thumb, 2 index, 3 middle, 4 ring, 5 pinky.
          </PopoverContent>
        </Popover>
      </div>
      <ScrollArea orientation="horizontal" className="fingering-scroll">
        <div className="inline-flex min-w-full flex-col gap-1">
          <Row label="Note">
            {notes.map((note) => (
              <Cell key={`note-${note.index}`}>{note.name}</Cell>
            ))}
          </Row>
          <Row label="RH">
            {notes.map((note) => (
              <Cell key={`rh-${note.index}`} accent={note.rhFinger === 1}>
                {note.rhFinger}
              </Cell>
            ))}
          </Row>
          <Row label="LH">
            {notes.map((note) => (
              <Cell key={`lh-${note.index}`} accent={note.lhFinger === 1}>
                {note.lhFinger}
              </Cell>
            ))}
          </Row>
        </div>
      </ScrollArea>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="fingering-row flex items-center gap-0.5">
      <span className="fingering-label w-8 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

function Cell({
  children,
  accent,
}: {
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <span
      className={cn(
        "fingering-cell w-7 shrink-0 text-center font-mono text-xs text-foreground",
        accent && "text-primary"
      )}
    >
      {children}
    </span>
  )
}
