import { BasePlugin, Plugin, type PluginConfig } from "../base"
import type { AgentOrchestrator } from "../../core/orchestrator"
import type { ExecutionContext } from "../../types"
import { MetricsCollector } from "../../observability/metrics"

interface MetricsConfig extends PluginConfig {
  options?: {
    collectAgentMetrics?: boolean
    collectWorkflowMetrics?: boolean
    collectErrorMetrics?: boolean
    collectPerformanceMetrics?: boolean
  }
}

@Plugin({
  name: "metrics",
  version: "1.0.0",
  description: "Collects detailed metrics for agents and workflows",
  author: "AI Agent SDK",
})
export class MetricsPlugin extends BasePlugin {
  private metrics: MetricsCollector
  private collectAgentMetrics: boolean
  private collectWorkflowMetrics: boolean
  private collectErrorMetrics: boolean
  private collectPerformanceMetrics: boolean

  constructor(config: MetricsConfig = {}) {
    super(MetricsPlugin.metadata, config)

    this.metrics = new MetricsCollector()
    this.collectAgentMetrics = this.getOption("collectAgentMetrics", true)
    this.collectWorkflowMetrics = this.getOption("collectWorkflowMetrics", true)
    this.collectErrorMetrics = this.getOption("collectErrorMetrics", true)
    this.collectPerformanceMetrics = this.getOption("collectPerformanceMetrics", true)
  }

  async initialize(orchestrator: AgentOrchestrator): Promise<void> {
    this.orchestrator = orchestrator
  }

  async beforeAgentExecution(
    agentId: string,
    prompt: string,
    context: ExecutionContext,
  ): Promise<{ agentId: string; prompt: string; context: ExecutionContext }> {
    if (this.collectAgentMetrics) {
      this.metrics.incrementCounter("agent_executions_started", 1, { agentId })
      context.metadata._metricsStartTime = Date.now()
    }

    return { agentId, prompt, context }
  }

  async afterAgentExecution(agentId: string, result: any, context: ExecutionContext): Promise<any> {
    if (this.collectAgentMetrics) {
      this.metrics.incrementCounter("agent_executions_completed", 1, { agentId })

      if (this.collectPerformanceMetrics && context.metadata._metricsStartTime) {
        const duration = Date.now() - context.metadata._metricsStartTime
        this.metrics.recordTimer("agent_execution_duration", duration, { agentId })
      }

      // Record token usage if available
      if (result.tokens) {
        this.metrics.recordHistogram("agent_tokens_used", result.tokens.total, { agentId })
        this.metrics.recordHistogram("agent_prompt_tokens", result.tokens.prompt, { agentId })
        this.metrics.recordHistogram("agent_completion_tokens", result.tokens.completion, { agentId })
      }
    }

    return result
  }

  async beforeWorkflowExecution(
    workflowId: string,
    input: any,
    context: ExecutionContext,
  ): Promise<{ workflowId: string; input: any; context: ExecutionContext }> {
    if (this.collectWorkflowMetrics) {
      this.metrics.incrementCounter("workflow_executions_started", 1, { workflowId })
      context.metadata._workflowStartTime = Date.now()
    }

    return { workflowId, input, context }
  }

  async afterWorkflowExecution(workflowId: string, result: any, context: ExecutionContext): Promise<any> {
    if (this.collectWorkflowMetrics) {
      this.metrics.incrementCounter("workflow_executions_completed", 1, { workflowId })

      if (this.collectPerformanceMetrics && context.metadata._workflowStartTime) {
        const duration = Date.now() - context.metadata._workflowStartTime
        this.metrics.recordTimer("workflow_execution_duration", duration, { workflowId })
      }

      // Record step count
      this.metrics.recordHistogram("workflow_steps_executed", context.history.length, { workflowId })
    }

    return result
  }

  async onAgentError(agentId: string, error: Error, context: ExecutionContext): Promise<void> {
    if (this.collectErrorMetrics) {
      this.metrics.incrementCounter("agent_errors", 1, {
        agentId,
        errorType: error.constructor.name,
      })
    }
  }

  async onWorkflowError(workflowId: string, error: Error, context: ExecutionContext): Promise<void> {
    if (this.collectErrorMetrics) {
      this.metrics.incrementCounter("workflow_errors", 1, {
        workflowId,
        errorType: error.constructor.name,
      })
    }
  }

  async onError(context: ExecutionContext, error: Error): Promise<void> {
    if (this.collectErrorMetrics) {
      this.metrics.incrementCounter("total_errors", 1, {
        errorType: error.constructor.name,
      })
    }
  }

  // Public methods
  getMetrics(): MetricsCollector {
    return this.metrics
  }

  exportMetrics(): any {
    return this.metrics.export()
  }

  async cleanup(): Promise<void> {
    this.metrics.clear()
  }
}
