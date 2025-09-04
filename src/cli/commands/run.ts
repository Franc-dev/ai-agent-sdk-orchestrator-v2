import { promises as fs } from "fs"
import { join } from "path"
import inquirer from "inquirer"
import { BaseCLI } from "./base"
import { AgentOrchestrator, Agent, Workflow } from "../../core"

export class RunCLI extends BaseCLI {
  protected setupCommands(): void {
    this.program
      .command("run <workflowId>")
      .description("Run a workflow")
      .option("-i, --input <input>", "input data (JSON)")
      .option("-f, --file <file>", "input file")
      .option("-w, --watch", "watch mode - rerun on file changes")
      .option("-v, --verbose", "verbose output")
      .action(async (workflowId, options) => {
        await this.runWorkflow(workflowId, options)
      })

    this.program
      .command("chat <agentId>")
      .description("Start an interactive chat with an agent")
      .option("-s, --system <prompt>", "system prompt override")
      .action(async (agentId, options) => {
        await this.startChat(agentId, options)
      })
  }

  private async runWorkflow(workflowId: string, options: any): Promise<void> {
    const spinner = this.createSpinner("Loading workflow...")

    try {
      // Load configuration
      const configPath = join(process.cwd(), "ai-agent.config.js")
      let config: any = {}
      try {
        config = require(configPath)
      } catch {
        this.warn("No configuration found, using defaults")
      }

      // Load workflow
      const workflowPath = join(process.cwd(), "workflows", `${workflowId}.json`)
      const workflowConfig = JSON.parse(await fs.readFile(workflowPath, "utf-8"))

      // Load agents referenced in workflow
      const agentIds = new Set<string>()
      workflowConfig.steps?.forEach((step: any) => {
        if (step.type === "agent" && step.agentId) {
          agentIds.add(step.agentId)
        }
      })

      spinner.text = "Loading agents..."
      const agents: any[] = []
      for (const agentId of agentIds) {
        try {
          const agentPath = join(process.cwd(), "agents", `${agentId}.json`)
          const agentConfig = JSON.parse(await fs.readFile(agentPath, "utf-8"))
          agents.push(agentConfig)
        } catch (error) {
          throw new Error(`Agent not found: ${agentId}`)
        }
      }

      // Get input
      let input: any = {}
      if (options.input) {
        input = JSON.parse(options.input)
      } else if (options.file) {
        const inputContent = await fs.readFile(options.file, "utf-8")
        input = JSON.parse(inputContent)
      } else {
        spinner.stop()
        const { inputData } = await inquirer.prompt([
          {
            type: "input",
            name: "inputData",
            message: "Input data (JSON):",
            default: '{"message": "Hello"}',
          },
        ])
        input = JSON.parse(inputData)
        spinner.start()
      }

      // Create orchestrator
      spinner.text = "Initializing orchestrator..."
      const orchestrator = new AgentOrchestrator({
        logLevel: options.verbose ? "debug" : "info",
        ...config.orchestrator,
      })

      // Register agents
      for (const agentConfig of agents) {
        const agent = new Agent(agentConfig)
        orchestrator.registerAgent(agent)
      }

      // Register workflow
      const workflow = new Workflow(workflowConfig)
      orchestrator.registerWorkflow(workflow)

      // Execute workflow
      spinner.text = "Executing workflow..."
      const startTime = Date.now()

      const result = await orchestrator.execute(workflowId, input)

      const duration = Date.now() - startTime
      spinner.succeed()

      // Display results
      this.success(`Workflow completed in ${duration}ms`)
      console.log("\nResults:")
      console.log("─".repeat(40))
      console.log("Input:", JSON.stringify(input, null, 2))
      console.log("Output:", JSON.stringify(result.variables, null, 2))
      console.log("Steps executed:", result.history.length)

      if (options.verbose) {
        console.log("\nExecution History:")
        result.history.forEach((step, i) => {
          console.log(`${i + 1}. ${step.stepId} (${step.duration}ms)`)
          if (step.error) {
            console.log(`   Error: ${step.error.message}`)
          }
        })
      }
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async startChat(agentId: string, options: any): Promise<void> {
    const spinner = this.createSpinner("Loading agent...")

    try {
      // Load agent
      const agentPath = join(process.cwd(), "agents", `${agentId}.json`)
      const agentConfig = JSON.parse(await fs.readFile(agentPath, "utf-8"))

      // Override system prompt if provided
      if (options.system) {
        agentConfig.systemPrompt = options.system
      }

      // Create orchestrator and agent
      const orchestrator = new AgentOrchestrator()
      const agent = new Agent(agentConfig)
      orchestrator.registerAgent(agent)

      spinner.succeed()

      console.log(`\nStarting chat with ${agentConfig.name}`)
      console.log("Type 'exit', 'quit', or 'bye' to end the conversation")
      console.log("─".repeat(50))

      const conversationHistory: any[] = []

      while (true) {
        const { message } = await inquirer.prompt([
          {
            type: "input",
            name: "message",
            message: "You:",
          },
        ])

        if (["exit", "quit", "bye"].includes(message.toLowerCase())) {
          console.log("Goodbye!")
          break
        }

        const chatSpinner = this.createSpinner("Thinking...")

        try {
          const context = {
            workflowId: "chat",
            stepId: "chat",
            variables: {
              input: message,
              history: conversationHistory,
            },
            history: [],
            metadata: {},
          }

          const result = await agent.execute(message, context)
          chatSpinner.succeed()

          console.log(`${agentConfig.name}:`, result.response)
          console.log()

          // Add to conversation history
          conversationHistory.push({
            user: message,
            assistant: result.response,
            timestamp: new Date().toISOString(),
          })

          // Keep only last 10 exchanges
          if (conversationHistory.length > 10) {
            conversationHistory.shift()
          }
        } catch (error) {
          chatSpinner.fail()
          this.error(`Error: ${error.message}`)
        }
      }
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }
}
