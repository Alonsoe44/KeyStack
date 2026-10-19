/**
 * Pure text editing for the on-screen keyboard: given a field's value and
 * selection, return the value and caret after one key. Kept free of the DOM so
 * it can be tested directly.
 */

export type FieldState = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type EditKey =
  | { kind: "text"; text: string }
  | { kind: "backspace" }
  | { kind: "newline" }

function clampSelection(state: FieldState): FieldState {
  const length = state.value.length
  const start = Math.max(0, Math.min(state.selectionStart, length))
  const end = Math.max(start, Math.min(state.selectionEnd, length))
  return { value: state.value, selectionStart: start, selectionEnd: end }
}

function replaceSelection(state: FieldState, text: string, maxLength: number | null): FieldState {
  const { value, selectionStart, selectionEnd } = state
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  let insert = text
  if (maxLength !== null) {
    const room = maxLength - before.length - after.length
    insert = room > 0 ? Array.from(insert).slice(0, room).join("") : ""
  }
  const caret = before.length + insert.length
  return { value: before + insert + after, selectionStart: caret, selectionEnd: caret }
}

/** Length of the character before `index`, so backspace never splits a surrogate pair. */
function previousCharLength(value: string, index: number): number {
  if (index >= 2) {
    const low = value.charCodeAt(index - 1)
    const high = value.charCodeAt(index - 2)
    if (low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff) return 2
  }
  return index > 0 ? 1 : 0
}

/**
 * Applies one key. `maxLength` mirrors the field's maxlength attribute (null
 * when unlimited); `multiline` is true for textareas, where Enter inserts a
 * line break.
 */
export function applyKey(
  current: FieldState,
  key: EditKey,
  options: { maxLength?: number | null; multiline?: boolean } = {}
): FieldState {
  const state = clampSelection(current)
  const maxLength = options.maxLength ?? null
  if (key.kind === "text") return replaceSelection(state, key.text, maxLength)
  if (key.kind === "newline") return options.multiline ? replaceSelection(state, "\n", maxLength) : state
  if (state.selectionStart !== state.selectionEnd) return replaceSelection(state, "", null)
  const remove = previousCharLength(state.value, state.selectionStart)
  if (remove === 0) return state
  const caret = state.selectionStart - remove
  return {
    value: state.value.slice(0, caret) + state.value.slice(state.selectionStart),
    selectionStart: caret,
    selectionEnd: caret,
  }
}
