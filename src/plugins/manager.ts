import { EventEmitter } from "eventemitter3"
import type { BasePlugin, PluginHooks } from "./base"
import type { AgentOrchestrator } from "../core/orchestrator"
import { Logger } from "../observability/logger"

export interface PluginManagerConfig {
  autoLoad?: boolean
  pluginDirs?: string[]
  enableValidation?: boolean
  maxPlugins?: number
}

export class PluginManager extends EventEmitter {
  private plugins = new Map<string, BasePlugin>()
  private hooks = new Map<keyof PluginHooks, Array<{ plugin: BasePlugin; priority: number }>>()
  private config: Required<PluginManagerConfig>
  private logger: Logger
  private orchestrator?: AgentOrchestrator

  constructor(config: PluginManagerConfig = {}) {
    super()

    this.config = {
      autoLoad: config.autoLoad ?? false,
      pluginDirs: config.pluginDirs ?? ["./plugins"],
      enableValidation: config.enableValidation ?? true,
      maxPlugins: config.maxPlugins ?? 50,
    }

    this.logger = new Logger({ level: "info" })
  }

  async initialize(orchestrator: AgentOrchestrator): Promise<void> {
    this.orchestrator = orchestrator

    if (this.config.autoLoad) {
      await this.autoLoadPlugins()
    }

    this.logger.info("PluginManager initialized", {
      pluginCount: this.plugins.size,
      autoLoad: this.config.autoLoad,
    })
  }

  // Plugin registration
  async registerPlugin(plugin: BasePlugin): Promise<void> {
    if (this.plugins.size >= this.config.maxPlugins) {
      throw new Error(`Maximum number of plugins reached: ${this.config.maxPlugins}`)
    }

    if (this.plugins.has(plugin.metadata.name)) {
      throw new Error(`Plugin already registered: ${plugin.metadata.name}`)
    }

    // Validate plugin if enabled
    if (this.config.enableValidation && plugin.validate) {
      const validation = await plugin.validate()
      if (!validation.valid) {
        throw new Error(`Plugin validation failed: ${validation.errors.join(", ")}`)
      }
    }

    // Initialize plugin
    if (this.orchestrator) {
      await plugin.initialize(this.orchestrator)
    }

    // Register plugin
    this.plugins.set(plugin.metadata.name, plugin)

    // Register hooks
    this.registerPluginHooks(plugin)

    this.logger.info(`Plugin registered: ${plugin.toString()}`)
    this.emit("plugin:registered", plugin)
  }

  async unregisterPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      return false
    }

    // Cleanup plugin
    if (plugin.cleanup) {
      await plugin.cleanup()
    }

    // Unregister hooks
    this.unregisterPluginHooks(plugin)

    // Remove plugin
    this.plugins.delete(name)

    this.logger.info(`Plugin unregistered: ${plugin.toString()}`)
    this.emit("plugin:unregistered", plugin)

    return true
  }

  private registerPluginHooks(plugin: BasePlugin): void {
    const hookMethods: Array<keyof PluginHooks> = [
      "beforeOrchestrator",
      "afterOrchestrator",
      "beforeAgentRegistration",
      "afterAgentRegistration",
      "beforeAgentExecution",
      "afterAgentExecution",
      "beforeWorkflowRegistration",
      "afterWorkflowRegistration",
      "beforeWorkflowExecution",
      "afterWorkflowExecution",
      "beforeStep",
      "afterStep",
      "onError",
      "onAgentError",
      "onWorkflowError",
      "onCustomEvent",
    ]

    hookMethods.forEach((hookName) => {
      const maybeFn = (plugin as unknown as Record<string, unknown>)[hookName]
      if (typeof maybeFn === "function") {
        if (!this.hooks.has(hookName)) {
          this.hooks.set(hookName, [])
        }

        this.hooks.get(hookName)!.push({ plugin, priority: plugin.getPriority() })

        // Sort by priority (higher priority first)
        this.hooks.get(hookName)!.sort((a, b) => b.priority - a.priority)
      }
    })
  }

  private unregisterPluginHooks(plugin: BasePlugin): void {
    for (const [hookName, hookList] of this.hooks.entries()) {
      const filtered = hookList.filter((hook) => hook.plugin !== plugin)
      if (filtered.length === 0) {
        this.hooks.delete(hookName)
      } else {
        this.hooks.set(hookName, filtered)
      }
    }
  }

  // Hook execution
  async executeHook(
    hookName: keyof PluginHooks,
    ...args: any[]
  ): Promise<any> {
    const hookList = this.hooks.get(hookName)
    if (!hookList || hookList.length === 0) {
      return args[0] // Return first argument if no hooks
    }

    let result = args[0]

    for (const { plugin } of hookList) {
      if (!plugin.isEnabled()) {
        continue
      }

      try {
        const hookMethod = (plugin as unknown as Record<string, unknown>)[hookName] as
          | ((...a: any[]) => any)
          | undefined
        if (hookMethod) {
          const hookResult = await hookMethod.apply(plugin, args)
          if (hookResult !== undefined) {
            result = hookResult
            // Update args for next hook if result is returned
            if (args.length > 0) {
              args[0] = result as any
            }
          }
        }
      } catch (err: unknown) {
        const error = err as Error
        this.logger.error(`Hook execution failed: ${hookName}`, {
          plugin: plugin.toString(),
          error: error?.message,
        })

        // Continue with other hooks unless it's an error hook
        if (hookName.startsWith("onError")) {
          throw error
        }
      }
    }

    return result
  }

  // Plugin management
  getPlugin(name: string): BasePlugin | undefined {
    return this.plugins.get(name)
  }

  listPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values())
  }

  getEnabledPlugins(): BasePlugin[] {
    return this.listPlugins().filter((plugin) => plugin.isEnabled())
  }

  async enablePlugin(name: string): Promise<boolean> {
    const plugin = this.getPlugin(name)
    if (!plugin) {
      return false
    }

    plugin.updateConfig({ enabled: true })
    this.logger.info(`Plugin enabled: ${name}`)
    this.emit("plugin:enabled", plugin)
    return true
  }

  async disablePlugin(name: string): Promise<boolean> {
    const plugin = this.getPlugin(name)
    if (!plugin) {
      return false
    }

    plugin.updateConfig({ enabled: false })
    this.logger.info(`Plugin disabled: ${name}`)
    this.emit("plugin:disabled", plugin)
    return true
  }

  // Auto-loading
  private async autoLoadPlugins(): Promise<void> {
    // This would implement plugin discovery from filesystem
    // For now, we'll just log that auto-loading is enabled
    this.logger.info("Auto-loading plugins from directories", {
      directories: this.config.pluginDirs,
    })

    // In a real implementation, this would:
    // 1. Scan plugin directories
    // 2. Load plugin modules
    // 3. Instantiate and register plugins
    // 4. Handle dependencies
  }

  // Statistics
  getStats(): {
    totalPlugins: number
    enabledPlugins: number
    registeredHooks: Record<string, number>
  } {
    const registeredHooks: Record<string, number> = {}
    for (const [hookName, hookList] of this.hooks.entries()) {
      registeredHooks[hookName] = hookList.length
    }

    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: this.getEnabledPlugins().length,
      registeredHooks,
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down PluginManager...")

    // Cleanup all plugins
    const cleanupPromises = Array.from(this.plugins.values()).map(async (plugin) => {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup()
        } catch (err: unknown) {
          const error = err as Error
          this.logger.error(`Plugin cleanup failed: ${plugin.toString()}`, {
            error: error?.message ?? String(err),
          })
        }
      }
    })

    await Promise.all(cleanupPromises)

    this.plugins.clear()
    this.hooks.clear()

    this.logger.info("PluginManager shutdown complete")
  }
}
