import { randomBytes } from "crypto"

export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  operationName: string
  startTime: Date
  endTime?: Date
  duration?: number
  tags: Record<string, string>
  logs: Array<{ timestamp: Date; message: string; level?: string }>
  status: "pending" | "success" | "error"
  error?: Error
}

export class Tracer {
  private spans = new Map<string, Span>()
  private activeSpans = new Map<string, string>() // traceId -> spanId
  private maxSpans = 10000

  startSpan(
    operationName: string,
    options: {
      traceId?: string
      parentSpanId?: string
      tags?: Record<string, string>
    } = {},
  ): Span {
    const traceId = options.traceId || this.generateId()
    const spanId = this.generateId()

    const span: Span = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      operationName,
      startTime: new Date(),
      tags: options.tags || {},
      logs: [],
      status: "pending",
    }

    this.spans.set(spanId, span)
    this.activeSpans.set(traceId, spanId)

    // Maintain max spans limit
    if (this.spans.size > this.maxSpans) {
      const oldestSpanId = this.spans.keys().next().value as string | undefined
      if (oldestSpanId !== undefined) {
        this.spans.delete(oldestSpanId)
      }
    }

    return span
  }

  finishSpan(spanId: string, error?: Error): void {
    const span = this.spans.get(spanId)
    if (!span) return

    span.endTime = new Date()
    span.duration = span.endTime.getTime() - span.startTime.getTime()
    span.status = error ? "error" : "success"
    span.error = error

    // Remove from active spans
    this.activeSpans.delete(span.traceId)
  }

  getActiveSpan(traceId: string): Span | undefined {
    const spanId = this.activeSpans.get(traceId)
    return spanId ? this.spans.get(spanId) : undefined
  }

  addSpanTag(spanId: string, key: string, value: string): void {
    const span = this.spans.get(spanId)
    if (span) {
      span.tags[key] = value
    }
  }

  addSpanLog(spanId: string, message: string, level = "info"): void {
    const span = this.spans.get(spanId)
    if (span) {
      span.logs.push({
        timestamp: new Date(),
        message,
        level,
      })
    }
  }

  async traceAsync<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    options: {
      traceId?: string
      parentSpanId?: string
      tags?: Record<string, string>
    } = {},
  ): Promise<T> {
    const span = this.startSpan(operationName, options)

    try {
      const result = await fn(span)
      this.finishSpan(span.spanId)
      return result
    } catch (error) {
      this.finishSpan(span.spanId, error as Error)
      throw error
    }
  }

  // Query methods
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId)
  }

  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter((span) => span.traceId === traceId)
  }

  getSpans(filter?: {
    traceId?: string
    operationName?: string
    status?: Span["status"]
    since?: Date
  }): Span[] {
    let filtered = Array.from(this.spans.values())

    if (filter?.traceId) {
      filtered = filtered.filter((span) => span.traceId === filter.traceId)
    }

    if (filter?.operationName) {
      filtered = filtered.filter((span) => span.operationName === filter.operationName)
    }

    if (filter?.status) {
      filtered = filtered.filter((span) => span.status === filter.status)
    }

    if (filter?.since) {
      filtered = filtered.filter((span) => span.startTime >= filter.since!)
    }

    return filtered
  }

  // Utility methods
  private generateId(): string {
    return randomBytes(8).toString("hex")
  }

  // Export methods
  export(): Span[] {
    return Array.from(this.spans.values())
  }

  exportTrace(traceId: string): {
    traceId: string
    spans: Span[]
    duration: number
    status: "success" | "error" | "partial"
  } {
    const spans = this.getTrace(traceId)
    if (spans.length === 0) {
      throw new Error(`Trace not found: ${traceId}`)
    }

    const rootSpan = spans.find((s) => !s.parentSpanId)
    const duration = rootSpan?.duration || 0
    const hasErrors = spans.some((s) => s.status === "error")
    const hasPending = spans.some((s) => s.status === "pending")

    return {
      traceId,
      spans: spans.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      duration,
      status: hasErrors ? "error" : hasPending ? "partial" : "success",
    }
  }

  clear(): void {
    this.spans.clear()
    this.activeSpans.clear()
  }
}
