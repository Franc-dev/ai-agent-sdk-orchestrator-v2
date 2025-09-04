import type { ModelConfig } from "../types"
import type { BaseModelProvider } from "./base"
import { OpenRouterProvider } from "./openrouter"
import { CustomProvider, type CustomProviderConfig } from "./custom"

export class ModelProviderFactory {
  static create(config: ModelConfig): BaseModelProvider {
    switch (config.provider) {
      case "openrouter":
        return new OpenRouterProvider(config)
      case "vercel":
        throw new Error("Vercel provider has been removed. Use openrouter.")
      case "openai":
        throw new Error("OpenAI provider has been removed. Use openrouter.")
      case "custom":
        if (!("custom" in config)) {
          throw new Error("Custom provider configuration required for custom provider")
        }
        return new CustomProvider(config as ModelConfig & { custom: CustomProviderConfig })
      default:
        throw new Error(`Unsupported model provider: ${config.provider}`)
    }
  }

  static getSupportedProviders(): string[] {
    return ["openrouter", "custom"]
  }

  static validateConfig(config: ModelConfig): void {
    if (!config.provider) {
      throw new Error("Model provider is required")
    }

    if (!config.model) {
      throw new Error("Model name is required")
    }

    if (!this.getSupportedProviders().includes(config.provider)) {
      throw new Error(`Unsupported provider: ${config.provider}`)
    }

    // Provider-specific validation
    switch (config.provider) {
      case "openrouter":
        if (!config.apiKey) {
          throw new Error(`API key is required for ${config.provider}`)
        }
        break
      case "custom":
        if (!("custom" in config)) {
          throw new Error("Custom configuration is required for custom provider")
        }
        const customConfig = (config as any).custom as CustomProviderConfig
        if (!customConfig.generateEndpoint) {
          throw new Error("Generate endpoint is required for custom provider")
        }
        break
    }
  }
}
