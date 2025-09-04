import type { AgentConfig, ModelConfig, ToolConfig, ExecutionContext, TokenUsage } from "../types"
import { ModelProviderFactory } from "../providers/factory"
import { Logger } from "../utils/logger"

export class Agent {
  public readonly id: string
  public readonly name: string
  public readonly description?: string
  public readonly model: ModelConfig
  public readonly systemPrompt?: string
  public readonly temperature: number
  public readonly maxTokens: number
  public readonly tools: Map<string, ToolConfig>
  public readonly retryConfig: { maxAttempts: number; backoffMs: number }
  public readonly timeoutMs: number

  private logger: Logger
  private modelProvider: any

  constructor(config: AgentConfig) {
    this.id = config.id
    this.name = config.name
    this.description = config.description
    this.model = config.model
    this.systemPrompt = config.systemPrompt
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 2048
    this.timeoutMs = config.timeoutMs ?? 60000

    this.tools = new Map()
    if (config.tools) {
      config.tools.forEach((tool) => this.tools.set(tool.name, tool))
    }

    this.retryConfig = config.retryConfig ?? {
      maxAttempts: 3,
      backoffMs: 1000,
    }

    this.logger = new Logger("info")
    this.modelProvider = ModelProviderFactory.create(this.model)
  }

  async execute(
    prompt: string,
    context: ExecutionContext,
  ): Promise<{
    response: string
    tokens?: TokenUsage
    toolCalls?: any[]
  }> {
    const startTime = Date.now()
    this.logger.debug(`Agent ${this.id} executing`, { prompt: prompt.substring(0, 100) })

    try {
      // Build the full prompt with system message
      const fullPrompt = this.buildPrompt(prompt, context)

      // Execute with retry logic
      const result = await this.executeWithRetry(fullPrompt, context)

      const duration = Date.now() - startTime
      this.logger.info(`Agent ${this.id} completed`, { duration, tokens: result.tokens })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`Agent ${this.id} failed`, { error: error.message, duration })
      throw error
    }
  }

  async *executeStream(prompt: string, context: ExecutionContext): AsyncGenerator<string> {
    const fullPrompt = this.buildPrompt(prompt, context)

    try {
      const stream = this.modelProvider.generateStream(fullPrompt, {
        ...this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      })

      for await (const chunk of stream) {
        yield chunk
      }
    } catch (error) {
      this.logger.error(`Agent ${this.id} stream failed`, { error: error.message })
      throw error
    }
  }

  private buildPrompt(userPrompt: string, context: ExecutionContext): string {
    let prompt = ""

    if (this.systemPrompt) {
      prompt += `System: ${this.systemPrompt}\n\n`
    }

    // Add context variables if relevant
    if (Object.keys(context.variables).length > 0) {
      prompt += `Context Variables:\n${JSON.stringify(context.variables, null, 2)}\n\n`
    }

    // Add execution history if relevant
    if (context.history.length > 0) {
      const recentHistory = context.history.slice(-3) // Last 3 steps
      prompt += `Recent History:\n`
      recentHistory.forEach((step, i) => {
        prompt += `${i + 1}. ${step.stepId}: ${JSON.stringify(step.output)}\n`
      })
      prompt += "\n"
    }

    prompt += `User: ${userPrompt}`

    return prompt
  }

  private async executeWithRetry(
    prompt: string,
    context: ExecutionContext,
  ): Promise<{
    response: string
    tokens?: TokenUsage
    toolCalls?: any[]
  }> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await Promise.race([
          this.modelProvider.generateText(prompt, {
            ...this.model,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
          }),
          this.createTimeoutPromise(),
        ])

        // Process tool calls if any
        const toolCalls = await this.processToolCalls(response, context)

        return {
          response,
          toolCalls,
          tokens: this.modelProvider.getLastTokenUsage?.(),
        }
      } catch (error) {
        lastError = error as Error
        this.logger.warn(`Agent ${this.id} attempt ${attempt} failed`, {
          error: error.message,
          attempt,
          maxAttempts: this.retryConfig.maxAttempts,
        })

        if (attempt < this.retryConfig.maxAttempts) {
          const backoffMs = this.retryConfig.backoffMs * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        }
      }
    }

    throw lastError || new Error("All retry attempts failed")
  }

  private async processToolCalls(response: string, context: ExecutionContext): Promise<any[]> {
    // Simple tool call detection - in a real implementation, this would be more sophisticated
    const toolCallPattern = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/gs
    const toolCalls: any[] = []
    let match

    while ((match = toolCallPattern.exec(response)) !== null) {
      const [, toolName, argsStr] = match
      const tool = this.tools.get(toolName)

      if (tool) {
        try {
          const args = JSON.parse(argsStr)
          const result = await tool.handler(args, context)
          toolCalls.push({ tool: toolName, args, result })
        } catch (error) {
          this.logger.error(`Tool ${toolName} execution failed`, { error: error.message })
          toolCalls.push({ tool: toolName, error: error.message })
        }
      }
    }

    return toolCalls
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent execution timeout after ${this.timeoutMs}ms`))
      }, this.timeoutMs)
    })
  }

  // Tool management
  addTool(tool: ToolConfig): void {
    this.tools.set(tool.name, tool)
    this.logger.info(`Tool added to agent ${this.id}`, { toolName: tool.name })
  }

  removeTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName)
    if (removed) {
      this.logger.info(`Tool removed from agent ${this.id}`, { toolName })
    }
    return removed
  }

  listTools(): string[] {
    return Array.from(this.tools.keys())
  }
}
