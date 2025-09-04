export interface Metric {
  name: string
  value: number
  timestamp: Date
  tags?: Record<string, string>
  type: "counter" | "gauge" | "histogram" | "timer"
}

export interface MetricSummary {
  name: string
  count: number
  sum: number
  min: number
  max: number
  avg: number
  p50?: number
  p95?: number
  p99?: number
}

export class MetricsCollector {
  private metrics: Metric[] = []
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private histograms = new Map<string, number[]>()
  private timers = new Map<string, number[]>()
  private maxMetrics = 100000

  // Counter methods
  incrementCounter(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    const currentValue = this.counters.get(key) || 0
    this.counters.set(key, currentValue + value)

    this.addMetric({
      name,
      value: currentValue + value,
      timestamp: new Date(),
      tags,
      type: "counter",
    })
  }

  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.getMetricKey(name, tags)
    return this.counters.get(key) || 0
  }

  // Gauge methods
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    this.gauges.set(key, value)

    this.addMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: "gauge",
    })
  }

  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.getMetricKey(name, tags)
    return this.gauges.get(key)
  }

  // Histogram methods
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    const values = this.histograms.get(key) || []
    values.push(value)
    this.histograms.set(key, values)

    this.addMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: "histogram",
    })
  }

  // Timer methods
  startTimer(name: string, tags?: Record<string, string>): () => void {
    const startTime = Date.now()
    return () => {
      const duration = Date.now() - startTime
      this.recordTimer(name, duration, tags)
    }
  }

  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    const values = this.timers.get(key) || []
    values.push(duration)
    this.timers.set(key, values)

    this.addMetric({
      name,
      value: duration,
      timestamp: new Date(),
      tags,
      type: "timer",
    })
  }

  async timeAsync<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const stopTimer = this.startTimer(name, tags)
    try {
      return await fn()
    } finally {
      stopTimer()
    }
  }

  // Utility methods
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name
    }
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",")
    return `${name}{${tagStr}}`
  }

  private addMetric(metric: Metric): void {
    this.metrics.push(metric)

    // Maintain max metrics limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  // Query methods
  getMetrics(filter?: {
    name?: string
    type?: Metric["type"]
    since?: Date
    tags?: Record<string, string>
  }): Metric[] {
    let filtered = [...this.metrics]

    if (filter?.name) {
      filtered = filtered.filter((m) => m.name === filter.name)
    }

    if (filter?.type) {
      filtered = filtered.filter((m) => m.type === filter.type)
    }

    if (filter?.since) {
      filtered = filtered.filter((m) => m.timestamp >= filter.since!)
    }

    if (filter?.tags) {
      filtered = filtered.filter((m) => {
        if (!m.tags) return false
        return Object.entries(filter.tags!).every(([k, v]) => m.tags![k] === v)
      })
    }

    return filtered
  }

  getSummary(name: string, tags?: Record<string, string>): MetricSummary | undefined {
    const metrics = this.getMetrics({ name, tags })
    if (metrics.length === 0) return undefined

    const values = metrics.map((m) => m.value).sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      name,
      count: values.length,
      sum,
      min: values[0]!,
      max: values[values.length - 1]!,
      avg: sum / values.length,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    }
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0
    const index = Math.ceil(sortedValues.length * p) - 1
    return sortedValues[Math.max(0, index)]!
  }

  // Export methods
  export(): {
    counters: Record<string, number>
    gauges: Record<string, number>
    histograms: Record<string, MetricSummary>
    timers: Record<string, MetricSummary>
  } {
    const histograms: Record<string, MetricSummary> = {}
    const timers: Record<string, MetricSummary> = {}

    // Process histograms
    for (const [key, values] of this.histograms.entries()) {
      const sorted = [...values].sort((a, b) => a - b)
      const sum = sorted.reduce((a, b) => a + b, 0)
      histograms[key] = {
        name: key,
        count: sorted.length,
        sum,
        min: sorted[0]!,
        max: sorted[sorted.length - 1]!,
        avg: sum / sorted.length,
        p50: this.percentile(sorted, 0.5),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99),
      }
    }

    // Process timers
    for (const [key, values] of this.timers.entries()) {
      const sorted = [...values].sort((a, b) => a - b)
      const sum = sorted.reduce((a, b) => a + b, 0)
      timers[key] = {
        name: key,
        count: sorted.length,
        sum,
        min: sorted[0]!,
        max: sorted[sorted.length - 1]!,
        avg: sum / sorted.length,
        p50: this.percentile(sorted, 0.5),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99),
      }
    }

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms,
      timers,
    }
  }

  clear(): void {
    this.metrics = []
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this.timers.clear()
  }
}
