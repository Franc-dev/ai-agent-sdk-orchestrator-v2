import type { ExecutionContext, AgentConfig, WorkflowConfig } from "../types"
import type { AgentOrchestrator } from "../core/orchestrator"

export interface PluginMetadata {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  keywords?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface PluginConfig {
  enabled?: boolean
  priority?: number
  options?: Record<string, any>
}

export interface PluginHooks {
  // Orchestrator lifecycle
  beforeOrchestrator?(orchestrator: AgentOrchestrator): Promise<void>
  afterOrchestrator?(orchestrator: AgentOrchestrator): Promise<void>

  // Agent lifecycle
  beforeAgentRegistration?(agent: AgentConfig): Promise<AgentConfig>
  afterAgentRegistration?(agent: AgentConfig): Promise<void>
  beforeAgentExecution?(
    agentId: string,
    prompt: string,
    context: ExecutionContext,
  ): Promise<{ agentId: string; prompt: string; context: ExecutionContext }>
  afterAgentExecution?(agentId: string, result: any, context: ExecutionContext): Promise<any>

  // Workflow lifecycle
  beforeWorkflowRegistration?(workflow: WorkflowConfig): Promise<WorkflowConfig>
  afterWorkflowRegistration?(workflow: WorkflowConfig): Promise<void>
  beforeWorkflowExecution?(
    workflowId: string,
    input: any,
    context: ExecutionContext,
  ): Promise<{ workflowId: string; input: any; context: ExecutionContext }>
  afterWorkflowExecution?(workflowId: string, result: any, context: ExecutionContext): Promise<any>

  // Step lifecycle
  beforeStep?(context: ExecutionContext): Promise<ExecutionContext>
  afterStep?(context: ExecutionContext, result: any): Promise<any>

  // Error handling
  onError?(context: ExecutionContext, error: Error): Promise<void>
  onAgentError?(agentId: string, error: Error, context: ExecutionContext): Promise<void>
  onWorkflowError?(workflowId: string, error: Error, context: ExecutionContext): Promise<void>

  // Custom hooks
  onCustomEvent?(eventName: string, data: any): Promise<void>
}

export abstract class BasePlugin implements PluginHooks {
  public readonly metadata: PluginMetadata
  protected config: PluginConfig
  protected orchestrator?: AgentOrchestrator

  constructor(metadata: PluginMetadata, config: PluginConfig = {}) {
    this.metadata = metadata
    this.config = {
      enabled: true,
      priority: 0,
      ...config,
    }
  }

  // Required initialization method
  abstract initialize(orchestrator: AgentOrchestrator): Promise<void>

  // Optional cleanup method
  async cleanup?(): Promise<void>

  // Configuration methods
  isEnabled(): boolean {
    return this.config.enabled ?? true
  }

  getPriority(): number {
    return this.config.priority ?? 0
  }

  getConfig(): PluginConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<PluginConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // Utility methods
  protected getOption<T>(key: string, defaultValue?: T): T {
    return this.config.options?.[key] ?? defaultValue
  }

  protected setOption(key: string, value: any): void {
    if (!this.config.options) {
      this.config.options = {}
    }
    this.config.options[key] = value
  }

  // Validation
  async validate?(): Promise<{ valid: boolean; errors: string[] }>

  // Plugin information
  toString(): string {
    return `${this.metadata.name}@${this.metadata.version}`
  }
}

export interface PluginConstructor {
  new (config?: PluginConfig): BasePlugin
  metadata: PluginMetadata
}

// Plugin decorator for easy metadata definition
export function Plugin(metadata: PluginMetadata) {
  return <T extends PluginConstructor>(constructor: T): T => {
    constructor.metadata = metadata
    return constructor
  }
}

// Hook decorator for method-level hook registration
export function Hook(hookName: keyof PluginHooks, priority = 0) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    if (!target._hooks) {
      target._hooks = new Map()
    }
    target._hooks.set(hookName, { method: propertyKey, priority })
  }
}
