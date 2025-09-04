import { BasePlugin, Plugin, type PluginConfig } from "../base"
import type { AgentOrchestrator } from "../../core/orchestrator"
import type { ExecutionContext } from "../../types"

interface CacheConfig extends PluginConfig {
  options?: {
    maxSize?: number
    ttlMs?: number
    keyGenerator?: (agentId: string, prompt: string) => string
  }
}

@Plugin({
  name: "cache",
  version: "1.0.0",
  description: "Caches agent responses to improve performance",
  author: "AI Agent SDK",
})
export class CachePlugin extends BasePlugin {
  private cache = new Map<string, { value: any; timestamp: number }>()
  private maxSize: number
  private ttlMs: number
  private keyGenerator: (agentId: string, prompt: string) => string

  constructor(config: CacheConfig = {}) {
    super(CachePlugin.metadata, config)

    this.maxSize = this.getOption("maxSize", 1000)
    this.ttlMs = this.getOption("ttlMs", 300000) // 5 minutes
    this.keyGenerator = this.getOption("keyGenerator", this.defaultKeyGenerator)
  }

  async initialize(orchestrator: AgentOrchestrator): Promise<void> {
    this.orchestrator = orchestrator
  }

  async beforeAgentExecution(
    agentId: string,
    prompt: string,
    context: ExecutionContext,
  ): Promise<{ agentId: string; prompt: string; context: ExecutionContext }> {
    const key = this.keyGenerator(agentId, prompt)
    const cached = this.get(key)

    if (cached) {
      // Add cached result to context
      context.variables._cached = true
      context.variables._cachedResult = cached
    }

    return { agentId, prompt, context }
  }

  async afterAgentExecution(agentId: string, result: any, context: ExecutionContext): Promise<any> {
    // Don't cache if result was already cached
    if (context.variables._cached) {
      return context.variables._cachedResult
    }

    // Cache the result
    const key = this.keyGenerator(agentId, JSON.stringify(context.variables.input))
    this.set(key, result)

    return result
  }

  private defaultKeyGenerator(agentId: string, prompt: string): string {
    // Simple hash function for cache key
    const hash = this.simpleHash(agentId + prompt)
    return `agent:${agentId}:${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private set(key: string, value: any): void {
    // Remove expired entries
    this.cleanup()

    // Remove oldest entries if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  private get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key)
      }
    }
  }

  // Public methods
  clear(): void {
    this.cache.clear()
  }

  getStats(): { size: number; hitRate: number } {
    // This would require tracking hits/misses in a real implementation
    return {
      size: this.cache.size,
      hitRate: 0, // Placeholder
    }
  }

  async cleanup(): Promise<void> {
    this.clear()
  }
}
