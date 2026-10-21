"use client"

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react"

type LeaveContinuation = () => void
type LeaveHandler = (continuation: LeaveContinuation) => void

type LyricsNavigationGuard = {
  register: (handler: LeaveHandler) => () => void
  request: (continuation: LeaveContinuation) => boolean
}

const LyricsNavigationGuardContext = createContext<LyricsNavigationGuard | null>(null)

export function LyricsNavigationGuardProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<LeaveHandler | null>(null)
  const register = useCallback((handler: LeaveHandler) => {
    handlerRef.current = handler
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null
    }
  }, [])
  const request = useCallback((continuation: LeaveContinuation) => {
    const handler = handlerRef.current
    if (!handler) return false
    handler(continuation)
    return true
  }, [])

  return (
    <LyricsNavigationGuardContext.Provider value={{ register, request }}>
      {children}
    </LyricsNavigationGuardContext.Provider>
  )
}

export function useLyricsNavigationGuard(): LyricsNavigationGuard {
  const guard = useContext(LyricsNavigationGuardContext)
  if (!guard) throw new Error("useLyricsNavigationGuard must be used inside LyricsNavigationGuardProvider")
  return guard
}
