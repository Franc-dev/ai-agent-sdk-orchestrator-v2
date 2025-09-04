import { BaseModelProvider, type GenerationOptions } from "./base"
import type { ModelConfig } from "../types"

export interface CustomProviderConfig {
  generateEndpoint: string
  streamEndpoint?: string
  requestTransformer?: (prompt: string, options: GenerationOptions) => any
  responseTransformer?: (response: any) => string
  streamResponseTransformer?: (chunk: any) => string | null
  tokenEstimator?: (text: string) => number
}

export class CustomProvider extends BaseModelProvider {
  private customConfig: CustomProviderConfig

  constructor(config: ModelConfig & { custom: CustomProviderConfig }) {
    super(config)
    this.customConfig = config.custom
  }

  async generateText(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const requestBody = this.customConfig.requestTransformer
      ? this.customConfig.requestTransformer(prompt, options)
      : {
          model: this.config.model,
          prompt,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }

    const response = await this.makeRequest(this.customConfig.generateEndpoint, requestBody, {
      timeout: options.timeout,
    })

    const data: any = await response.json()

    if (data?.error) {
      throw new Error(`Custom provider error: ${data.error.message || data.error}`)
    }

    const text = this.customConfig.responseTransformer
      ? this.customConfig.responseTransformer(data)
      : data?.text || data?.completion || data?.response

    // Set token usage if available
    if (data?.usage) {
      this.setLastTokenUsage(this.parseTokenUsage(data.usage)!)
    }

    return text
  }

  async *generateStream(prompt: string, options: GenerationOptions = {}): AsyncGenerator<string> {
    if (!this.customConfig.streamEndpoint) {
      // Fallback to non-streaming
      const text = await this.generateText(prompt, options)
      yield text
      return
    }

    const requestBody = this.customConfig.requestTransformer
      ? this.customConfig.requestTransformer(prompt, { ...options, stream: true })
      : {
          model: this.config.model,
          prompt,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          stream: true,
        }

    const response = await this.makeRequest(this.customConfig.streamEndpoint, requestBody, {
      timeout: options.timeout,
    })

    if (!response.body) {
      throw new Error("No response body for streaming")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n").filter((line) => line.trim())

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") return

            try {
              const parsed = JSON.parse(data)
              const text = this.customConfig.streamResponseTransformer
                ? this.customConfig.streamResponseTransformer(parsed)
                : parsed.text || parsed.delta || parsed.content

              if (text) {
                yield text
              }

              if (parsed.usage) {
                this.setLastTokenUsage(this.parseTokenUsage(parsed.usage)!)
              }
            } catch (error) {
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  estimateTokens(text: string): number {
    if (this.customConfig.tokenEstimator) {
      return this.customConfig.tokenEstimator(text)
    }
    return Math.ceil(text.length / 4)
  }
}
