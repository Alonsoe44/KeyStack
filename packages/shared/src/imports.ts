export type ImportJobStatus =
  | "queued"
  | "downloading"
  | "verifying"
  | "publishing"
  | "completed"
  | "failed"

export type ImportFormat = {
  formatId: string
  ext: string
  acodec: string
  vcodec: string
  abr: number | null
  asr: number | null
  audioChannels: number | null
  filesize: number | null
  protocol: string | null
  compatible: boolean
  rejectionReason: string | null
}

export type ImportInspection = {
  id: string
  title: string
  artist: string | null
  album: string | null
  duration: number | null
  thumbnail: string | null
  webpageUrl: string
  formats: ImportFormat[]
  compatibleFormats: ImportFormat[]
  recommendedFormatId: string | null
  hasCompatible: boolean
  policyMessage: string
}

/** A YouTube video found by search that can be imported to create a Song. */
export type SourceVideo = {
  id: string
  /** Canonical watch URL, accepted by POST /api/v1/import/inspect. */
  url: string
  title: string
  channel: string | null
  durationSeconds: number | null
  thumbnailUrl: string
}

export type SourceVideoSearchResponse = {
  sourceVideos: SourceVideo[]
}

export type ImportJob = {
  id: string
  title: string
  artist: string
  album: string | null
  formatId: string
  status: ImportJobStatus
  progress: number
  errorCode: string | null
  errorMessage: string | null
  songId: string | null
  sourceVideoId: string | null
  sourceTitle: string | null
  sourceArtist: string | null
  measuredDuration: number | null
  sampleRateHz: number | null
  channels: number | null
  bitrateBitsPerSecond: number | null
  bytes: number | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}

export type CreateImportRequest = {
  url: string
  title: string
  artist: string
  album: string | null
  formatId: string
}

export type ImportErrorBody = {
  error: { code: string; message: string }
}
