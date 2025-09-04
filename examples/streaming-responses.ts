import { AgentOrchestrator, Agent } from "../src"

async function streamingResponsesExample() {
  console.log("🌊 Streaming Responses Example")
  console.log("=".repeat(50))

  const orchestrator = new AgentOrchestrator()

  const agent = new Agent({
    id: "streaming-agent",
    name: "Streaming AI Agent",
    model: {
      provider: "openrouter",
      model: "anthropic/claude-3-sonnet",
      apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
    },
    systemPrompt: "You are a helpful AI assistant. Provide detailed, informative responses.",
  })

  orchestrator.registerAgent(agent)

  const prompt = "Explain the concept of machine learning and its applications in modern technology."

  console.log("Prompt:", prompt)
  console.log("\nStreaming response:")
  console.log("─".repeat(40))

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
  console.log("─".repeat(40))
  console.log("Full response length:", fullResponse.length, "characters")

  await orchestrator.shutdown()
}

// Run example
if (require.main === module) {
  streamingResponsesExample().catch(console.error)
}

export { streamingResponsesExample }
