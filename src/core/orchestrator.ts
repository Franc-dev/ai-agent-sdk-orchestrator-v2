import { EventEmitter } from "eventemitter3"
import { Agent } from "./agent"
import { Workflow } from "./workflow"
import { Logger } from "../utils/logger"
import type { AgentConfig, WorkflowConfig, ExecutionContext, LogLevel, Plugin } from "../types"

export interface OrchestratorConfig {
  logLevel?: LogLevel
  maxConcurrentExecutions?: number
  defaultTimeout?: number
  plugins?: Plugin[]
}

export class AgentOrchestrator extends EventEmitter {
  private agents = new Map<string, Agent>()
  private workflows = new Map<string, Workflow>()
  private plugins: Plugin[] = []
  private logger: Logger
  private config: Required<OrchestratorConfig>
  private activeExecutions = new Map<string, ExecutionContext>()

  constructor(config: OrchestratorConfig = {}) {
    super()

    this.config = {
      logLevel: config.logLevel || "info",
      maxConcurrentExecutions: config.maxConcurrentExecutions || 10,
      defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
      plugins: config.plugins || [],
    }

    this.logger = new Logger(this.config.logLevel)
    this.plugins = [...this.config.plugins]

    this.logger.info("AgentOrchestrator initialized", { config: this.config })
  }

  // Agent Management
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent)
    this.logger.info(`Agent registered: ${agent.id}`, { agentName: agent.name })
    this.emit("agent:registered", agent)
  }

  createAgent(config: AgentConfig): Agent {
    const agent = new Agent(config)
    this.registerAgent(agent)
    return agent
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id)
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  // Workflow Management
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow)
    this.logger.info(`Workflow registered: ${workflow.id}`, { workflowName: workflow.name })
    this.emit("workflow:registered", workflow)
  }

  createWorkflow(config: WorkflowConfig): Workflow {
    const workflow = new Workflow(config)
    this.registerWorkflow(workflow)
    return workflow
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id)
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values())
  }

  // Plugin Management
  async addPlugin(plugin: Plugin): Promise<void> {
    await plugin.initialize(this)
    this.plugins.push(plugin)
    this.logger.info(`Plugin added: ${plugin.name}`, { version: plugin.version })
    this.emit("plugin:added", plugin)
  }

  // Execution
  async execute(
    workflowId: string,
    input: any,
    options: { timeout?: number; metadata?: Record<string, any> } = {},
  ): Promise<ExecutionContext> {
    const workflow = this.getWorkflow(workflowId)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`)
    }

    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      throw new Error("Maximum concurrent executions reached")
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const context: ExecutionContext = {
      workflowId,
      stepId: "",
      variables: { input, ...input },
      history: [],
      metadata: options.metadata || {},
    }

    this.activeExecutions.set(executionId, context)
    this.logger.info(`Execution started: ${executionId}`, { workflowId, input })
    this.emit("execution:started", { executionId, context })

    try {
      const timeout = options.timeout || this.config.defaultTimeout
      const result = await Promise.race([
        this.executeWorkflow(workflow, context),
        this.createTimeoutPromise(timeout, executionId),
      ])

      this.logger.info(`Execution completed: ${executionId}`, {
        duration: this.calculateDuration(context),
        steps: context.history.length,
      })
      this.emit("execution:completed", { executionId, context, result })

      return context
    } catch (error) {
      this.logger.error(`Execution failed: ${executionId}`, { error: error.message })
      this.emit("execution:failed", { executionId, context, error })
      throw error
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  private async executeWorkflow(workflow: Workflow, context: ExecutionContext): Promise<any> {
    // Execute plugins before workflow
    for (const plugin of this.plugins) {
      if (plugin.beforeStep) {
        await plugin.beforeStep(context)
      }
    }

    try {
      const result = await workflow.execute(context, this)

      // Execute plugins after workflow
      for (const plugin of this.plugins) {
        if (plugin.afterStep) {
          await plugin.afterStep(context, result)
        }
      }

      return result
    } catch (error) {
      // Execute plugin error handlers
      for (const plugin of this.plugins) {
        if (plugin.onError) {
          await plugin.onError(context, error as Error)
        }
      }
      throw error
    }
  }

  private createTimeoutPromise(timeoutMs: number, executionId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms: ${executionId}`))
      }, timeoutMs)
    })
  }

  private calculateDuration(context: ExecutionContext): number {
    if (context.history.length === 0) return 0
    const start = context.history[0]?.startTime
    const end = context.history[context.history.length - 1]?.endTime
    return start && end ? end.getTime() - start.getTime() : 0
  }

  // Status and Monitoring
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys())
  }

  getExecutionContext(executionId: string): ExecutionContext | undefined {
    return this.activeExecutions.get(executionId)
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down orchestrator...")

    // Wait for active executions to complete or timeout
    const activeIds = this.getActiveExecutions()
    if (activeIds.length > 0) {
      this.logger.warn(`Waiting for ${activeIds.length} active executions to complete`)
      // Give executions 30 seconds to complete
      await new Promise((resolve) => setTimeout(resolve, 30000))
    }

    this.activeExecutions.clear()
    this.emit("orchestrator:shutdown")
    this.logger.info("Orchestrator shutdown complete")
  }
}
