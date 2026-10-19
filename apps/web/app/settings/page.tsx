import { MidiStatusPanel } from "@/app/modules/midi-connection/components/MidiStatusPanel"
import { PowerOffButton } from "@/app/modules/system-power/components/PowerOffButton"

export default function Page() {
  return (
    <div className="route-page settings-page">
      <section className="device-panel" aria-label="Device">
        <span className="device-badge">LOCAL PI</span>
        <PowerOffButton />
      </section>

      <MidiStatusPanel />

      <section className="settings-banner" aria-labelledby="settings-banner-title">
        <span className="eyebrow eyebrow-on-blue">RASPBERRY PI PIANO / 01</span>
        <h2 id="settings-banner-title" className="settings-banner-heading">
          PLAY
          <br />
          <span>LOUDER.</span>
        </h2>
        <p className="hero-lede">
          Your local piano lab for trying sounds, warming up, and finding the next note.
        </p>
      </section>
    </div>
  )
}
