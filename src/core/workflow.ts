import type { WorkflowConfig, StepConfig, ExecutionContext } from "../types"
import { Step } from "./step"
import { Logger } from "../utils/logger"

export class Workflow {
  public readonly id: string
  public readonly name: string
  public readonly description: string | undefined
  public readonly steps: Step[]
  public readonly parallel: boolean
  public readonly retryConfig: { maxAttempts: number; backoffMs: number }

  private logger: Logger

  constructor(config: WorkflowConfig) {
    this.id = config.id
    this.name = config.name
    this.description = config.description
    this.parallel = config.parallel ?? false
    this.steps = config.steps.map((stepConfig) => new Step(stepConfig))

    this.retryConfig = config.retryConfig ?? {
      maxAttempts: 3,
      backoffMs: 1000,
    }

    this.logger = new Logger({ level: "info" })
  }

  async execute(context: ExecutionContext, orchestrator: any): Promise<any> {
    this.logger.info(`Workflow ${this.id} starting execution`, {
      stepCount: this.steps.length,
      parallel: this.parallel,
    })

    const startTime = Date.now()
    let result: any

    try {
      if (this.parallel) {
        result = await this.executeParallel(context, orchestrator)
      } else {
        result = await this.executeSequential(context, orchestrator)
      }

      const duration = Date.now() - startTime
      this.logger.info(`Workflow ${this.id} completed`, {
        duration,
        steps: context.history.length,
        result: typeof result,
      })

      return result
    } catch (err: unknown) {
      const error = err as Error
      const duration = Date.now() - startTime
      this.logger.error(`Workflow ${this.id} failed`, {
        error: error?.message,
        duration,
        completedSteps: context.history.length,
      })
      throw error
    }
  }

  private async executeSequential(context: ExecutionContext, orchestrator: any): Promise<any> {
    let lastResult: any = context.variables.input

    for (const step of this.steps) {
      try {
        context.stepId = step.id
        const stepResult = await step.execute(lastResult, context, orchestrator)

        // Update context with step result
        context.variables[step.id] = stepResult
        lastResult = stepResult

        this.logger.debug(`Step ${step.id} completed`, { result: typeof stepResult })
      } catch (err: unknown) {
        const error = err as Error
        this.logger.error(`Step ${step.id} failed`, { error: error?.message })

        // Handle step failure based on configuration
        if (step.onFailure) {
          const failureStep = this.steps.find((s) => s.id === step.onFailure)
          if (failureStep) {
            context.stepId = failureStep.id
            lastResult = await failureStep.execute(error, context, orchestrator)
            continue
          }
        }

        throw error
      }
    }

    return lastResult
  }

  private async executeParallel(context: ExecutionContext, orchestrator: any): Promise<any> {
    const stepPromises = this.steps.map(async (step) => {
      try {
        const stepContext = { ...context, stepId: step.id }
        const result = await step.execute(context.variables.input, stepContext, orchestrator)
        return { stepId: step.id, result, error: null }
      } catch (err: unknown) {
        return { stepId: step.id, result: null, error: err as Error }
      }
    })

    const results = await Promise.all(stepPromises)

    // Check for errors
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      throw new Error(`${errors.length} steps failed: ${errors.map((e) => e.stepId).join(", ")}`)
    }

    // Combine results
    const combinedResult: Record<string, any> = {}
    results.forEach((r) => {
      if (r.result !== null) {
        combinedResult[r.stepId] = r.result
        context.variables[r.stepId] = r.result
      }
    })

    return combinedResult
  }

  // Step management
  addStep(stepConfig: StepConfig, position?: number): void {
    const step = new Step(stepConfig)

    if (position !== undefined && position >= 0 && position <= this.steps.length) {
      this.steps.splice(position, 0, step)
    } else {
      this.steps.push(step)
    }

    this.logger.info(`Step added to workflow ${this.id}`, {
      stepId: step.id,
      position: position ?? this.steps.length - 1,
    })
  }

  removeStep(stepId: string): boolean {
    const index = this.steps.findIndex((step) => step.id === stepId)
    if (index !== -1) {
      this.steps.splice(index, 1)
      this.logger.info(`Step removed from workflow ${this.id}`, { stepId })
      return true
    }
    return false
  }

  getStep(stepId: string): Step | undefined {
    return this.steps.find((step) => step.id === stepId)
  }

  listSteps(): string[] {
    return this.steps.map((step) => step.id)
  }
}
