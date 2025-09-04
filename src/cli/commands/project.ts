import { promises as fs } from "fs"
import { join } from "path"
import inquirer from "inquirer"
import { BaseCLI } from "./base"

export class ProjectCLI extends BaseCLI {
  protected setupCommands(): void {
    const projectCmd = this.program.command("project").description("Manage projects")

    projectCmd
      .command("init [name]")
      .description("Initialize a new project")
      .option("-n, --name <name>", "project name")
      .option("-t, --template <template>", "project template")
      .action(async (name, options) => {
        if (typeof name === "string" && name.trim().length > 0) {
          options.name = options.name || name.trim()
        }
        await this.initProject(options)
      })

    projectCmd
      .command("status")
      .description("Show project status")
      .action(async () => {
        await this.showStatus()
      })

    projectCmd
      .command("config")
      .description("Manage project configuration")
      .option("-s, --set <key=value>", "set configuration value")
      .option("-g, --get <key>", "get configuration value")
      .action(async (options) => {
        await this.manageConfig(options)
      })
  }

  private async initProject(options: any): Promise<void> {
    const spinner = this.createSpinner("Initializing project...")

    try {
      // Check if already initialized
      const configPath = join(process.cwd(), "ai-agent.config.js")
      try {
        await fs.access(configPath)
        this.warn("Project already initialized")
        return
      } catch {
        // Continue with initialization
      }

      let config: any = {}

      if (options.template) {
        config = await this.createFromTemplate(options.template)
      } else {
        // Interactive mode
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Project name:",
            default: options.name || "my-ai-project",
          },
          {
            type: "input",
            name: "description",
            message: "Project description:",
          },
          {
            type: "list",
            name: "defaultProvider",
            message: "Default model provider:",
            choices: ["openrouter", "vercel", "openai", "custom"],
            default: "openrouter",
          },
          {
            type: "confirm",
            name: "enablePlugins",
            message: "Enable plugins?",
            default: true,
          },
          {
            type: "confirm",
            name: "enableMetrics",
            message: "Enable metrics collection?",
            default: true,
          },
        ])

        config = answers
      }

      // Create project structure
      await this.createProjectStructure(config)

      spinner.succeed()
      this.success(`Project initialized: ${config.name}`)
      this.info("Run 'ai-agent agent create' to create your first agent")
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async createFromTemplate(template: string): Promise<any> {
    const templates = {
      basic: {
        name: "Basic Project",
        description: "A basic AI agent project",
        defaultProvider: "openrouter",
        enablePlugins: true,
        enableMetrics: true,
      },
      chatbot: {
        name: "Chatbot Project",
        description: "A chatbot project with conversation management",
        defaultProvider: "openrouter",
        enablePlugins: true,
        enableMetrics: true,
        includeExamples: true,
      },
      workflow: {
        name: "Workflow Project",
        description: "A project focused on complex workflows",
        defaultProvider: "openrouter",
        enablePlugins: true,
        enableMetrics: true,
        includeWorkflowExamples: true,
      },
    }

    const templateConfig = templates[template as keyof typeof templates]
    if (!templateConfig) {
      throw new Error(`Unknown template: ${template}`)
    }

    return templateConfig
  }

  private async createProjectStructure(config: any): Promise<void> {
    // Create directories
    const dirs = ["agents", "workflows", "plugins", "examples", "logs"]
    for (const dir of dirs) {
      await fs.mkdir(join(process.cwd(), dir), { recursive: true })
    }

    // Create config file
    const configContent = `module.exports = {
  name: "${config.name}",
  description: "${config.description || ""}",
  
  // Default model provider settings
  defaultProvider: "${config.defaultProvider}",
  
  // Orchestrator settings
  orchestrator: {
    logLevel: "info",
    maxConcurrentExecutions: 10,
    defaultTimeout: 300000,
  },
  
  // Plugin settings
  plugins: {
    enabled: ${config.enablePlugins},
    autoLoad: true,
    builtin: {
      cache: { enabled: true },
      rateLimiter: { enabled: true },
      metrics: { enabled: ${config.enableMetrics} },
    },
  },
  
  // Observability settings
  observability: {
    enableMetrics: ${config.enableMetrics},
    enableTracing: true,
    enableLogging: true,
  },
}
`

    await fs.writeFile(join(process.cwd(), "ai-agent.config.js"), configContent)

    // Create .env template
    const envContent = `# AI Agent SDK Configuration

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Vercel AI Gateway
VERCEL_API_KEY=your_vercel_api_key_here

# Custom provider settings
# CUSTOM_API_URL=https://your-custom-api.com
# CUSTOM_API_KEY=your_custom_api_key_here
`

    await fs.writeFile(join(process.cwd(), ".env.example"), envContent)

    // Create README
    const readmeContent = `# ${config.name}

${config.description || "An AI agent project built with AI Agent SDK Orchestrator"}

## Getting Started

1. Copy \`.env.example\` to \`.env\` and configure your API keys
2. Create your first agent: \`ai-agent agent create\`
3. Create a workflow: \`ai-agent workflow create\`
4. Run your workflow: \`ai-agent run <workflow-id>\`

## Project Structure

- \`agents/\` - Agent configurations
- \`workflows/\` - Workflow definitions
- \`plugins/\` - Custom plugins
- \`examples/\` - Example code
- \`logs/\` - Application logs

## Commands

- \`ai-agent agent create\` - Create a new agent
- \`ai-agent workflow create\` - Create a new workflow
- \`ai-agent run <workflow>\` - Run a workflow
- \`ai-agent project status\` - Show project status

## Documentation

Visit [AI Agent SDK Documentation](https://github.com/yourusername/ai-agent-sdk-orchestrator) for more information.
`

    await fs.writeFile(join(process.cwd(), "README.md"), readmeContent)

    // Create gitignore
    const gitignoreContent = `node_modules/
.env
logs/
*.log
dist/
.DS_Store
`

    await fs.writeFile(join(process.cwd(), ".gitignore"), gitignoreContent)
  }

  private async showStatus(): Promise<void> {
    try {
      // Check if project is initialized
      const configPath = join(process.cwd(), "ai-agent.config.js")
      try {
        await fs.access(configPath)
      } catch {
        this.error("Project not initialized. Run 'ai-agent project init' first.")
        return
      }

      // Count agents and workflows
      const agentsDir = join(process.cwd(), "agents")
      const workflowsDir = join(process.cwd(), "workflows")

      let agentCount = 0
      let workflowCount = 0

      try {
        const agentFiles = await fs.readdir(agentsDir)
        agentCount = agentFiles.filter((f) => f.endsWith(".json")).length
      } catch {
        // Directory doesn't exist
      }

      try {
        const workflowFiles = await fs.readdir(workflowsDir)
        workflowCount = workflowFiles.filter((f) => f.endsWith(".json")).length
      } catch {
        // Directory doesn't exist
      }

      console.log("\nProject Status:")
      console.log("─".repeat(40))
      console.log(`Agents: ${agentCount}`)
      console.log(`Workflows: ${workflowCount}`)
      console.log(`Configuration: ${configPath}`)

      // Check for .env file
      try {
        await fs.access(join(process.cwd(), ".env"))
        console.log("Environment: ✓ Configured")
      } catch {
        console.log("Environment: ⚠ Not configured (copy .env.example to .env)")
      }
    } catch (error) {
      await this.handleError(error as Error)
    }
  }

  private async manageConfig(options: any): Promise<void> {
    try {
      const configPath = join(process.cwd(), "ai-agent.config.js")

      if (options.set) {
        this.warn("Configuration modification not implemented yet")
        this.info(`Would set: ${options.set}`)
      } else if (options.get) {
        this.warn("Configuration reading not implemented yet")
        this.info(`Would get: ${options.get}`)
      } else {
        // Show current config
        try {
          const config = require(configPath)
          console.log("\nCurrent Configuration:")
          console.log("─".repeat(40))
          console.log(JSON.stringify(config, null, 2))
        } catch (error) {
          this.error("Failed to load configuration")
        }
      }
    } catch (error) {
      await this.handleError(error as Error)
    }
  }
}
