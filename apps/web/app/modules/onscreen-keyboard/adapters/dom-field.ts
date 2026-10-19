import { applyKey, type EditKey, type FieldState } from "../core/editing"

export type EditableField = HTMLInputElement | HTMLTextAreaElement

// Input types that take free text. Range, number, checkbox and friends keep
// their own controls and never open the keyboard.
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "email", "tel", "password", ""])

/** True for fields the on-screen keyboard should type into. */
export function isEditableField(element: Element | null): element is EditableField {
  if (!element) return false
  if (element.closest("[data-osk='off']")) return false
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type) && !element.readOnly && !element.disabled
  }
  return false
}

// url and email inputs expose no selection (selectionStart is null and
// setSelectionRange throws), so typing there always works at the end.
function readSelection(field: EditableField): FieldState {
  const { value } = field
  const start = field.selectionStart
  const end = field.selectionEnd
  if (start === null || end === null) return { value, selectionStart: value.length, selectionEnd: value.length }
  return { value, selectionStart: start, selectionEnd: end }
}

function writeValue(field: EditableField, value: string) {
  // React tracks `value` on the element itself; the prototype setter changes
  // it underneath, so the dispatched input event reaches onChange.
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value)
}

/** Applies one key to a real field and notifies React (or any listener). */
export function editField(field: EditableField, key: EditKey) {
  const before = readSelection(field)
  const after = applyKey(before, key, {
    maxLength: field.maxLength > 0 ? field.maxLength : null,
    multiline: field instanceof HTMLTextAreaElement,
  })
  if (after.value === before.value && after.selectionStart === before.selectionStart) return
  writeValue(field, after.value)
  try {
    field.setSelectionRange(after.selectionStart, after.selectionEnd)
  } catch {
    // url/email inputs have no selection API; their caret stays at the end.
  }
  field.dispatchEvent(new Event("input", { bubbles: true }))
}

/**
 * Enter: a line break in a textarea; in a single-line field, submit its form
 * the way a hardware Enter would, then let the keyboard close.
 */
export function pressEnter(field: EditableField): "newline" | "submitted" | "none" {
  if (field instanceof HTMLTextAreaElement) {
    editField(field, { kind: "newline" })
    return "newline"
  }
  if (field.form) {
    field.form.requestSubmit()
    return "submitted"
  }
  return "none"
}
