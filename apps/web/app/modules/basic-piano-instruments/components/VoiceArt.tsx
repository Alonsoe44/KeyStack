import type { InstrumentId } from "keystack-shared"

const KEYS_X = 30
const KEYS_Y = 92
const WHITE_W = 15
const WHITE_KEYS = 12
// Black keys follow white keys C, D, F, G and A in each octave.
const BLACK_AFTER = [0, 1, 3, 4, 5]

function Keys() {
  const black = Array.from({ length: WHITE_KEYS - 1 }, (_, i) => i).filter((i) => BLACK_AFTER.includes(i % 7))
  return (
    <g>
      {Array.from({ length: WHITE_KEYS }, (_, i) => (
        <rect key={i} className="voice-art-white" x={KEYS_X + i * WHITE_W} y={KEYS_Y} width={WHITE_W} height={38} />
      ))}
      {black.map((i) => (
        <rect key={i} className="voice-art-black" x={KEYS_X + (i + 1) * WHITE_W - 4.5} y={KEYS_Y} width={9} height={23} />
      ))}
    </g>
  )
}

function GrandPiano() {
  return (
    <>
      {/* Lid propped open behind the keyboard. */}
      <path className="voice-art-lid" d="M28 88 196 26 214 88Z" />
      <path className="voice-art-line" d="M150 88 172 50" />
      <rect className="voice-art-body voice-art-ink" x="22" y="84" width="196" height="12" />
      <Keys />
      <rect className="voice-art-body voice-art-ink" x="22" y="130" width="196" height="10" />
      <rect className="voice-art-body voice-art-ink" x="32" y="140" width="12" height="16" />
      <rect className="voice-art-body voice-art-ink" x="196" y="140" width="12" height="16" />
    </>
  )
}

function ElectricPiano() {
  return (
    <>
      {/* Rhodes Stage: rounded tolex lid, name rail, thin legs. */}
      <rect className="voice-art-body voice-art-blue" x="22" y="50" width="196" height="42" rx="14" />
      <rect className="voice-art-plate" x="96" y="62" width="48" height="12" />
      <Keys />
      <rect className="voice-art-body voice-art-blue" x="22" y="130" width="196" height="10" />
      <path className="voice-art-leg" d="M46 140 36 158M194 140l10 18" />
    </>
  )
}

function Clavinet() {
  return (
    <>
      {/* Clavinet D6: wedge case with its tone switches and knobs on top. */}
      <path className="voice-art-body voice-art-pink" d="M22 92V70l196-22v44Z" />
      <rect className="voice-art-plate" x="40" y="72" width="30" height="10" />
      <circle className="voice-art-knob" cx="160" cy="68" r="6" />
      <circle className="voice-art-knob" cx="182" cy="65" r="6" />
      <circle className="voice-art-knob" cx="204" cy="62" r="5" />
      <Keys />
      <rect className="voice-art-body voice-art-pink" x="22" y="130" width="196" height="10" />
    </>
  )
}

const ART: Record<InstrumentId, () => React.ReactNode> = {
  piano: GrandPiano,
  "electric-piano": ElectricPiano,
  "stevie-wonder-piano": Clavinet,
}

/** A code-native drawing of each voice, in the display tokens. */
export function VoiceArt({ voice }: { voice: InstrumentId }) {
  const Art = ART[voice]
  return (
    <svg className="voice-art" viewBox="0 0 240 168" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <Art />
    </svg>
  )
}
