import type { StructuredLogEntry } from "./logger"
import type { Metric } from "./metrics"
import type { Span } from "./tracer"

export interface ExportConfig {
  format: "json" | "prometheus" | "jaeger" | "csv"
  destination?: "console" | "file" | "http"
  endpoint?: string
  apiKey?: string
  batchSize?: number
  flushInterval?: number
}

export abstract class BaseExporter {
  protected config: ExportConfig

  constructor(config: ExportConfig) {
    this.config = config
  }

  abstract exportLogs(logs: StructuredLogEntry[]): Promise<void>
  abstract exportMetrics(metrics: Metric[]): Promise<void>
  abstract exportTraces(spans: Span[]): Promise<void>
}

export class ConsoleExporter extends BaseExporter {
  async exportLogs(logs: StructuredLogEntry[]): Promise<void> {
    console.log("=== LOGS ===")
    logs.forEach((log) => {
      console.log(`[${log.timestamp.toISOString()}] ${log.level.toUpperCase()}: ${log.message}`)
      if (log.context) {
        console.log("  Context:", JSON.stringify(log.context, null, 2))
      }
    })
  }

  async exportMetrics(metrics: Metric[]): Promise<void> {
    console.log("=== METRICS ===")
    const grouped = this.groupMetricsByName(metrics)

    Object.entries(grouped).forEach(([name, metricList]) => {
      console.log(`${name}:`)
      metricList.forEach((metric) => {
        const tagsStr = metric.tags
          ? ` {${Object.entries(metric.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join(",")}}`
          : ""
        console.log(`  ${metric.value}${tagsStr} @ ${metric.timestamp.toISOString()}`)
      })
    })
  }

  async exportTraces(spans: Span[]): Promise<void> {
    console.log("=== TRACES ===")
    const traces = this.groupSpansByTrace(spans)

    Object.entries(traces).forEach(([traceId, spanList]) => {
      console.log(`Trace ${traceId}:`)
      spanList.forEach((span) => {
        const indent = "  ".repeat((span.parentSpanId ? 1 : 0) + 1)
        const duration = span.duration ? `${span.duration}ms` : "pending"
        console.log(`${indent}${span.operationName} (${duration}) [${span.status}]`)
      })
    })
  }

  private groupMetricsByName(metrics: Metric[]): Record<string, Metric[]> {
    const out: Record<string, Metric[]> = {}
    for (const metric of metrics) {
      if (!out[metric.name]) out[metric.name] = []
      out[metric.name]!.push(metric)
    }
    return out
  }

  private groupSpansByTrace(spans: Span[]): Record<string, Span[]> {
    const out: Record<string, Span[]> = {}
    for (const span of spans) {
      if (!out[span.traceId]) out[span.traceId] = []
      out[span.traceId]!.push(span)
    }
    return out
  }
}

export class PrometheusExporter extends BaseExporter {
  async exportLogs(logs: StructuredLogEntry[]): Promise<void> {
    // Prometheus doesn't handle logs directly, convert to metrics
    const logCounts: Record<string, number> = {}

    logs.forEach((log) => {
      const key = `log_entries_total{level="${log.level}"}`
      logCounts[key] = (logCounts[key] || 0) + 1
    })

    console.log("# Prometheus Log Metrics")
    Object.entries(logCounts).forEach(([metric, value]) => {
      console.log(`${metric} ${value}`)
    })
  }

  async exportMetrics(metrics: Metric[]): Promise<void> {
    console.log("# Prometheus Metrics")

    const grouped = metrics.reduce(
      (acc, metric) => {
        const key = `${metric.name}_${metric.type}`
        if (!acc[key]) acc[key] = []
        acc[key]!.push(metric)
        return acc
      },
      {} as Record<string, Metric[]>,
    )

    Object.entries(grouped).forEach(([key, metricList]) => {
      const [name, type] = key.split("_")
      console.log(`# TYPE ${name} ${type}`)

      metricList!.forEach((metric) => {
        const tagsStr = metric.tags
          ? `{${Object.entries(metric.tags)
              .map(([k, v]) => `${k}="${v}"`)
              .join(",")}}`
          : ""
        console.log(`${name}${tagsStr} ${metric.value}`)
      })
    })
  }

  async exportTraces(spans: Span[]): Promise<void> {
    // Convert traces to metrics for Prometheus
    const traceCounts: Record<string, number> = {}
    const traceDurations: Record<string, number[]> = {}

    spans.forEach((span) => {
      const operation = span.operationName.replace(/[^a-zA-Z0-9_]/g, "_")
      const countKey = `trace_spans_total{operation="${operation}",status="${span.status}"}`
      traceCounts[countKey] = (traceCounts[countKey] || 0) + 1

      if (span.duration) {
        const durationKey = `trace_duration_seconds{operation="${operation}"}`
        if (!traceDurations[durationKey]) traceDurations[durationKey] = []
        traceDurations[durationKey].push(span.duration / 1000) // Convert to seconds
      }
    })

    console.log("# Prometheus Trace Metrics")
    Object.entries(traceCounts).forEach(([metric, value]) => {
      console.log(`${metric} ${value}`)
    })

    Object.entries(traceDurations).forEach(([key, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      console.log(`${key} ${avg}`)
    })
  }
}

export class FileExporter extends BaseExporter {
  private fs = require("fs")
  private path = require("path")

  async exportLogs(logs: StructuredLogEntry[]): Promise<void> {
    const filename = `logs_${new Date().toISOString().split("T")[0]}.json`
    const filepath = this.path.join(process.cwd(), "exports", filename)

    await this.ensureDirectory(this.path.dirname(filepath))
    await this.fs.promises.writeFile(filepath, JSON.stringify(logs, null, 2))
    console.log(`Logs exported to ${filepath}`)
  }

  async exportMetrics(metrics: Metric[]): Promise<void> {
    const filename = `metrics_${new Date().toISOString().split("T")[0]}.json`
    const filepath = this.path.join(process.cwd(), "exports", filename)

    await this.ensureDirectory(this.path.dirname(filepath))
    await this.fs.promises.writeFile(filepath, JSON.stringify(metrics, null, 2))
    console.log(`Metrics exported to ${filepath}`)
  }

  async exportTraces(spans: Span[]): Promise<void> {
    const filename = `traces_${new Date().toISOString().split("T")[0]}.json`
    const filepath = this.path.join(process.cwd(), "exports", filename)

    await this.ensureDirectory(this.path.dirname(filepath))
    await this.fs.promises.writeFile(filepath, JSON.stringify(spans, null, 2))
    console.log(`Traces exported to ${filepath}`)
  }

  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await this.fs.promises.access(dir)
    } catch {
      await this.fs.promises.mkdir(dir, { recursive: true })
    }
  }
}

export class ExporterFactory {
  static create(config: ExportConfig): BaseExporter {
    switch (config.destination) {
      case "console":
        return config.format === "prometheus" ? new PrometheusExporter(config) : new ConsoleExporter(config)
      case "file":
        return new FileExporter(config)
      default:
        return new ConsoleExporter(config)
    }
  }
}
