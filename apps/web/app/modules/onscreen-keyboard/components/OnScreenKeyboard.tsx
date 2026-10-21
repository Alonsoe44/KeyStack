"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { ArrowBigUp, ArrowBigUpDash, CornerDownLeft, Delete, KeyboardOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { editField, isEditableField, pressEnter, type EditableField } from "../adapters/dom-field"
import { charForShift, LAYERS, nextShiftState, type KeySpec, type LayerId, type ShiftState } from "../core/layouts"

// "on" for the kiosk build, "off" to disable, "auto" (default) for screens
// with touch and no mouse or trackpad.
const MODE = process.env.NEXT_PUBLIC_ONSCREEN_KEYBOARD ?? "auto"
const DOUBLE_TAP_MS = 350
const REPEAT_DELAY_MS = 450
const REPEAT_EVERY_MS = 70

const TOUCH_ONLY = ["(any-pointer: coarse)", "(any-pointer: fine)"]

function keyboardWanted(): boolean {
  if (MODE === "on") return true
  if (MODE === "off") return false
  const [coarse, fine] = TOUCH_ONLY.map((query) => window.matchMedia(query).matches)
  return coarse && !fine
}

// Re-evaluates when a mouse or trackpad is plugged in or removed.
function subscribePointers(onChange: () => void) {
  const queries = TOUCH_ONLY.map((query) => window.matchMedia(query))
  queries.forEach((query) => query.addEventListener("change", onChange))
  return () => queries.forEach((query) => query.removeEventListener("change", onChange))
}

// Stops system keyboards (squeekboard, Android) from opening on top of ours,
// and restores the field's own inputmode afterwards.
function suppressSystemKeyboard(field: EditableField) {
  if (field.dataset.oskInputmode !== undefined) return
  field.dataset.oskInputmode = field.getAttribute("inputmode") ?? ""
  field.setAttribute("inputmode", "none")
}

function restoreSystemKeyboard(field: EditableField) {
  const original = field.dataset.oskInputmode
  if (original === undefined) return
  if (original) field.setAttribute("inputmode", original)
  else field.removeAttribute("inputmode")
  delete field.dataset.oskInputmode
}

/**
 * Touch keyboard for the kiosk. The Pi's system keyboard (squeekboard) cannot
 * draw above a fullscreen Chromium on labwc, so KeyStack brings its own: it
 * opens for any focused text field, types through the field's normal input
 * events, and shrinks the app so the field stays visible above it.
 */
export function OnScreenKeyboard() {
  // Server render and hydration assume no keyboard; the client decides.
  const enabled = useSyncExternalStore(subscribePointers, keyboardWanted, () => false)
  const [field, setField] = useState<EditableField | null>(null)
  const [visible, setVisible] = useState(false)
  const [layer, setLayer] = useState<LayerId>("letters")
  const [shift, setShift] = useState<ShiftState>("off")
  const lastShiftTap = useRef(0)
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null
      if (!isEditableField(target)) return
      suppressSystemKeyboard(target)
      setField(target)
      setVisible(true)
    }
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target as Element | null
      if (isEditableField(target)) restoreSystemKeyboard(target)
      // Focus may be moving to another field; decide once it has landed.
      setTimeout(() => {
        if (isEditableField(document.activeElement)) return
        setField(null)
        setVisible(false)
      }, 0)
    }
    // Tapping the focused field again brings the keyboard back after "hide".
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === document.activeElement && isEditableField(event.target as Element)) setVisible(true)
    }
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [enabled])

  const open = enabled && visible && field !== null

  // A field can disappear without losing focus (a panel closes, a route
  // changes). Close rather than type into something no longer on screen.
  useEffect(() => {
    if (!open || !field) return
    const timer = setInterval(() => {
      if (!field.isConnected || field.getClientRects().length === 0) {
        setField(null)
        setVisible(false)
      }
    }, 400)
    return () => clearInterval(timer)
  }, [field, open])

  // Publish the keyboard's height so the app (and fixed panels) end above it.
  useLayoutEffect(() => {
    const root = document.documentElement
    const panel = panelRef.current
    if (!open || !panel) {
      root.classList.remove("osk-open")
      root.style.removeProperty("--osk-height")
      return
    }
    const publish = () => root.style.setProperty("--osk-height", `${panel.offsetHeight}px`)
    publish()
    root.classList.add("osk-open")
    const observer = new ResizeObserver(publish)
    observer.observe(panel)
    requestAnimationFrame(() => field?.scrollIntoView({ block: "nearest" }))
    return () => {
      observer.disconnect()
      root.classList.remove("osk-open")
      root.style.removeProperty("--osk-height")
    }
  }, [field, open])

  const stopRepeat = useCallback(() => {
    if (repeatTimer.current) clearTimeout(repeatTimer.current)
    repeatTimer.current = null
  }, [])

  useEffect(() => stopRepeat, [stopRepeat])
  useEffect(() => {
    if (!open) stopRepeat()
  }, [open, stopRepeat])

  const press = useCallback((key: KeySpec) => {
    if (!field) return
    switch (key.kind) {
      case "char":
        editField(field, { kind: "text", text: charForShift(key.value, shift) })
        if (shift === "once") setShift("off")
        return
      case "space":
        editField(field, { kind: "text", text: " " })
        return
      case "enter":
        if (pressEnter(field) === "submitted") field.blur()
        return
      case "shift": {
        const now = Date.now()
        setShift((current) => nextShiftState(current, now - lastShiftTap.current < DOUBLE_TAP_MS))
        lastShiftTap.current = now
        return
      }
      case "layer":
        setLayer(key.to)
        setShift("off")
        return
      case "hide":
        setVisible(false)
        return
      case "backspace":
        editField(field, { kind: "backspace" })
        return
    }
  }, [field, shift])

  const startBackspace = useCallback(() => {
    if (!field) return
    stopRepeat()
    editField(field, { kind: "backspace" })
    const repeat = () => {
      editField(field, { kind: "backspace" })
      repeatTimer.current = setTimeout(repeat, REPEAT_EVERY_MS)
    }
    repeatTimer.current = setTimeout(repeat, REPEAT_DELAY_MS)
  }, [field, stopRepeat])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="osk"
      role="group"
      aria-label="On-screen keyboard"
      // Keeps focus (and the caret) in the field for every tap on the keyboard.
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
    >
      {LAYERS[layer].map((row, rowIndex) => (
        <div key={`${layer}-${rowIndex}`} className="osk-row">
          {row.map((key, keyIndex) => {
            const id = `${layer}-${rowIndex}-${keyIndex}`
            if (key.kind === "backspace") {
              return (
                <button
                  key={id}
                  type="button"
                  tabIndex={-1}
                  className="osk-key osk-key-wide"
                  aria-label="Backspace"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    try {
                      // Keeps the repeat going if the finger slides off the key.
                      event.currentTarget.setPointerCapture(event.pointerId)
                    } catch {
                      // Not every pointer can be captured; the key still works.
                    }
                    startBackspace()
                  }}
                  onPointerUp={stopRepeat}
                  onPointerCancel={stopRepeat}
                  onLostPointerCapture={stopRepeat}
                >
                  <Delete aria-hidden="true" />
                </button>
              )
            }
            return (
              <button
                key={id}
                type="button"
                tabIndex={-1}
                className={cn(
                  "osk-key",
                  key.kind === "space" && "osk-key-space",
                  (key.kind === "enter" || key.kind === "shift" || key.kind === "layer" || key.kind === "hide") && "osk-key-wide",
                  key.kind === "enter" && "osk-key-enter",
                  key.kind === "shift" && shift !== "off" && "osk-key-active"
                )}
                aria-label={
                  key.kind === "enter" ? "Enter"
                    : key.kind === "shift" ? (shift === "lock" ? "Caps lock on" : "Shift")
                    : key.kind === "space" ? "Space"
                    : key.kind === "hide" ? "Hide keyboard"
                    : key.kind === "layer" ? `Switch to ${key.label}`
                    : undefined
                }
                aria-pressed={key.kind === "shift" ? shift !== "off" : undefined}
                onClick={() => press(key)}
              >
                {key.kind === "char" && charForShift(key.value, shift)}
                {key.kind === "space" && "space"}
                {key.kind === "enter" && <CornerDownLeft aria-hidden="true" />}
                {key.kind === "shift" && (shift === "lock" ? <ArrowBigUpDash aria-hidden="true" /> : <ArrowBigUp aria-hidden="true" />)}
                {key.kind === "layer" && key.label}
                {key.kind === "hide" && <KeyboardOff aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
