export interface AgentConfig {
  id: string
  name: string
  description?: string
  model: ModelConfig
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  tools?: ToolConfig[]
  retryConfig?: RetryConfig
  timeoutMs?: number
}

export interface ModelConfig {
  provider: "openrouter" | "vercel" | "openai" | "custom"
  model: string
  apiKey?: string
  baseUrl?: string
  headers?: Record<string, string>
  fallbackModels?: string[]
}

export interface ToolConfig {
  name: string
  description: string
  parameters: Record<string, any>
  handler: (params: any, context: ExecutionContext) => Promise<any>
}

export interface WorkflowConfig {
  id: string
  name: string
  description?: string
  steps: StepConfig[]
  parallel?: boolean
  retryConfig?: RetryConfig
}

export interface StepConfig {
  id: string
  name: string
  type: "agent" | "tool" | "condition" | "loop" | "parallel"
  agentId?: string
  toolName?: string
  condition?: (context: ExecutionContext) => boolean
  iterations?: number
  steps?: StepConfig[]
  onSuccess?: string
  onFailure?: string
  retryConfig?: RetryConfig
}

export interface RetryConfig {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier?: number
  maxBackoffMs?: number
}

export interface ExecutionContext {
  workflowId: string
  stepId: string
  variables: Record<string, any>
  history: ExecutionStep[]
  metadata: Record<string, any>
}

export interface ExecutionStep {
  id: string
  stepId: string
  agentId?: string
  input: any
  output: any
  error?: Error
  startTime: Date
  endTime?: Date
  duration?: number
  tokens?: TokenUsage
}

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: Record<string, any>
  stepId?: string
  agentId?: string
}

export interface ModelProvider {
  name: string
  generateText(prompt: string, config: ModelConfig): Promise<string>
  generateStream(prompt: string, config: ModelConfig): AsyncGenerator<string>
  estimateTokens(text: string): number
}

export interface Plugin {
  name: string
  version: string
  initialize(orchestrator: any): Promise<void>
  beforeStep?(context: ExecutionContext): Promise<void>
  afterStep?(context: ExecutionContext, result: any): Promise<void>
  onError?(context: ExecutionContext, error: Error): Promise<void>
}
