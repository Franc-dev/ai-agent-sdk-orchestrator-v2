import type { StepConfig, ExecutionContext, ExecutionStep } from "../types"
import { Logger } from "../utils/logger"

export class Step {
  public readonly id: string
  public readonly name: string
  public readonly type: StepConfig["type"]
  public readonly agentId: string | undefined
  public readonly toolName: string | undefined
  public readonly condition: ((context: ExecutionContext) => boolean) | undefined
  public readonly iterations: number | undefined
  public readonly steps: Step[] | undefined
  public readonly onSuccess: string | undefined
  public readonly onFailure: string | undefined
  public readonly retryConfig: { maxAttempts: number; backoffMs: number }

  private logger: Logger

  constructor(config: StepConfig) {
    this.id = config.id
    this.name = config.name
    this.type = config.type
    this.agentId = config.agentId
    this.toolName = config.toolName
    this.condition = config.condition
    this.iterations = config.iterations
    this.onSuccess = config.onSuccess
    this.onFailure = config.onFailure

    // Convert nested step configs to Step instances
    this.steps = config.steps?.map((stepConfig) => new Step(stepConfig))

    this.retryConfig = config.retryConfig ?? {
      maxAttempts: 3,
      backoffMs: 1000,
    }

    this.logger = new Logger({ level: "info" })
  }

  async execute(input: any, context: ExecutionContext, orchestrator: any): Promise<any> {
    const executionStep: ExecutionStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stepId: this.id,
      agentId: this.agentId,
      input,
      output: null,
      startTime: new Date(),
    }

    context.history.push(executionStep)

    this.logger.debug(`Step ${this.id} starting`, { type: this.type, input: typeof input })

    try {
      let result: any

      switch (this.type) {
        case "agent":
          result = await this.executeAgent(input, context, orchestrator)
          break
        case "tool":
          result = await this.executeTool(input, context, orchestrator)
          break
        case "condition":
          result = await this.executeCondition(input, context, orchestrator)
          break
        case "loop":
          result = await this.executeLoop(input, context, orchestrator)
          break
        case "parallel":
          result = await this.executeParallel(input, context, orchestrator)
          break
        default:
          throw new Error(`Unknown step type: ${this.type}`)
      }

      executionStep.output = result
      executionStep.endTime = new Date()
      executionStep.duration = executionStep.endTime.getTime() - executionStep.startTime.getTime()

      this.logger.debug(`Step ${this.id} completed`, {
        duration: executionStep.duration,
        result: typeof result,
      })

      return result
    } catch (err: unknown) {
      const error = err as Error
      executionStep.error = error
      executionStep.endTime = new Date()
      executionStep.duration = executionStep.endTime.getTime() - executionStep.startTime.getTime()

      this.logger.error(`Step ${this.id} failed`, {
        error: error?.message,
        duration: executionStep.duration,
      })

      throw error
    }
  }

  private async executeAgent(input: any, context: ExecutionContext, orchestrator: any): Promise<any> {
    if (!this.agentId) {
      throw new Error(`Agent ID required for agent step: ${this.id}`)
    }

    const agent = orchestrator.getAgent(this.agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${this.agentId}`)
    }

    const prompt = typeof input === "string" ? input : JSON.stringify(input)
    const result = await agent.execute(prompt, context)

    return result.response
  }

  private async executeTool(input: any, context: ExecutionContext, orchestrator: any): Promise<any> {
    if (!this.toolName) {
      throw new Error(`Tool name required for tool step: ${this.id}`)
    }

    // Find tool in any registered agent
    for (const agent of orchestrator.listAgents()) {
      const tool = agent.tools.get(this.toolName)
      if (tool) {
        return await tool.handler(input, context)
      }
    }

    throw new Error(`Tool not found: ${this.toolName}`)
  }

  private async executeCondition(input: any, context: ExecutionContext, orchestrator: any): Promise<any> {
    if (!this.condition) {
      throw new Error(`Condition function required for condition step: ${this.id}`)
    }

    const conditionResult = this.condition(context)

    if (conditionResult && this.onSuccess) {
      // Execute success step
      const successStep = this.steps?.find((s) => s.id === this.onSuccess)
      if (successStep) {
        return await successStep.execute(input, context, orchestrator)
      }
    } else if (!conditionResult && this.onFailure) {
      // Execute failure step
      const failureStep = this.steps?.find((s) => s.id === this.onFailure)
      if (failureStep) {
        return await failureStep.execute(input, context, orchestrator)
      }
    }

    return conditionResult
  }

  private async executeLoop(input: any, context: ExecutionContext, orchestrator: any): Promise<any> {
    if (!this.steps || this.steps.length === 0) {
      throw new Error(`Loop steps required for loop step: ${this.id}`)
    }

    const iterations = this.iterations ?? 1
    const results: any[] = []
    let currentInput = input

    for (let i = 0; i < iterations; i++) {
      this.logger.debug(`Loop iteration ${i + 1}/${iterations}`, { stepId: this.id })

      // Execute all steps in the loop
      for (const step of this.steps) {
        currentInput = await step.execute(currentInput, context, orchestrator)
      }

      results.push(currentInput)
    }

    return results
  }

  private async executeParallel(input: any, context: ExecutionContext, orchestrator: any): Promise<any> {
    if (!this.steps || this.steps.length === 0) {
      throw new Error(`Parallel steps required for parallel step: ${this.id}`)
    }

    const stepPromises = this.steps.map(async (step) => {
      try {
        const result = await step.execute(input, context, orchestrator)
        return { stepId: step.id, result, error: null }
      } catch (err: unknown) {
        return { stepId: step.id, result: null, error: err as Error }
      }
    })

    const results = await Promise.all(stepPromises)

    // Check for errors
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      throw new Error(`${errors.length} parallel steps failed: ${errors.map((e) => e.stepId).join(", ")}`)
    }

    // Combine results
    const combinedResult: Record<string, any> = {}
    results.forEach((r) => {
      if (r.result !== null) {
        combinedResult[r.stepId] = r.result
      }
    })

    return combinedResult
  }
}
