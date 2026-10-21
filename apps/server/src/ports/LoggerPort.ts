export interface LoggerPort {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

// journald timestamps every line, so no timestamp here.
export const consoleLogger: LoggerPort = {
  info: (message) => console.log(`[info] ${message}`),
  warn: (message) => console.warn(`[warn] ${message}`),
  error: (message) => console.error(`[error] ${message}`),
}
