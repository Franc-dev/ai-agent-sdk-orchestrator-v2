import { EventEmitter } from "eventemitter3"
import { Logger } from "./logger"
import { MetricsCollector } from "./metrics"
import { Tracer } from "./tracer"

export interface MonitorConfig {
  enableMetrics?: boolean
  enableTracing?: boolean
  enableLogging?: boolean
  alertThresholds?: {
    errorRate?: number
    responseTime?: number
    memoryUsage?: number
  }
}

export interface Alert {
  id: string
  type: "error_rate" | "response_time" | "memory_usage" | "custom"
  message: string
  severity: "low" | "medium" | "high" | "critical"
  timestamp: Date
  metadata?: Record<string, any>
}

export class Monitor extends EventEmitter {
  private config: Required<MonitorConfig>
  private logger: Logger
  private metrics: MetricsCollector
  private tracer: Tracer
  private alerts: Alert[] = []
  private checkInterval: NodeJS.Timeout | null = null

  constructor(config: MonitorConfig = {}) {
    super()

    this.config = {
      enableMetrics: config.enableMetrics ?? true,
      enableTracing: config.enableTracing ?? true,
      enableLogging: config.enableLogging ?? true,
      alertThresholds: {
        errorRate: config.alertThresholds?.errorRate ?? 0.05, // 5%
        responseTime: config.alertThresholds?.responseTime ?? 5000, // 5s
        memoryUsage: config.alertThresholds?.memoryUsage ?? 0.8, // 80%
        ...config.alertThresholds,
      },
    }

    this.logger = new Logger({ level: "info" })
    this.metrics = new MetricsCollector()
    this.tracer = new Tracer()

    this.startMonitoring()
  }

  // Component access
  getLogger(): Logger {
    return this.logger
  }

  getMetrics(): MetricsCollector {
    return this.metrics
  }

  getTracer(): Tracer {
    return this.tracer
  }

  // Monitoring methods
  private startMonitoring(): void {
    this.checkInterval = setInterval(() => {
      this.checkAlerts()
    }, 30000) // Check every 30 seconds
  }

  private checkAlerts(): void {
    if (this.config.enableMetrics) {
      this.checkErrorRate()
      this.checkResponseTime()
      this.checkMemoryUsage()
    }
  }

  private checkErrorRate(): void {
    const errorCount = this.metrics.getCounter("errors")
    const totalCount = this.metrics.getCounter("requests")

    if (totalCount > 0) {
      const errorRate = errorCount / totalCount
      if (errorRate > this.config.alertThresholds.errorRate) {
        this.createAlert({
          type: "error_rate",
          message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          severity: errorRate > 0.1 ? "critical" : "high",
          metadata: { errorRate, errorCount, totalCount },
        })
      }
    }
  }

  private checkResponseTime(): void {
    const responseTimeSummary = this.metrics.getSummary("response_time")
    if (responseTimeSummary && responseTimeSummary.p95 > this.config.alertThresholds.responseTime) {
      this.createAlert({
        type: "response_time",
        message: `High response time detected: P95 ${responseTimeSummary.p95}ms`,
        severity: responseTimeSummary.p95 > 10000 ? "critical" : "high",
        metadata: responseTimeSummary,
      })
    }
  }

  private checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage()
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024
    const usageRatio = heapUsedMB / heapTotalMB

    if (usageRatio > this.config.alertThresholds.memoryUsage) {
      this.createAlert({
        type: "memory_usage",
        message: `High memory usage: ${(usageRatio * 100).toFixed(1)}% (${heapUsedMB.toFixed(1)}MB)`,
        severity: usageRatio > 0.9 ? "critical" : "high",
        metadata: { heapUsedMB, heapTotalMB, usageRatio },
      })
    }
  }

  private createAlert(alert: Omit<Alert, "id" | "timestamp">): void {
    const fullAlert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alert,
    }

    this.alerts.push(fullAlert)
    this.logger.warn(`Alert created: ${fullAlert.message}`, {
      alertId: fullAlert.id,
      type: fullAlert.type,
      severity: fullAlert.severity,
    })

    this.emit("alert", fullAlert)
  }

  // Public methods
  recordRequest(duration: number, success: boolean): void {
    if (!this.config.enableMetrics) return

    this.metrics.incrementCounter("requests")
    this.metrics.recordTimer("response_time", duration)

    if (!success) {
      this.metrics.incrementCounter("errors")
    }
  }

  recordAgentExecution(agentId: string, duration: number, tokens?: number, success = true): void {
    if (!this.config.enableMetrics) return

    this.metrics.incrementCounter("agent_executions", 1, { agentId })
    this.metrics.recordTimer("agent_duration", duration, { agentId })

    if (tokens) {
      this.metrics.recordHistogram("token_usage", tokens, { agentId })
    }

    if (!success) {
      this.metrics.incrementCounter("agent_errors", 1, { agentId })
    }
  }

  recordWorkflowExecution(workflowId: string, duration: number, stepCount: number, success = true): void {
    if (!this.config.enableMetrics) return

    this.metrics.incrementCounter("workflow_executions", 1, { workflowId })
    this.metrics.recordTimer("workflow_duration", duration, { workflowId })
    this.metrics.recordHistogram("workflow_steps", stepCount, { workflowId })

    if (!success) {
      this.metrics.incrementCounter("workflow_errors", 1, { workflowId })
    }
  }

  // Query methods
  getAlerts(filter?: {
    type?: Alert["type"]
    severity?: Alert["severity"]
    since?: Date
  }): Alert[] {
    let filtered = [...this.alerts]

    if (filter?.type) {
      filtered = filtered.filter((alert) => alert.type === filter.type)
    }

    if (filter?.severity) {
      filtered = filtered.filter((alert) => alert.severity === filter.severity)
    }

    if (filter?.since) {
      filtered = filtered.filter((alert) => alert.timestamp >= filter.since!)
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy"
    checks: Record<string, boolean>
    metrics: Record<string, any>
    uptime: number
  } {
    const checks = {
      errorRate: this.checkErrorRateHealth(),
      responseTime: this.checkResponseTimeHealth(),
      memoryUsage: this.checkMemoryHealth(),
    }

    const failedChecks = Object.values(checks).filter((check) => !check).length
    const status = failedChecks === 0 ? "healthy" : failedChecks === 1 ? "degraded" : "unhealthy"

    return {
      status,
      checks,
      metrics: this.metrics.export(),
      uptime: process.uptime(),
    }
  }

  private checkErrorRateHealth(): boolean {
    const errorCount = this.metrics.getCounter("errors")
    const totalCount = this.metrics.getCounter("requests")
    if (totalCount === 0) return true
    return errorCount / totalCount <= this.config.alertThresholds.errorRate
  }

  private checkResponseTimeHealth(): boolean {
    const summary = this.metrics.getSummary("response_time")
    return !summary || summary.p95 <= this.config.alertThresholds.responseTime
  }

  private checkMemoryHealth(): boolean {
    const memoryUsage = process.memoryUsage()
    const usageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal
    return usageRatio <= this.config.alertThresholds.memoryUsage
  }

  // Lifecycle methods
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    this.logger.info("Monitor shutdown complete")
  }
}
