// [mm:ss.xx] line tags, possibly several in front of one line.
const LINE_TIME_TAGS = /^(?:\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+/
// <mm:ss.xx> word tags of the "enhanced" LRC variant.
const WORD_TIME_TAGS = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g
// [ar:Artist], [length:03:20], [offset:+100] and other header tags.
const METADATA_LINE = /^\[[a-z#]+:.*\]$/i

/** Removes every LRC timestamp, leaving one lyric line per text line. */
export function stripLrcTimestamps(synced: string): string {
  return synced
    .split(/\r?\n/)
    .filter((line) => !METADATA_LINE.test(line.trim()))
    .map((line) => line.replace(LINE_TIME_TAGS, "").replace(WORD_TIME_TAGS, "").replace(/\s+/g, " ").trim())
    .join("\n")
}

function normalize(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const joined = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  return joined === "" ? null : joined
}

/**
 * Plain lyrics win; synced lyrics are only a fallback, with their timing
 * dropped because the editor times every line against the exact recording.
 */
export function plainTextFrom(plain: string | null, synced: string | null): string | null {
  if (plain !== null) {
    const text = normalize(plain)
    if (text !== null) return text
  }
  return synced === null ? null : normalize(stripLrcTimestamps(synced))
}
