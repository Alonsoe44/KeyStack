import { PianoRackContainer } from "@/app/modules/basic-piano-instruments/components/PianoRackContainer"

export default function Page() {
  return (
    <div className="route-page instruments-page">
      <section className="instrument-panel" aria-labelledby="instrument-heading">
        <div className="panel-topline">
          <div>
            <span className="eyebrow">AVAILABLE SOUNDS</span>
            <h1 id="instrument-heading" className="panel-heading">Pick a voice.</h1>
          </div>
        </div>
        <PianoRackContainer />
      </section>
    </div>
  )
}
