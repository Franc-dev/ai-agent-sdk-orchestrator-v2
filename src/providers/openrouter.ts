/* eslint-disable no-undef */
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
    const defaultFreeFallbacks = [
      "mistralai/mistral-7b-instruct:free",
      "mistralai/mistral-small-3.2-24b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ]
    const modelsToTry = [this.config.model, ...(this.config.fallbackModels?.length ? this.config.fallbackModels : defaultFreeFallbacks)]

    const requestedMax = options.maxTokens ?? 2048
    const tokenAttempts = Array.from(new Set([requestedMax, 1024, 512, 256])).filter((n) => n > 0)

    let lastError: Error | null = null
    for (const model of modelsToTry) {
      for (const maxTokens of tokenAttempts) {
        const body = {
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: options.temperature ?? 0.7,
          max_tokens: maxTokens,
          top_p: options.topP,
          frequency_penalty: options.frequencyPenalty,
          presence_penalty: options.presencePenalty,
          stop: options.stop,
        }

        try {
          const response = await this.makeRequest(
            `${this.baseUrl}/chat/completions`,
            body,
            options.timeout !== undefined ? { timeout: options.timeout } : {},
          )

          const data: any = await response.json()
          if (data.error) {
            throw new Error(`OpenRouter API error: ${data.error.message}`)
          }

          const choice = data.choices?.[0]
          if (!choice) {
            throw new Error("No response from OpenRouter API")
          }

          if (data.usage) {
            this.setLastTokenUsage(this.parseTokenUsage(data.usage)!)
          }

          return choice.message.content
        } catch (error) {
          lastError = error as Error
          const message = String(lastError.message || "")
          // If it's a credits error (402) or max_tokens issue, try lower tokens or next model
          if (message.includes("HTTP 402") || message.toLowerCase().includes("credits")) {
            continue
          }
          // For any other error, try next model
          break
        }
      }
    }

    throw lastError || new Error("All models failed for OpenRouter provider")
  }

  async *generateStream(prompt: string, options: GenerationOptions = {}): AsyncGenerator<string> {
    const defaultFreeFallbacks = [
      "mistralai/mistral-7b-instruct:free",
      "mistralai/mistral-small-3.2-24b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ]
    const modelsToTry = [this.config.model, ...(this.config.fallbackModels?.length ? this.config.fallbackModels : defaultFreeFallbacks)]
    const requestedMax = options.maxTokens ?? 2048
    const tokenAttempts = Array.from(new Set([requestedMax, 1024, 512, 256])).filter((n) => n > 0)
    let lastError: Error | null = null

    for (const model of modelsToTry) {
      for (const maxTokens of tokenAttempts) {
        const body = {
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: options.temperature ?? 0.7,
          max_tokens: maxTokens,
          top_p: options.topP,
          frequency_penalty: options.frequencyPenalty,
          presence_penalty: options.presencePenalty,
          stop: options.stop,
          stream: true,
        }

        try {
          const response = await this.makeRequest(
            `${this.baseUrl}/chat/completions`,
            body,
            options.timeout !== undefined ? { timeout: options.timeout } : {},
          )

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
                  const parsed: any = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta?.content
                  if (delta) {
                    yield delta
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
          return
        } finally {
          reader.releaseLock()
        }
        } catch (error) {
          lastError = error as Error
          const message = String(lastError.message || "")
          if (message.includes("HTTP 402") || message.toLowerCase().includes("credits")) {
            continue
          }
          break
        }
      }
    }

    throw lastError || new Error("All models failed for OpenRouter provider (stream)")
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4)
  }
}
