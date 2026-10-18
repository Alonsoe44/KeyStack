import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <div className="route-page scales-page">
      <div className="route-topline">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "back-link")}>
          <ArrowLeft aria-hidden="true" />
          Home
        </Link>
        <span className="route-number">03 / PRACTICE ROOM</span>
      </div>

      <header className="route-header">
        <div>
          <span className="eyebrow">WARM-UP MODE / 03</span>
          <h1 className="display-heading route-heading">GET<br /><span>IN TUNE.</span></h1>
          <p className="route-lede">Pick a run, wake up your fingers, and let the metronome keep you honest.</p>
        </div>
      </header>

      <section className="scale-choice-panel" aria-labelledby="scale-choice-heading">
        <div className="panel-topline">
          <div>
            <span className="eyebrow">PRACTICE ROUTINES</span>
            <h2 id="scale-choice-heading" className="panel-heading">Choose a run.</h2>
          </div>
          <span className="panel-meta">01 ROUTINE READY</span>
        </div>
        <Link href="/scales/chromatic" className="scale-choice-card">
          <span className="scale-card-index">01</span>
          <span className="scale-card-copy">
            <strong>Chromatic scale</strong>
            <span>Every key, one smooth climb. Start with one octave or take the two-octave route.</span>
          </span>
          <span className="scale-card-arrow" aria-hidden="true"><ArrowUpRight /></span>
        </Link>
      </section>
    </div>
  )
}
