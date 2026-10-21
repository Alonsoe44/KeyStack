import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

export default function Page() {
  return (
    <div className="route-page scales-page">
      <section className="scale-choice-panel" aria-labelledby="scale-choice-heading">
        <div className="panel-topline">
          <div>
            <span className="eyebrow">PRACTICE ROUTINES</span>
            <h1 id="scale-choice-heading" className="panel-heading">Choose a run.</h1>
          </div>
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
