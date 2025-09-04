import type { ModelConfig, TokenUsage } from "../types"

export interface ModelResponse {
  text: string
  tokens?: TokenUsage
  finishReason?: string
  model?: string
}

export interface StreamChunk {
  text: string
  isComplete: boolean
  tokens?: TokenUsage
}

export abstract class BaseModelProvider {
  protected config: ModelConfig
  protected lastTokenUsage?: TokenUsage

  constructor(config: ModelConfig) {
    this.config = config
  }

  abstract generateText(prompt: string, options?: GenerationOptions): Promise<string>
  abstract generateStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string>
  abstract estimateTokens(text: string): number

  getLastTokenUsage(): TokenUsage | undefined {
    return this.lastTokenUsage
  }

  protected setLastTokenUsage(usage: TokenUsage): void {
    this.lastTokenUsage = usage
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "ai-agent-sdk-orchestrator/1.0.0",
    }

    const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`

    if (this.config.headers) {
      Object.assign(headers, this.config.headers)
    }

    return headers
  }

  protected async makeRequest(url: string, body: any, options: { timeout?: number } = {}): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  protected parseTokenUsage(usage: any): TokenUsage | undefined {
    if (!usage) return undefined

    return {
      prompt: usage.prompt_tokens || usage.input_tokens || 0,
      completion: usage.completion_tokens || usage.output_tokens || 0,
      total: usage.total_tokens || 0,
    }
  }
}

export interface GenerationOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  timeout?: number
  stream?: boolean
}
