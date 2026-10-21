import type {
  CreateImportRequest,
  ImportInspection,
  ImportJob,
  ImportErrorBody,
  SourceVideo,
  SourceVideoSearchResponse,
} from "keystack-shared"

const API_BASE = (process.env.NEXT_PUBLIC_SONGS_API_BASE_URL ?? "").replace(/\/+$/, "")

export class ImportApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "ImportApiError"
  }
}

function importUrl(path: string) {
  return `${API_BASE}${path}`
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(importUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      mode: "cors",
    })
  } catch {
    throw new ImportApiError(0, "NETWORK_ERROR", "Could not reach the song server")
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // The error below gives the same stable shape for non-JSON responses.
  }
  if (!response.ok) {
    const detail = body as Partial<ImportErrorBody> | null
    const code = typeof detail?.error?.code === "string" ? detail.error.code : `HTTP_${response.status}`
    const message = typeof detail?.error?.message === "string" ? detail.error.message : "Import request failed"
    throw new ImportApiError(response.status, code, message)
  }
  if (body === null) throw new ImportApiError(response.status, "INVALID_JSON", "Invalid server response")
  return body as T
}

export async function inspectImport(url: string, signal?: AbortSignal): Promise<ImportInspection> {
  return requestJson<ImportInspection>("/api/v1/import/inspect", {
    method: "POST",
    body: JSON.stringify({ url }),
    signal,
  })
}

export async function searchSourceVideos(query: string, signal?: AbortSignal): Promise<SourceVideo[]> {
  const params = new URLSearchParams({ q: query })
  const body = await requestJson<SourceVideoSearchResponse>(`/api/v1/import/search?${params}`, { signal })
  return body.sourceVideos
}

export async function createImportJob(request: CreateImportRequest): Promise<ImportJob> {
  return requestJson<ImportJob>("/api/v1/import/jobs", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

export async function getImportJob(id: string, signal?: AbortSignal): Promise<ImportJob> {
  return requestJson<ImportJob>(`/api/v1/import/jobs/${encodeURIComponent(id)}`, { signal })
}

export async function retryImportJob(id: string): Promise<ImportJob> {
  return requestJson<ImportJob>(`/api/v1/import/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" })
}
