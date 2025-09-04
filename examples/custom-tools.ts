import { AgentOrchestrator, Agent, Workflow } from "../src"
import type { ToolConfig, ExecutionContext } from "../src/types"

async function customToolsExample() {
  console.log("🛠️ Custom Tools Example")
  console.log("=".repeat(50))

  // Define custom tools
  const weatherTool: ToolConfig = {
    name: "get_weather",
    description: "Get current weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" },
        units: { type: "string", enum: ["celsius", "fahrenheit"], default: "celsius" },
      },
      required: ["location"],
    },
    handler: async (params: any, context: ExecutionContext) => {
      // Simulate weather API call
      const { location, units = "celsius" } = params
      const temp = units === "celsius" ? "22°C" : "72°F"

      return {
        location,
        temperature: temp,
        condition: "Partly cloudy",
        humidity: "65%",
        wind: "10 km/h",
      }
    },
  }

  const calculatorTool: ToolConfig = {
    name: "calculate",
    description: "Perform mathematical calculations",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Mathematical expression to evaluate" },
      },
      required: ["expression"],
    },
    handler: async (params: any, context: ExecutionContext) => {
      const { expression } = params

      try {
        // Simple expression evaluator (in production, use a proper math library)
        const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ""))
        return { expression, result }
      } catch (error) {
        throw new Error(`Invalid expression: ${expression}`)
      }
    },
  }

  const orchestrator = new AgentOrchestrator()

  // Create agent with tools
  const agent = new Agent({
    id: "assistant-with-tools",
    name: "AI Assistant with Tools",
    model: {
      provider: "openrouter",
      model: "anthropic/claude-3-sonnet",
      apiKey: process.env.OPENROUTER_API_KEY || "your-api-key",
    },
    systemPrompt: `You are a helpful AI assistant with access to tools. 
    When users ask about weather, use [TOOL:get_weather]{"location": "city_name"}[/TOOL].
    When users ask for calculations, use [TOOL:calculate]{"expression": "math_expression"}[/TOOL].
    Always explain what you're doing and interpret the tool results for the user.`,
    tools: [weatherTool, calculatorTool],
  })

  orchestrator.registerAgent(agent)

  // Create workflow that uses tools
  const workflow = new Workflow({
    id: "tool-demo",
    name: "Tool Demonstration",
    steps: [
      {
        id: "process-request",
        name: "Process User Request",
        type: "agent",
        agentId: "assistant-with-tools",
      },
    ],
  })

  orchestrator.registerWorkflow(workflow)

  // Test different tool scenarios
  const testCases = [
    "What's the weather like in Paris?",
    "Can you calculate 15 * 23 + 47?",
    "What's the weather in Tokyo and can you also calculate the square root of 144?",
  ]

  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n🧪 Test Case ${index + 1}: ${testCase}`)
    console.log("─".repeat(60))

    const result = await orchestrator.execute("tool-demo", {
      message: testCase,
    })

    console.log("Response:", result.variables["process-request"])

    // Show tool calls if any
    const step = result.history.find((s) => s.stepId === "process-request")
    if (step && step.output && step.output.toolCalls) {
      console.log("\nTool calls made:")
      step.output.toolCalls.forEach((call: any, i: number) => {
        console.log(`${i + 1}. ${call.tool}:`, call.result || call.error)
      })
    }
  }

  await orchestrator.shutdown()
}

// Run example
if (require.main === module) {
  customToolsExample().catch(console.error)
}

export { customToolsExample }
