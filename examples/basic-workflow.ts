import { AgentOrchestrator, Agent, Workflow } from "../src"

async function basicWorkflowExample() {
  console.log("🤖 Basic Workflow Example")
  console.log("=".repeat(50))

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
      model: "anthropic/claude-3-sonnet",
      apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
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

  // Execute workflow
  console.log("Executing workflow...")
  const result = await orchestrator.execute("simple-chat", {
    message: "Hello! Can you explain what artificial intelligence is?",
  })

  console.log("\nResult:")
  console.log("Input:", result.variables.input)
  console.log("Response:", result.variables.respond)
  console.log("Steps executed:", result.history.length)
  console.log(
    "Total duration:",
    result.history.reduce((sum, step) => sum + (step.duration || 0), 0),
    "ms",
  )

  await orchestrator.shutdown()
}

// Run example
if (require.main === module) {
  basicWorkflowExample().catch(console.error)
}

export { basicWorkflowExample }
