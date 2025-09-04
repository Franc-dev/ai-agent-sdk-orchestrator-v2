import "dotenv/config"
import { Command } from "commander"
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import pkg from "../../package.json" assert { type: "json" }
import chalk from "chalk"
import { AgentCLI } from "./commands/agent"
import { WorkflowCLI } from "./commands/workflow"
import { ProjectCLI } from "./commands/project"
import { RunCLI } from "./commands/run"
import { OpenCLI } from "./commands/open"
import { AuthCLI } from "./commands/auth"

const program = new Command()

program.name("ai-agent").description("AI Agent SDK Orchestrator CLI").version(pkg.version)

// Global options
program
  .option("-v, --verbose", "enable verbose logging")
  .option("-q, --quiet", "suppress output")
  .option("--config <path>", "path to config file", "./ai-agent.config.js")

// Register command groups
new AgentCLI(program)
new WorkflowCLI(program)
new ProjectCLI(program)
new RunCLI(program)
new OpenCLI(program)
new AuthCLI(program)

// Error handling: override only for real errors; allow --help/--version to exit cleanly
program.exitOverride((err) => {
  const code = (err as any)?.code
  if (code === "commander.helpDisplayed" || code === "commander.version") {
    process.exit(0)
  }
  if (code === "commander.unknownCommand") {
    console.error(chalk.red(`Unknown command: ${String((err as any)?.message || "")}`))
    console.log(chalk.yellow("Run 'ai-agent --help' to see available commands"))
    process.exit(1)
  }
  console.error(chalk.red("Error:"), String((err as any)?.message || err))
  process.exit(1)
})

program.parse()
