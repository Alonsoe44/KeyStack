"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ImportInspection, SourceVideo } from "keystack-shared"
import { AlertTriangle, Check, Download, LoaderCircle, MonitorPlay, RotateCcw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSongPlayer } from "@/app/modules/song-player/components/SongPlayerProvider"
import { cn } from "@/lib/utils"
import {
  createImportJob,
  inspectImport,
  ImportApiError,
  retryImportJob,
  getImportJob,
} from "../adapters/songstreamer-import-client"
import { useImportJob } from "./ImportJobProvider"
import { SourceVideoSearch } from "./SourceVideoSearch"

type FormState = { title: string; artist: string; album: string; formatId: string }

function formatSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "size unknown"
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.round(bytes / 1_000)} KB`
}

function formatRate(rate: number | null) {
  return rate ? `${Math.round(rate)} kbps` : "bitrate unknown"
}

function statusLabel(status: string) {
  if (status === "queued") return "Queued"
  if (status === "downloading") return "Downloading"
  if (status === "verifying") return "Checking audio"
  if (status === "publishing") return "Adding to songs"
  if (status === "completed") return "Added to songs"
  return "Import failed"
}

export function ImportScreen() {
  const { job, active, setJob, clearJob } = useImportJob()
  const { setSongs } = useSongPlayer()
  const [url, setUrl] = useState("")
  const [inspection, setInspection] = useState<ImportInspection | null>(null)
  const [form, setForm] = useState<FormState>({ title: "", artist: "", album: "", formatId: "" })
  const [busy, setBusy] = useState<"inspect" | "create" | "retry" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const refreshedJobRef = useRef<string | null>(null)
  const activeJobId = active ? job?.id ?? null : null

  useEffect(() => {
    if (job?.status !== "completed" || refreshedJobRef.current === job.id) return
    refreshedJobRef.current = job.id
    setSongs(null)
  }, [job?.id, job?.status, setSongs])

  useEffect(() => {
    if (!activeJobId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const latest = await getImportJob(activeJobId)
        if (cancelled) return
        setError(null)
        setJob(latest)
        if (latest.status === "completed" && refreshedJobRef.current !== latest.id) {
          refreshedJobRef.current = latest.id
          setSongs(null)
        }
        if (["queued", "downloading", "verifying", "publishing"].includes(latest.status)) {
          timer = setTimeout(() => void poll(), 900)
        }
      } catch (reason) {
        if (!cancelled) {
          if (reason instanceof ImportApiError && reason.status === 404) {
            clearJob()
            setError("The server no longer has this import job.")
            return
          }
          setError(reason instanceof Error ? reason.message : "Could not read import status")
          timer = setTimeout(() => void poll(), 2_000)
        }
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [activeJobId, clearJob, setJob, setSongs])

  const inspectUrl = useCallback(async (target: string) => {
    setBusy("inspect")
    setError(null)
    setInspection(null)
    try {
      const next = await inspectImport(target)
      setInspection(next)
      setForm({
        title: next.title,
        artist: next.artist ?? "",
        album: next.album ?? "",
        formatId: next.recommendedFormatId ?? next.compatibleFormats[0]?.formatId ?? "",
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not inspect that URL")
    } finally {
      setBusy(null)
    }
  }, [])

  const inspect = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void inspectUrl(url)
  }, [inspectUrl, url])

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  const useSourceVideo = useCallback((video: SourceVideo) => {
    setSearchOpen(false)
    setUrl(video.url)
    void inspectUrl(video.url)
  }, [inspectUrl])

  const confirmImport = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inspection || !form.formatId) return
    setBusy("create")
    setError(null)
    try {
      const created = await createImportJob({
        url: inspection.webpageUrl,
        title: form.title.trim(),
        artist: form.artist.trim(),
        album: form.album.trim() || null,
        formatId: form.formatId,
      })
      setJob(created)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the import")
    } finally {
      setBusy(null)
    }
  }, [form, inspection, setJob])

  const retry = useCallback(async () => {
    if (!job) return
    setBusy("retry")
    setError(null)
    try {
      setJob(await retryImportJob(job.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not retry the import")
    } finally {
      setBusy(null)
    }
  }, [job, setJob])

  const newImport = useCallback(() => {
    clearJob()
    setInspection(null)
    setError(null)
    setUrl("")
    setForm({ title: "", artist: "", album: "", formatId: "" })
  }, [clearJob])

  if (job) {
    return (
      <section className="import-panel" aria-labelledby="import-heading" aria-busy={active}>
        <div className="panel-topline">
          <div>
            <span className="eyebrow">IMPORT</span>
            <h1 id="import-heading" className="panel-heading">{statusLabel(job.status)}.</h1>
          </div>
          <span className={cn("import-status-chip", job.status === "failed" && "import-status-chip-error")}>
            {job.status === "completed" ? <Check aria-hidden="true" /> : job.status === "failed" ? <AlertTriangle aria-hidden="true" /> : <LoaderCircle className="import-spin" aria-hidden="true" />}
            {job.status}
          </span>
        </div>

        <div className="import-job-body" aria-live="polite">
          <p className="import-job-title">{job.title}</p>
          <p className="import-job-artist">{job.artist}</p>
          {active ? (
            <>
              <div className="import-progress-track" aria-label={`${Math.round(job.progress)} percent complete`}>
                <span style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
              </div>
              <p className="import-job-message">{statusLabel(job.status)} · {Math.round(job.progress)}%</p>
              {error && <p className="status-error" role="alert">{error}</p>}
              <p className="import-lock-note">Keep this tab open while the server checks and publishes the audio.</p>
            </>
          ) : job.status === "completed" ? (
            <>
              <p className="import-success-message">Native AAC-LC M4A verified and added to Songs.</p>
              <p className="import-job-spec">{job.sampleRateHz ? `${job.sampleRateHz} Hz` : ""}{job.channels ? ` · ${job.channels} ch` : ""}{job.bitrateBitsPerSecond ? ` · ${Math.round(job.bitrateBitsPerSecond / 1000)} kbps` : ""}{job.bytes ? ` · ${formatSize(job.bytes)}` : ""}</p>
            </>
          ) : (
            <>
              <p className="status-error">{job.errorMessage ?? error ?? "The import did not complete."}</p>
              <Button variant="outline" onClick={() => void retry()} disabled={busy !== null}>
                {busy === "retry" ? <LoaderCircle className="import-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                Retry from beginning
              </Button>
            </>
          )}
        </div>
        {!active && (
          <Button className="button-yellow" onClick={newImport}>
            <Download aria-hidden="true" />
            Import another song
          </Button>
        )}
      </section>
    )
  }

  return (
    <section className="import-panel" aria-labelledby="import-heading" aria-busy={busy === "inspect" || busy === "create"}>
      <div className="panel-topline">
        <div>
          <span className="eyebrow">IMPORT · NATIVE AUDIO</span>
          <h1 id="import-heading" className="panel-heading">Bring in a song.</h1>
        </div>
        <span className="panel-meta">AAC-LC / M4A only</span>
      </div>

      {!inspection ? (
        <form className="import-url-form" onSubmit={inspect}>
          <label htmlFor="youtube-url">YouTube video URL</label>
          <div className="import-url-row">
            <input
              id="youtube-url"
              type="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setInspection(null)
                setError(null)
              }}
              placeholder="https://youtube.com/watch?v=…"
              autoComplete="off"
              required
            />
            <Button type="submit" className="button-yellow" disabled={busy !== null || !url.trim()}>
              {busy === "inspect" ? <LoaderCircle className="import-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
              Inspect
            </Button>
          </div>
          <Button type="button" variant="outline" className="import-find-button" onClick={() => setSearchOpen(true)} disabled={busy !== null}>
            <MonitorPlay aria-hidden="true" />
            Find on YouTube
          </Button>
        </form>
      ) : null}

      {error && <p className="status-error import-error" role="alert">{error}</p>}

      {inspection && (
        <form className="import-confirm-form" onSubmit={(event) => void confirmImport(event)}>
          <div className="import-source-card">
            <div className="import-source-copy">
              <span className="eyebrow">FOUND</span>
              <strong>{inspection.title}</strong>
              <span>{inspection.artist ?? "Artist not supplied"}{inspection.duration ? ` · ${Math.round(inspection.duration / 60)} min` : ""}</span>
            </div>
            <div className="import-source-actions">
              <span className={cn("import-compatibility", inspection.hasCompatible ? "import-compatible" : "import-incompatible")}>
                {inspection.hasCompatible ? "Native AAC-LC found" : "No compatible audio"}
              </span>
              <Button
                type="button"
                variant="outline"
                className="import-change-url"
                onClick={() => {
                  setInspection(null)
                  setError(null)
                }}
              >
                Change URL
              </Button>
            </div>
          </div>

          <div className="import-fields">
            <label>
              Title
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={500} required />
            </label>
            <label>
              Artist
              <input value={form.artist} onChange={(event) => setForm((current) => ({ ...current, artist: event.target.value }))} maxLength={500} required />
            </label>
            <label>
              Album <span className="import-optional">OPTIONAL</span>
              <input value={form.album} onChange={(event) => setForm((current) => ({ ...current, album: event.target.value }))} maxLength={500} />
            </label>
            <div className="import-format-fact">
              <span>Audio stream</span>
              <strong>{inspection.compatibleFormats.find((format) => format.formatId === form.formatId)?.ext.toUpperCase() ?? "M4A"} · AAC-LC</strong>
              <small>{formatRate(inspection.compatibleFormats.find((format) => format.formatId === form.formatId)?.abr ?? null)} · {inspection.compatibleFormats.find((format) => format.formatId === form.formatId)?.asr ?? "?"} Hz · {inspection.compatibleFormats.find((format) => format.formatId === form.formatId)?.audioChannels ?? "?"} ch</small>
            </div>
          </div>

          <p className="import-policy-note">{inspection.policyMessage} The server measures the published file before it appears in Songs.</p>
          <Button type="submit" className="button-yellow import-confirm" disabled={busy !== null || !inspection.hasCompatible || !form.title.trim() || !form.artist.trim()}>
            {busy === "create" ? <LoaderCircle className="import-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Confirm and download
          </Button>
        </form>
      )}

      <SourceVideoSearch open={searchOpen} onClose={closeSearch} onUse={useSourceVideo} />
    </section>
  )
}
