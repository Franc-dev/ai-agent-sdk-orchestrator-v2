/* eslint-env node */
/* global console, process, require, module */
import { AgentOrchestrator, Agent } from "../src"
import chalk from "chalk"

async function streamingResponsesExample() {
  console.log(chalk.cyan("🌊 Streaming Responses Example"))
  console.log(chalk.gray("=".repeat(50)))

  const orchestrator = new AgentOrchestrator()

  const agent = new Agent({
    id: "streaming-agent",
    name: "Streaming AI Agent",
    model: {
      provider: "openrouter",
      model: "anthropic/claude-3.5-sonnet",
      apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
      fallbackModels: [
        "mistralai/mistral-7b-instruct:free",
        "mistralai/mistral-small-3.2-24b-instruct:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
      ],
    },
    systemPrompt: "You are a helpful AI assistant. Provide detailed, informative responses.",
  })

  orchestrator.registerAgent(agent)

  const prompt = "Explain the concept of machine learning and its applications in modern technology."

  console.log(chalk.bold("Prompt:"), prompt)
  console.log("\n" + chalk.magenta("Streaming response:"))
  console.log(chalk.gray("─".repeat(40)))

  const context = {
    workflowId: "streaming-test",
    stepId: "stream",
    variables: { input: prompt },
    history: [],
    metadata: {},
  }

  // Stream the response
  let fullResponse = ""
  const stream = agent.executeStream(prompt, context)

  for await (const chunk of stream) {
    process.stdout.write(chunk)
    fullResponse += chunk
  }

  console.log("\n")
  console.log(chalk.gray("─".repeat(40)))
  console.log(chalk.bold("Full response length:"), fullResponse.length, "characters")

  await orchestrator.shutdown()
}

// Run example
if (require.main === module) {
  streamingResponsesExample().catch(console.error)
}

export { streamingResponsesExample }
