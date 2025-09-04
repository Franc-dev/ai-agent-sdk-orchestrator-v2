/* eslint-env node */
/* global console, process, require, module */
import { AgentOrchestrator, Agent, Workflow } from "../src"
import { CachePlugin, RateLimiterPlugin, MetricsPlugin } from "../src/plugins/builtin"
import type { BasePlugin } from "../src/plugins/base"
import chalk from "chalk"

async function multiModelAgentExample() {
  console.log(chalk.cyan("🚀 Multi-Model Agent Example"))
  console.log(chalk.gray("=".repeat(50)))

  // Create orchestrator with plugins
  const orchestrator = new AgentOrchestrator({
    logLevel: "info",
  })

  // Add plugins
  await orchestrator.addPlugin(new CachePlugin() as unknown as BasePlugin)
  await orchestrator.addPlugin(new RateLimiterPlugin() as unknown as BasePlugin)
  const metricsPlugin = new MetricsPlugin() as unknown as BasePlugin
  await orchestrator.addPlugin(metricsPlugin)

  // Create multiple agents with different models
  const agents = [
    new Agent({
      id: "analyzer",
      name: "Content Analyzer",
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
        fallbackModels: [
          "mistralai/mistral-7b-instruct:free",
          "mistralai/mistral-small-3.2-24b-instruct:free",
          "mistralai/mistral-small-3.1-24b-instruct:free",
        ],
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
        fallbackModels: [
          "mistralai/mistral-7b-instruct:free",
          "mistralai/mistral-small-3.2-24b-instruct:free",
          "mistralai/mistral-small-3.1-24b-instruct:free",
        ],
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

  console.log(chalk.blue("Processing content through multi-agent pipeline..."))
  console.log(chalk.bold("Original content length:"), content.length, "characters")

  const startTime = Date.now()
  const result = await orchestrator.execute("content-pipeline", {
    content: content.trim(),
  })
  const totalTime = Date.now() - startTime

  console.log("\n" + chalk.green("📊 Results:"))
  console.log(chalk.gray("─".repeat(60)))

  console.log("\n" + chalk.yellow("🔍 Analysis:"))
  console.log(result.variables.analyze)

  console.log("\n" + chalk.yellow("📝 Summary:"))
  console.log(result.variables.summarize)

  console.log("\n" + chalk.yellow("✨ Creative Rewrite:"))
  console.log(result.variables.rewrite)

  console.log("\n" + chalk.green("📈 Execution Metrics:"))
  console.log(chalk.gray("─".repeat(30)))
  console.log(chalk.bold("Total time:"), totalTime, "ms")
  console.log(chalk.bold("Steps executed:"), result.history.length)

  result.history.forEach((step, i) => {
    console.log(`${i + 1}. ${step.stepId}: ${step.duration}ms`)
  })

  // Show plugin metrics
  console.log("\n" + chalk.cyan("🔌 Plugin Metrics:"))
  const metrics = (metricsPlugin as any).exportMetrics()
  console.log(chalk.bold("Agent executions:"), metrics.counters["agent_executions_completed"] || 0)
  console.log(chalk.bold("Total errors:"), metrics.counters["total_errors"] || 0)

  await orchestrator.shutdown()
}

// Run example
if (require.main === module) {
  multiModelAgentExample().catch(console.error)
}

export { multiModelAgentExample }
