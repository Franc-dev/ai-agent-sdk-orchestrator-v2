import { promises as fs } from "fs"
import { join } from "path"
import inquirer from "inquirer"
import { BaseCLI } from "./base"
import { AgentOrchestrator } from "../../core/orchestrator"
import { Agent } from "../../core/agent"

export class AgentCLI extends BaseCLI {
  protected setupCommands(): void {
    const agentCmd = this.program.command("agent").description("Manage AI agents")

    agentCmd
      .command("create")
      .description("Create a new agent")
      .option("-n, --name <name>", "agent name")
      .option("-m, --model <model>", "model to use")
      .option("-p, --provider <provider>", "model provider")
      .option("-t, --template", "use interactive template")
      .action(async (options) => {
        await this.createAgent(options)
      })

    agentCmd
      .command("list")
      .description("List all agents")
      .option("-f, --format <format>", "output format (table|json)", "table")
      .action(async (options) => {
        await this.listAgents(options)
      })

    agentCmd
      .command("test <agentId>")
      .description("Test an agent")
      .option("-p, --prompt <prompt>", "test prompt")
      .option("-i, --interactive", "interactive mode")
      .action(async (agentId, options) => {
        await this.testAgent(agentId, options)
      })

    agentCmd
      .command("delete <agentId>")
      .description("Delete an agent")
      .option("-f, --force", "force deletion without confirmation")
      .action(async (agentId, options) => {
        await this.deleteAgent(agentId, options)
      })
  }

  private async createAgent(options: any): Promise<void> {
    const spinner = this.createSpinner("Creating agent...")

    try {
      let config: any = {}

      if (options.template || (!options.name && !options.model)) {
        // Interactive mode
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Agent name:",
            default: options.name,
            validate: (input) => input.length > 0 || "Name is required",
          },
          {
            type: "input",
            name: "description",
            message: "Agent description:",
          },
          {
            type: "list",
            name: "provider",
            message: "Model provider:",
            choices: ["openrouter", "vercel", "openai", "custom"],
            default: options.provider || "openrouter",
          },
          {
            type: "input",
            name: "model",
            message: "Model name:",
            default: options.model || "anthropic/claude-3-sonnet",
          },
          {
            type: "input",
            name: "systemPrompt",
            message: "System prompt (optional):",
          },
          {
            type: "number",
            name: "temperature",
            message: "Temperature (0-1):",
            default: 0.7,
          },
          {
            type: "number",
            name: "maxTokens",
            message: "Max tokens:",
            default: 2048,
          },
        ])

        config = answers
      } else {
        // Command line mode
        config = {
          name: options.name,
          model: {
            provider: options.provider || "openrouter",
            model: options.model,
          },
        }
      }

      // Generate agent ID
      config.id = config.name.toLowerCase().replace(/\s+/g, "-")

      // Create agent file
      const agentPath = join(process.cwd(), "agents", `${config.id}.json`)
      await fs.mkdir(join(process.cwd(), "agents"), { recursive: true })
      await fs.writeFile(agentPath, JSON.stringify(config, null, 2))

      spinner.succeed()
      this.success(`Agent created: ${config.name} (${config.id})`)
      this.info(`Configuration saved to: ${agentPath}`)
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async listAgents(options: any): Promise<void> {
    try {
      const agentsDir = join(process.cwd(), "agents")

      try {
        await fs.access(agentsDir)
      } catch {
        this.warn("No agents directory found. Create an agent first.")
        return
      }

      const files = await fs.readdir(agentsDir)
      const agentFiles = files.filter((f) => f.endsWith(".json"))

      if (agentFiles.length === 0) {
        this.warn("No agents found.")
        return
      }

      const agents = []
      for (const file of agentFiles) {
        const content = await fs.readFile(join(agentsDir, file), "utf-8")
        const agent = JSON.parse(content)
        agents.push(agent)
      }

      if (options.format === "json") {
        console.log(JSON.stringify(agents, null, 2))
      } else {
        console.log("\nAgents:")
        console.log("─".repeat(80))
        agents.forEach((agent) => {
          console.log(`${agent.name} (${agent.id})`)
          console.log(`  Provider: ${agent.model?.provider || "unknown"}`)
          console.log(`  Model: ${agent.model?.model || "unknown"}`)
          if (agent.description) {
            console.log(`  Description: ${agent.description}`)
          }
          console.log()
        })
      }
    } catch (error) {
      await this.handleError(error as Error)
    }
  }

  private async testAgent(agentId: string, options: any): Promise<void> {
    const spinner = this.createSpinner("Loading agent...")

    try {
      // Load agent configuration
      const agentPath = join(process.cwd(), "agents", `${agentId}.json`)
      const agentConfig = JSON.parse(await fs.readFile(agentPath, "utf-8"))

      // Create orchestrator and agent
      const orchestrator = new AgentOrchestrator()
      const agent = new Agent(agentConfig)
      orchestrator.registerAgent(agent)

      spinner.succeed()

      if (options.interactive) {
        // Interactive mode
        this.info("Interactive mode - type 'exit' to quit")

        while (true) {
          const { prompt } = await inquirer.prompt([
            {
              type: "input",
              name: "prompt",
              message: "Prompt:",
            },
          ])

          if (prompt.toLowerCase() === "exit") {
            break
          }

          const testSpinner = this.createSpinner("Generating response...")
          try {
            const context = {
              workflowId: "test",
              stepId: "test",
              variables: { input: prompt },
              history: [],
              metadata: {},
            }

            const result = await agent.execute(prompt, context)
            testSpinner.succeed()

            console.log("\nResponse:")
            console.log("─".repeat(40))
            console.log(result.response)
            console.log()
          } catch (err: unknown) {
            testSpinner.fail()
            const error = err as Error
            this.error(`Error: ${error?.message ?? String(err)}`)
          }
        }
      } else {
        // Single prompt mode
        const prompt = options.prompt || "Hello, how are you?"

        const testSpinner = this.createSpinner("Generating response...")
        const context = {
          workflowId: "test",
          stepId: "test",
          variables: { input: prompt },
          history: [],
          metadata: {},
        }

        const result = await agent.execute(prompt, context)
        testSpinner.succeed()

        console.log("\nPrompt:", prompt)
        console.log("Response:", result.response)
        if (result.tokens) {
          console.log("Tokens:", result.tokens)
        }
      }
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async deleteAgent(agentId: string, options: any): Promise<void> {
    try {
      const agentPath = join(process.cwd(), "agents", `${agentId}.json`)

      // Check if agent exists
      try {
        await fs.access(agentPath)
      } catch {
        this.error(`Agent not found: ${agentId}`)
        return
      }

      // Confirm deletion
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `Delete agent '${agentId}'?`,
            default: false,
          },
        ])

        if (!confirm) {
          this.info("Deletion cancelled")
          return
        }
      }

      await fs.unlink(agentPath)
      this.success(`Agent deleted: ${agentId}`)
    } catch (error) {
      await this.handleError(error as Error)
    }
  }
}
