import { BaseModelProvider, type GenerationOptions } from "./base"
import type { ModelConfig } from "../types"

export class VercelProvider extends BaseModelProvider {
  private baseUrl = "https://api.vercel.com/v1/ai"

  constructor(config: ModelConfig) {
    super(config)
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    }
  }

  async generateText(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const body = {
      model: this.config.model,
      prompt,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2048,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stop: options.stop,
    }

    const response = await this.makeRequest(`${this.baseUrl}/generate`, body, {
      timeout: options.timeout,
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(`Vercel AI error: ${data.error.message}`)
    }

    // Set token usage
    if (data.usage) {
      this.setLastTokenUsage(this.parseTokenUsage(data.usage)!)
    }

    return data.text || data.completion
  }

  async *generateStream(prompt: string, options: GenerationOptions = {}): AsyncGenerator<string> {
    const body = {
      model: this.config.model,
      prompt,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2048,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stop: options.stop,
      stream: true,
    }

    const response = await this.makeRequest(`${this.baseUrl}/generate`, body, {
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
              if (parsed.text) {
                yield parsed.text
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
    return Math.ceil(text.length / 4)
  }
}
