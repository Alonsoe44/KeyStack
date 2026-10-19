"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ImportJob } from "keystack-shared"

import { getImportJob, ImportApiError } from "../adapters/songstreamer-import-client"

const STORAGE_KEY = "keystack.active-import-job"
const activeStatuses = new Set<ImportJob["status"]>(["queued", "downloading", "verifying", "publishing"])

type ImportJobContextValue = {
  job: ImportJob | null
  active: boolean
  setJob(job: ImportJob): void
  clearJob(): void
}

const ImportJobContext = createContext<ImportJobContextValue | null>(null)

function placeholderJob(id: string): ImportJob {
  const now = new Date().toISOString()
  return {
    id,
    title: "Import in progress",
    artist: "",
    album: null,
    formatId: "",
    status: "queued",
    progress: 0,
    errorCode: null,
    errorMessage: null,
    songId: null,
    sourceVideoId: null,
    sourceTitle: null,
    sourceArtist: null,
    measuredDuration: null,
    sampleRateHz: null,
    channels: null,
    bitrateBitsPerSecond: null,
    bytes: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  }
}

export function ImportJobProvider({ children }: { children: React.ReactNode }) {
  const [job, setJobState] = useState<ImportJob | null>(null)
  const active = job !== null && activeStatuses.has(job.status)

  const setJob = useCallback((next: ImportJob) => {
    setJobState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next.id)
    } catch {
      // The in-memory state still protects the current page when storage is unavailable.
    }
  }, [])

  const clearJob = useCallback(() => {
    setJobState(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing else is required when storage is unavailable.
    }
  }, [])

  useEffect(() => {
    let id: string | null = null
    try {
      id = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return
    }
    if (!id) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setJobState(placeholderJob(id as string))
    })
    const controller = new AbortController()
    getImportJob(id, controller.signal)
      .then((next) => setJobState(next))
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          if (error instanceof ImportApiError && error.status === 404) {
            setJobState({
              ...placeholderJob(id),
              status: "failed",
              errorCode: "JOB_NOT_FOUND",
              errorMessage: "The server no longer has this import job.",
            })
            try {
              window.localStorage.removeItem(STORAGE_KEY)
            } catch {
              // The in-memory failed state still unlocks navigation.
            }
          }
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const currentUrl = window.location.href
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const popState = () => {
      window.history.pushState({}, "", currentUrl)
    }
    window.addEventListener("beforeunload", beforeUnload)
    window.addEventListener("popstate", popState)
    window.history.replaceState({}, "", currentUrl)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      window.removeEventListener("popstate", popState)
    }
  }, [active])

  const value = useMemo(() => ({ job, active, setJob, clearJob }), [active, clearJob, job, setJob])
  return <ImportJobContext.Provider value={value}>{children}</ImportJobContext.Provider>
}

export function useImportJob() {
  const value = useContext(ImportJobContext)
  if (!value) throw new Error("useImportJob must be used inside ImportJobProvider")
  return value
}
