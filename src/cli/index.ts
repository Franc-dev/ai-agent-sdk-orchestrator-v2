#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import { AgentCLI } from "./commands/agent"
import { WorkflowCLI } from "./commands/workflow"
import { PluginCLI } from "./commands/plugin"
import { ProjectCLI } from "./commands/project"
import { RunCLI } from "./commands/run"

const program = new Command()

program.name("ai-agent").description("AI Agent SDK Orchestrator CLI").version("1.0.0")

// Global options
program
  .option("-v, --verbose", "enable verbose logging")
  .option("-q, --quiet", "suppress output")
  .option("--config <path>", "path to config file", "./ai-agent.config.js")

// Register command groups
new AgentCLI(program)
new WorkflowCLI(program)
new PluginCLI(program)
new ProjectCLI(program)
new RunCLI(program)

// Error handling
program.exitOverride()

try {
  program.parse()
} catch (error) {
  if (error.code === "commander.unknownCommand") {
    console.error(chalk.red(`Unknown command: ${error.message}`))
    console.log(chalk.yellow("Run 'ai-agent --help' to see available commands"))
  } else {
    console.error(chalk.red("Error:"), error.message)
  }
  process.exit(1)
}
