"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CountdownTimer } from "@/components/countdown-timer"
import { FingeringTable } from "@/components/fingering-table"
import { Metronome } from "@/components/metronome"
import { Piano } from "@/components/piano"
import type { OctaveCount } from "@/lib/chromatic-scale"

export function ChromaticPractice() {
  const [octaves, setOctaves] = useState<OctaveCount>(1)

  return (
    <div className="chromatic-practice">
      <section className="practice-main-card" aria-labelledby="range-heading">
        <div className="octave-switcher">
          <div>
            <span className="eyebrow">RANGE</span>
            <h2 id="range-heading" className="octave-switcher-label">How far are we going?</h2>
          </div>
          <div className="octave-switcher-buttons" role="group" aria-label="Choose octave range">
            <Button
              variant={octaves === 1 ? "default" : "outline"}
              size="sm"
              aria-pressed={octaves === 1}
              onClick={() => setOctaves(1)}
            >
              1 octave
            </Button>
            <Button
              variant={octaves === 2 ? "default" : "outline"}
              size="sm"
              aria-pressed={octaves === 2}
              onClick={() => setOctaves(2)}
            >
              2 octaves
            </Button>
          </div>
        </div>

        <ScrollArea orientation="horizontal" className="practice-piano-wrap" viewportClassName="practice-piano-scroll">
          <div className="practice-piano">
            <Piano octaves={octaves} />
          </div>
        </ScrollArea>
        <div className="practice-fingering">
          <FingeringTable octaves={octaves} />
        </div>
      </section>

      <aside className="practice-side-card" aria-label="Practice tools">
        <div className="practice-toolbar">
          <div className="tool-card">
            <span className="tool-title">Keep the pulse</span>
            <Metronome />
          </div>
          <div className="tool-card">
            <span className="tool-title">Stay in the room</span>
            <CountdownTimer />
          </div>
          <div className="tool-card tool-card-blue">
            <span className="tool-title">Tiny reminder</span>
            <p className="tool-subtle">Slow is smooth. Smooth is fast. Give every key enough space to sound.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}
