export type OctaveCount = 1 | 2

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const

const BLACK_KEYS = new Set(["C#", "D#", "F#", "G#", "A#"])

// Standard chromatic-scale fingering for the 12 semitones starting on C.
// This is the periodic unit that repeats once per octave.
const RH_FINGER_BASE = [1, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1]
const LH_FINGER_BASE = [1, 3, 1, 3, 2, 1, 3, 1, 3, 1, 3, 2]

// Fingering for the final, topmost tonic C that closes the run.
const RH_CLOSING_FINGER = 2
const LH_CLOSING_FINGER = 1

export interface ChromaticNote {
  index: number
  name: string
  isBlack: boolean
  rhFinger: number
  lhFinger: number
}

export function getChromaticScale(octaves: OctaveCount): ChromaticNote[] {
  const semitoneCount = 12 * octaves
  const notes: ChromaticNote[] = []

  for (let i = 0; i < semitoneCount; i++) {
    const name = NOTE_NAMES[i % 12]
    // Every octave-boundary C (not just the final one) is the second half of
    // the B-C white-key pair, so the RH thumb substitute (finger 2) applies
    // there too. The very first C (i === 0) has no preceding B and keeps the
    // thumb.
    const isOctaveBoundaryC = i % 12 === 0 && i !== 0
    notes.push({
      index: i,
      name,
      isBlack: BLACK_KEYS.has(name),
      rhFinger: isOctaveBoundaryC ? RH_CLOSING_FINGER : RH_FINGER_BASE[i % 12],
      lhFinger: LH_FINGER_BASE[i % 12],
    })
  }

  notes.push({
    index: semitoneCount,
    name: "C",
    isBlack: false,
    rhFinger: RH_CLOSING_FINGER,
    lhFinger: LH_CLOSING_FINGER,
  })

  return notes
}

export interface PianoKeyLayout extends ChromaticNote {
  whiteIndex: number | null
  precedingWhiteIndex: number
}

export function getPianoLayout(octaves: OctaveCount): PianoKeyLayout[] {
  const notes = getChromaticScale(octaves)
  let whiteCounter = -1

  return notes.map((note) => {
    if (!note.isBlack) whiteCounter++
    return {
      ...note,
      whiteIndex: note.isBlack ? null : whiteCounter,
      precedingWhiteIndex: whiteCounter,
    }
  })
}
