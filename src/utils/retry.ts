import type { RetryConfig } from "../types"

export interface RetryOptions extends RetryConfig {
  onRetry?: (attempt: number, error: Error) => void
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === options.maxAttempts) {
        throw lastError
      }

      if (options.onRetry) {
        options.onRetry(attempt, lastError)
      }

      const backoffMs = Math.min(
        options.backoffMs * Math.pow(options.backoffMultiplier || 2, attempt - 1),
        options.maxBackoffMs || 30000,
      )

      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  throw lastError!
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message)
    this.name = "RetryableError"
  }
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof RetryableError) {
    return error.retryable
  }

  // Common retryable HTTP status codes
  if (error.message.includes("HTTP 429")) return true // Rate limit
  if (error.message.includes("HTTP 502")) return true // Bad gateway
  if (error.message.includes("HTTP 503")) return true // Service unavailable
  if (error.message.includes("HTTP 504")) return true // Gateway timeout

  // Network errors
  if (error.message.includes("ECONNRESET")) return true
  if (error.message.includes("ETIMEDOUT")) return true
  if (error.message.includes("ENOTFOUND")) return true

  return false
}
