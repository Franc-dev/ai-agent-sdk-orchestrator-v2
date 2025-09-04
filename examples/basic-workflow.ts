/* eslint-env node */
/* global console, process, require, module */
import { AgentOrchestrator, Agent, Workflow } from "../src"
import chalk from "chalk"

async function basicWorkflowExample() {
  console.log(chalk.cyan("🤖 Basic Workflow Example"))
  console.log(chalk.gray("=".repeat(50)))

  // Create orchestrator
  const orchestrator = new AgentOrchestrator({
    logLevel: "info",
  })

  // Create a simple agent
  const agent = new Agent({
    id: "assistant",
    name: "AI Assistant",
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
    systemPrompt: "You are a helpful AI assistant. Provide clear and concise responses.",
    temperature: 0.7,
    maxTokens: 1000,
  })

  // Register agent
  orchestrator.registerAgent(agent)

  // Create a simple workflow
  const workflow = new Workflow({
    id: "simple-chat",
    name: "Simple Chat Workflow",
    description: "A basic chat workflow with one agent",
    steps: [
      {
        id: "respond",
        name: "Generate Response",
        type: "agent",
        agentId: "assistant",
      },
    ],
  })

  // Register workflow
  orchestrator.registerWorkflow(workflow)

  if (!process.env.OPENROUTER_API_KEY) {
    console.log("❌ Error: OPENROUTER_API_KEY environment variable is required")
    console.log("💡 Run: npm run setup")
    console.log("   Then edit .env with your OpenRouter API key")
    process.exit(1)
  }

  // Execute workflow
  console.log(chalk.blue("Executing workflow..."))

  try {
    const result = await orchestrator.execute("simple-chat", {
      message: "Hello! Can you explain what artificial intelligence is?",
    })

    console.log("\n" + chalk.green("✅ Workflow completed successfully!"))
    console.log(chalk.bold("Input:"), result.variables.input)
    console.log(chalk.bold("Response:"), result.variables.respond)
    console.log(chalk.bold("Steps executed:"), result.history.length)
    console.log(
      chalk.bold("Total duration:"),
      result.history.reduce((sum, step) => sum + (step.duration || 0), 0),
      "ms",
    )
  } catch (error) {
    console.error(chalk.red("❌ Workflow failed:"), error)
    throw error
  } finally {
    await orchestrator.shutdown()
  }
}

// Run example
if (require.main === module) {
  basicWorkflowExample().catch(console.error)
}

export { basicWorkflowExample }
