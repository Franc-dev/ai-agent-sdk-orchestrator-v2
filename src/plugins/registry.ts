import type { BasePlugin, PluginConstructor } from "./base"
import { CachePlugin } from "./builtin/cache"
import { RateLimiterPlugin } from "./builtin/rate-limiter"
import { MetricsPlugin } from "./builtin/metrics"

export class PluginRegistry {
  private static plugins = new Map<string, PluginConstructor>()

  static {
    // Register built-in plugins
    this.register(CachePlugin)
    this.register(RateLimiterPlugin)
    this.register(MetricsPlugin)
  }

  static register(pluginConstructor: PluginConstructor): void {
    const metadata = pluginConstructor.metadata
    const name = metadata?.name || (pluginConstructor as any).name
    if (!name) {
      throw new Error("Plugin must provide a name in metadata or class name")
    }

    this.plugins.set(name, pluginConstructor)
  }

  static unregister(name: string): boolean {
    return this.plugins.delete(name)
  }

  static get(name: string): PluginConstructor | undefined {
    return this.plugins.get(name)
  }

  static list(): Array<{ name: string; version?: string; description?: string }> {
    return Array.from(this.plugins.values()).map((constructor) => ({
      name: constructor.metadata?.name || (constructor as any).name,
      version: constructor.metadata?.version,
      description: constructor.metadata?.description,
    }))
  }

  static create(name: string, config?: any): BasePlugin {
    const PluginConstructor = this.get(name)
    if (!PluginConstructor) {
      throw new Error(`Plugin not found: ${name}`)
    }

    return new PluginConstructor(config)
  }

  static has(name: string): boolean {
    return this.plugins.has(name)
  }

  static clear(): void {
    this.plugins.clear()
  }
}
