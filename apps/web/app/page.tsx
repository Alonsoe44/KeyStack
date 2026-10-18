import Link from "next/link"
import { ArrowUpRight, Sparkles } from "lucide-react"

import { MidiStatusPanel } from "@/app/modules/midi-connection/components/MidiStatusPanel"
import { HeroKeys } from "@/components/hero-keys"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const playModes = [
  {
    index: "01",
    title: "Choose a voice",
    copy: "Switch between the voices installed on your local piano.",
    href: "/instruments",
    className: "play-mode-blue",
  },
  {
    index: "02",
    title: "Practice a scale",
    copy: "Set the tempo, pick a run, and let your hands wake up.",
    href: "/scales",
    className: "play-mode-yellow",
  },
]

export default function Page() {
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <span className="eyebrow eyebrow-on-blue">RASPBERRY PI PIANO / 01</span>
          <h1 id="home-title" className="display-heading hero-heading">
            PLAY
            <br />
            <span>LOUDER.</span>
          </h1>
          <p className="hero-lede">
            Your local piano lab for trying sounds, warming up, and finding the next note.
          </p>
          <div className="hero-actions">
            <Link href="/instruments" className={cn(buttonVariants({ size: "lg" }), "button-yellow")}>
              Start playing
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <Link href="/scales" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "button-on-blue")}>
              Warm up first
            </Link>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-art-note hero-art-note-left">DO</div>
          <div className="hero-art-note hero-art-note-right">RE</div>
          <HeroKeys className="hero-keys" />
          <div className="hero-sticker">
            <Sparkles aria-hidden="true" />
            <span>MAKE<br />A LITTLE<br />NOISE</span>
          </div>
          <div className="hero-art-caption">
            <span>ONE OCTAVE</span>
            <strong>ENDLESS IDEAS</strong>
          </div>
        </div>
      </section>

      <section className="home-status-layout" aria-label="Piano status">
        <MidiStatusPanel />
        <aside className="signal-card">
          <span className="eyebrow">RIGHT NOW</span>
          <p className="signal-quote">The best practice session starts with one curious note.</p>
          <div className="signal-line" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <span className="signal-caption">LISTEN / EXPERIMENT / REPEAT</span>
        </aside>
      </section>

      <section className="play-modes" aria-labelledby="play-modes-title">
        <div className="section-intro">
          <span className="eyebrow">YOUR NEXT MOVE</span>
          <h2 id="play-modes-title" className="section-heading">Pick a lane.</h2>
        </div>
        <div className="play-mode-grid">
          {playModes.map((mode) => (
            <Link key={mode.index} href={mode.href} className={cn("play-mode", mode.className)}>
              <span className="play-mode-index">{mode.index}</span>
              <span className="play-mode-arrow" aria-hidden="true"><ArrowUpRight /></span>
              <strong>{mode.title}</strong>
              <span>{mode.copy}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
