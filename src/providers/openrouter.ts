import { BaseModelProvider, type GenerationOptions } from "./base"
import type { ModelConfig } from "../types"

export class OpenRouterProvider extends BaseModelProvider {
  private baseUrl = "https://openrouter.ai/api/v1"

  constructor(config: ModelConfig) {
    super(config)
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    }
  }

  async generateText(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const body = {
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
    }

    const response = await this.makeRequest(`${this.baseUrl}/chat/completions`, body, {
      timeout: options.timeout,
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(`OpenRouter API error: ${data.error.message}`)
    }

    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error("No response from OpenRouter API")
    }

    // Set token usage
    if (data.usage) {
      this.setLastTokenUsage(this.parseTokenUsage(data.usage)!)
    }

    return choice.message.content
  }

  async *generateStream(prompt: string, options: GenerationOptions = {}): AsyncGenerator<string> {
    const body = {
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
      stream: true,
    }

    const response = await this.makeRequest(`${this.baseUrl}/chat/completions`, body, {
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
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                yield delta
              }

              // Handle usage data in final chunk
              if (parsed.usage) {
                this.setLastTokenUsage(this.parseTokenUsage(parsed.usage)!)
              }
            } catch (error) {
              // Skip invalid JSON chunks
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
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4)
  }
}
