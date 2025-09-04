import { AgentOrchestrator, Agent, Workflow } from "../src"
import { CachePlugin, RateLimiterPlugin, MetricsPlugin } from "../src/plugins/builtin"

async function multiModelAgentExample() {
  console.log("🚀 Multi-Model Agent Example")
  console.log("=".repeat(50))

  // Create orchestrator with plugins
  const orchestrator = new AgentOrchestrator({
    logLevel: "info",
  })

  // Add plugins
  await orchestrator.addPlugin(new CachePlugin())
  await orchestrator.addPlugin(new RateLimiterPlugin())
  const metricsPlugin = new MetricsPlugin()
  await orchestrator.addPlugin(metricsPlugin)

  // Create multiple agents with different models
  const agents = [
    new Agent({
      id: "analyzer",
      name: "Content Analyzer",
      model: {
        provider: "openrouter",
        model: "anthropic/claude-3-sonnet",
        apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
      },
      systemPrompt:
        "You are an expert content analyzer. Analyze the given text and provide insights about its structure, tone, and key themes.",
      temperature: 0.3,
    }),
    new Agent({
      id: "summarizer",
      name: "Content Summarizer",
      model: {
        provider: "openrouter",
        model: "meta-llama/llama-3.1-8b-instruct",
        apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
      },
      systemPrompt: "You are a professional summarizer. Create concise, accurate summaries of the provided content.",
      temperature: 0.2,
    }),
    new Agent({
      id: "creative-writer",
      name: "Creative Writer",
      model: {
        provider: "openrouter",
        model: "openai/gpt-4o",
        apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
      },
      systemPrompt: "You are a creative writer. Transform the given content into engaging, creative narratives.",
      temperature: 0.8,
    }),
  ]

  // Register agents
  agents.forEach((agent) => orchestrator.registerAgent(agent))

  // Create complex workflow
  const workflow = new Workflow({
    id: "content-pipeline",
    name: "Content Processing Pipeline",
    description: "Analyze, summarize, and creatively rewrite content",
    steps: [
      {
        id: "analyze",
        name: "Analyze Content",
        type: "agent",
        agentId: "analyzer",
      },
      {
        id: "summarize",
        name: "Summarize Content",
        type: "agent",
        agentId: "summarizer",
      },
      {
        id: "rewrite",
        name: "Creative Rewrite",
        type: "agent",
        agentId: "creative-writer",
      },
    ],
  })

  orchestrator.registerWorkflow(workflow)

  // Sample content to process
  const content = `
    Artificial Intelligence (AI) has revolutionized numerous industries and aspects of daily life. 
    From healthcare diagnostics to autonomous vehicles, AI systems are becoming increasingly 
    sophisticated and capable. Machine learning algorithms can now process vast amounts of data 
    to identify patterns and make predictions that were previously impossible for humans to achieve. 
    However, this rapid advancement also raises important questions about ethics, privacy, and 
    the future of work. As AI continues to evolve, society must carefully consider how to harness 
    its benefits while mitigating potential risks.
  `

  console.log("Processing content through multi-agent pipeline...")
  console.log("Original content length:", content.length, "characters")

  const startTime = Date.now()
  const result = await orchestrator.execute("content-pipeline", {
    content: content.trim(),
  })
  const totalTime = Date.now() - startTime

  console.log("\n📊 Results:")
  console.log("─".repeat(60))

  console.log("\n🔍 Analysis:")
  console.log(result.variables.analyze)

  console.log("\n📝 Summary:")
  console.log(result.variables.summarize)

  console.log("\n✨ Creative Rewrite:")
  console.log(result.variables.rewrite)

  console.log("\n📈 Execution Metrics:")
  console.log("─".repeat(30))
  console.log("Total time:", totalTime, "ms")
  console.log("Steps executed:", result.history.length)

  result.history.forEach((step, i) => {
    console.log(`${i + 1}. ${step.stepId}: ${step.duration}ms`)
  })

  // Show plugin metrics
  console.log("\n🔌 Plugin Metrics:")
  const metrics = metricsPlugin.exportMetrics()
  console.log("Agent executions:", metrics.counters["agent_executions_completed"] || 0)
  console.log("Total errors:", metrics.counters["total_errors"] || 0)

  await orchestrator.shutdown()
}

// Run example
if (require.main === module) {
  multiModelAgentExample().catch(console.error)
}

export { multiModelAgentExample }
