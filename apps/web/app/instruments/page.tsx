import Link from "next/link"
import { ArrowLeft, SlidersHorizontal } from "lucide-react"

import { PianoRackContainer } from "@/app/modules/basic-piano-instruments/components/PianoRackContainer"
import { VolumeControl } from "@/app/modules/basic-piano-instruments/components/VolumeControl"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <div className="route-page instruments-page">
      <div className="route-topline">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "back-link")}>
          <ArrowLeft aria-hidden="true" />
          Home
        </Link>
        <div className="control-ribbon">
          <span className="eyebrow">OUTPUT</span>
          <VolumeControl />
        </div>
      </div>

      <header className="route-header">
        <div>
          <span className="eyebrow">VOICE LIBRARY / 02</span>
          <h1 className="display-heading route-heading">PICK<br /><span>A VOICE.</span></h1>
          <p className="route-lede">Three ways to color the same set of keys. Your choice stays local to this piano.</p>
        </div>
      </header>

      <section className="instrument-panel" aria-labelledby="instrument-heading">
        <div className="panel-topline">
          <div>
            <span className="eyebrow">AVAILABLE SOUNDS</span>
            <h2 id="instrument-heading" className="panel-heading">Find your color.</h2>
          </div>
          <span className="panel-meta"><SlidersHorizontal aria-hidden="true" /> Local instrument control</span>
        </div>
        <PianoRackContainer />
      </section>
    </div>
  )
}
