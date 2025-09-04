import { BasePlugin, Plugin, type PluginConfig } from "../base"
import type { AgentOrchestrator } from "../../core/orchestrator"
import type { ExecutionContext } from "../../types"

interface RateLimiterConfig extends PluginConfig {
  options?: {
    requestsPerMinute?: number
    requestsPerHour?: number
    burstLimit?: number
    keyGenerator?: (agentId: string, context: ExecutionContext) => string
  }
}

interface RateLimitEntry {
  count: number
  resetTime: number
  burstCount: number
  burstResetTime: number
}

@Plugin({
  name: "rate-limiter",
  version: "1.0.0",
  description: "Rate limits agent executions to prevent API abuse",
  author: "AI Agent SDK",
})
export class RateLimiterPlugin extends BasePlugin {
  private limits = new Map<string, RateLimitEntry>()
  private requestsPerMinute: number
  private requestsPerHour: number
  private burstLimit: number
  private keyGenerator: (agentId: string, context: ExecutionContext) => string

  constructor(config: RateLimiterConfig = {}) {
    const meta = (RateLimiterPlugin as any).metadata || { name: "rate-limiter", version: "1.0.0" }
    super(meta, config)

    this.requestsPerMinute = this.getOption("requestsPerMinute", 60)
    this.requestsPerHour = this.getOption("requestsPerHour", 1000)
    this.burstLimit = this.getOption("burstLimit", 10)
    this.keyGenerator = this.getOption("keyGenerator", this.defaultKeyGenerator)
  }

  async initialize(orchestrator: AgentOrchestrator): Promise<void> {
    this.orchestrator = orchestrator

    // Cleanup expired entries every minute
    setInterval(() => this.pruneExpired(), 60000)
  }

  async beforeAgentExecution(
    agentId: string,
    prompt: string,
    context: ExecutionContext,
  ): Promise<{ agentId: string; prompt: string; context: ExecutionContext }> {
    const key = this.keyGenerator(agentId, context)

    if (!this.checkRateLimit(key)) {
      throw new Error(`Rate limit exceeded for ${key}`)
    }

    this.recordRequest(key)
    return { agentId, prompt, context }
  }

  private defaultKeyGenerator(agentId: string, context: ExecutionContext): string {
    // Rate limit by agent and user (if available)
    const userId = context.metadata?.userId || "anonymous"
    return `${agentId}:${userId}`
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(key) || this.createEntry(now)

    // Check burst limit (per minute)
    if (now < entry.burstResetTime) {
      if (entry.burstCount >= this.burstLimit) {
        return false
      }
    } else {
      // Reset burst counter
      entry.burstCount = 0
      entry.burstResetTime = now + 60000 // 1 minute
    }

    // Check hourly limit
    if (now < entry.resetTime) {
      if (entry.count >= this.requestsPerHour) {
        return false
      }
    } else {
      // Reset hourly counter
      entry.count = 0
      entry.resetTime = now + 3600000 // 1 hour
    }

    return true
  }

  private recordRequest(key: string): void {
    const now = Date.now()
    const entry = this.limits.get(key) || this.createEntry(now)

    entry.count++
    entry.burstCount++

    this.limits.set(key, entry)
  }

  private createEntry(now: number): RateLimitEntry {
    return {
      count: 0,
      resetTime: now + 3600000, // 1 hour
      burstCount: 0,
      burstResetTime: now + 60000, // 1 minute
    }
  }

  private pruneExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      // Remove entries that are past both reset times
      if (now > entry.resetTime && now > entry.burstResetTime) {
        this.limits.delete(key)
      }
    }
  }

  // Public methods
  getRemainingRequests(key: string): { hourly: number; burst: number } {
    const entry = this.limits.get(key)
    if (!entry) {
      return {
        hourly: this.requestsPerHour,
        burst: this.burstLimit,
      }
    }

    const now = Date.now()
    return {
      hourly: now > entry.resetTime ? this.requestsPerHour : this.requestsPerHour - entry.count,
      burst: now > entry.burstResetTime ? this.burstLimit : this.burstLimit - entry.burstCount,
    }
  }

  getStats(): { totalKeys: number; activeKeys: number } {
    const now = Date.now()
    let activeKeys = 0

    for (const entry of this.limits.values()) {
      if (now < entry.resetTime || now < entry.burstResetTime) {
        activeKeys++
      }
    }

    return {
      totalKeys: this.limits.size,
      activeKeys,
    }
  }

  override async cleanup(): Promise<void> {
    this.limits.clear()
  }
}
