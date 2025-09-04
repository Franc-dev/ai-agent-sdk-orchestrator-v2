import type { LogLevel, LogEntry } from "../types"

export interface LoggerConfig {
  level: LogLevel
  maxEntries?: number
  enableConsole?: boolean
  enableStructured?: boolean
  timestampFormat?: "iso" | "unix" | "relative"
  includeStackTrace?: boolean
  redactSensitive?: boolean
}

export interface StructuredLogEntry extends LogEntry {
  traceId?: string
  spanId?: string
  userId?: string
  sessionId?: string
  tags?: Record<string, string>
  metrics?: Record<string, number>
}

export class Logger {
  private config: Required<LoggerConfig>
  private entries: StructuredLogEntry[] = []
  private sensitiveFields = ["apiKey", "password", "token", "secret", "authorization"]

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || "info",
      maxEntries: config.maxEntries || 10000,
      enableConsole: config.enableConsole ?? true,
      enableStructured: config.enableStructured ?? true,
      timestampFormat: config.timestampFormat || "iso",
      includeStackTrace: config.includeStackTrace ?? false,
      redactSensitive: config.redactSensitive ?? true,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }
    return levels[level] >= levels[this.config.level]
  }

  private formatTimestamp(date: Date): string {
    switch (this.config.timestampFormat) {
      case "unix":
        return date.getTime().toString()
      case "relative":
        return `+${Date.now() - date.getTime()}ms`
      default:
        return date.toISOString()
    }
  }

  private redactSensitiveData(obj: any): any {
    if (!this.config.redactSensitive) return obj
    if (typeof obj !== "object" || obj === null) return obj

    const redacted = Array.isArray(obj) ? [...obj] : { ...obj }

    for (const [key, value] of Object.entries(redacted)) {
      if (this.sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        redacted[key] = "[REDACTED]"
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactSensitiveData(value)
      }
    }

    return redacted
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    metadata?: Partial<StructuredLogEntry>,
  ): void {
    if (!this.shouldLog(level)) return

    const timestamp = new Date()
    const entry: StructuredLogEntry = {
      level,
      message,
      timestamp,
      context: context ? this.redactSensitiveData(context) : undefined,
      ...metadata,
    }

    // Add stack trace for errors
    if (level === "error" && this.config.includeStackTrace) {
      entry.context = {
        ...entry.context,
        stack: new Error().stack,
      }
    }

    this.entries.push(entry)

    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries)
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry)
    }
  }

  private outputToConsole(entry: StructuredLogEntry): void {
    const timestamp = this.formatTimestamp(entry.timestamp)
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
    const traceStr = entry.traceId ? ` [trace:${entry.traceId}]` : ""

    const logMessage = `[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${traceStr}${contextStr}`

    switch (entry.level) {
      case "debug":
        console.debug(logMessage)
        break
      case "info":
        console.info(logMessage)
        break
      case "warn":
        console.warn(logMessage)
        break
      case "error":
        console.error(logMessage)
        break
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>, metadata?: Partial<StructuredLogEntry>): void {
    this.log("debug", message, context, metadata)
  }

  info(message: string, context?: Record<string, any>, metadata?: Partial<StructuredLogEntry>): void {
    this.log("info", message, context, metadata)
  }

  warn(message: string, context?: Record<string, any>, metadata?: Partial<StructuredLogEntry>): void {
    this.log("warn", message, context, metadata)
  }

  error(message: string, context?: Record<string, any>, metadata?: Partial<StructuredLogEntry>): void {
    this.log("error", message, context, metadata)
  }

  // Structured logging with trace context
  withTrace(traceId: string, spanId?: string): Logger {
    const tracedLogger = new Logger(this.config)
    tracedLogger.entries = this.entries

    // Override log method to include trace context
    const originalLog = tracedLogger.log.bind(tracedLogger)
    tracedLogger.log = (level, message, context, metadata) => {
      originalLog(level, message, context, { ...metadata, traceId, spanId })
    }

    return tracedLogger
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  addSensitiveField(field: string): void {
    this.sensitiveFields.push(field)
  }

  // Query and export methods
  getEntries(filter?: {
    level?: LogLevel
    since?: Date
    traceId?: string
    limit?: number
  }): StructuredLogEntry[] {
    let filtered = [...this.entries]

    if (filter?.level) {
      filtered = filtered.filter((entry) => entry.level === filter.level)
    }

    if (filter?.since) {
      filtered = filtered.filter((entry) => entry.timestamp >= filter.since!)
    }

    if (filter?.traceId) {
      filtered = filtered.filter((entry) => entry.traceId === filter.traceId)
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit)
    }

    return filtered
  }

  clear(): void {
    this.entries = []
  }

  export(format: "json" | "csv" | "text" = "json"): string {
    switch (format) {
      case "csv":
        return this.exportToCsv()
      case "text":
        return this.exportToText()
      default:
        return JSON.stringify(this.entries, null, 2)
    }
  }

  private exportToCsv(): string {
    if (this.entries.length === 0) return ""

    const headers = ["timestamp", "level", "message", "traceId", "context"]
    const rows = this.entries.map((entry) => [
      entry.timestamp.toISOString(),
      entry.level,
      entry.message.replace(/"/g, '""'),
      entry.traceId || "",
      entry.context ? JSON.stringify(entry.context).replace(/"/g, '""') : "",
    ])

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
  }

  private exportToText(): string {
    return this.entries
      .map((entry) => {
        const timestamp = this.formatTimestamp(entry.timestamp)
        const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
        const traceStr = entry.traceId ? ` [trace:${entry.traceId}]` : ""
        return `[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${traceStr}${contextStr}`
      })
      .join("\n")
  }

  // Statistics
  getStats(): {
    totalEntries: number
    entriesByLevel: Record<LogLevel, number>
    timeRange: { start?: Date; end?: Date }
    uniqueTraces: number
  } {
    const entriesByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    }

    const traces = new Set<string>()

    this.entries.forEach((entry) => {
      entriesByLevel[entry.level]++
      if (entry.traceId) {
        traces.add(entry.traceId)
      }
    })

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      timeRange: {
        start: this.entries[0]?.timestamp,
        end: this.entries[this.entries.length - 1]?.timestamp,
      },
      uniqueTraces: traces.size,
    }
  }
}
