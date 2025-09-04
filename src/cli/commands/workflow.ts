import { promises as fs } from "fs"
import { join } from "path"
import inquirer from "inquirer"
import { BaseCLI } from "./base"

export class WorkflowCLI extends BaseCLI {
  protected setupCommands(): void {
    const workflowCmd = this.program.command("workflow").description("Manage workflows")
    workflowCmd
      .command("create")
      .description("Create a new workflow")
      .option("-i, --id <id>", "workflow id")
      .option("-n, --name <name>", "workflow name")
      .option("-a, --agent <agentId>", "single agent id for simple workflow")
      .action(async (options) => {
        const id = options.id || (options.name || "workflow").toLowerCase().replace(/\s+/g, "-")
        const wf = {
          id,
          name: options.name || id,
          steps: options.agent ? [{ id: "step-1", type: "agent", agentId: options.agent }] : [],
        }
        const fs = await import("fs/promises")
        const path = await import("path")
        const workflowsDir = path.join(process.cwd(), "workflows")
        await fs.mkdir(workflowsDir, { recursive: true })
        await fs.writeFile(path.join(workflowsDir, `${id}.json`), JSON.stringify(wf, null, 2))
        this.success(`Workflow created: ${id}`)
      })

    workflowCmd
      .command("create")
      .description("Create a new workflow")
      .option("-n, --name <name>", "workflow name")
      .option("-t, --template <template>", "workflow template")
      .action(async (options) => {
        await this.createWorkflow(options)
      })

    workflowCmd
      .command("list")
      .description("List all workflows")
      .option("-f, --format <format>", "output format (table|json)", "table")
      .action(async (options) => {
        await this.listWorkflows(options)
      })

    workflowCmd
      .command("run <workflowId>")
      .description("Run a workflow")
      .option("-i, --input <input>", "input data (JSON)")
      .option("-f, --file <file>", "input file")
      .action(async (workflowId, options) => {
        await this.runWorkflow(workflowId, options)
      })

    workflowCmd
      .command("validate <workflowId>")
      .description("Validate a workflow")
      .action(async (workflowId) => {
        await this.validateWorkflow(workflowId)
      })
  }

  private async createWorkflow(options: any): Promise<void> {
    const spinner = this.createSpinner("Creating workflow...")

    try {
      let config: any = {}

      if (options.template) {
        config = await this.createFromTemplate(options.template)
      } else {
        // Interactive mode
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Workflow name:",
            default: options.name,
            validate: (input) => input.length > 0 || "Name is required",
          },
          {
            type: "input",
            name: "description",
            message: "Workflow description:",
          },
          {
            type: "confirm",
            name: "parallel",
            message: "Enable parallel execution?",
            default: false,
          },
        ])

        config = {
          ...answers,
          id: answers.name.toLowerCase().replace(/\s+/g, "-"),
          steps: [],
        }

        // Add steps interactively
        let addMore = true
        while (addMore) {
          const stepAnswers = await inquirer.prompt([
            {
              type: "input",
              name: "id",
              message: "Step ID:",
              validate: (input) => input.length > 0 || "Step ID is required",
            },
            {
              type: "input",
              name: "name",
              message: "Step name:",
            },
            {
              type: "list",
              name: "type",
              message: "Step type:",
              choices: ["agent", "tool", "condition", "loop", "parallel"],
            },
          ])

          if (stepAnswers.type === "agent") {
            const { agentId } = await inquirer.prompt([
              {
                type: "input",
                name: "agentId",
                message: "Agent ID:",
                validate: (input) => input.length > 0 || "Agent ID is required",
              },
            ])
            stepAnswers.agentId = agentId
          }

          config.steps.push(stepAnswers)

          const { addAnother } = await inquirer.prompt([
            {
              type: "confirm",
              name: "addAnother",
              message: "Add another step?",
              default: false,
            },
          ])

          addMore = addAnother
        }
      }

      // Save workflow
      const workflowPath = join(process.cwd(), "workflows", `${config.id}.json`)
      await fs.mkdir(join(process.cwd(), "workflows"), { recursive: true })
      await fs.writeFile(workflowPath, JSON.stringify(config, null, 2))

      spinner.succeed()
      this.success(`Workflow created: ${config.name} (${config.id})`)
      this.info(`Configuration saved to: ${workflowPath}`)
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async createFromTemplate(template: string): Promise<any> {
    const templates = {
      "simple-chat": {
        name: "Simple Chat",
        description: "A simple chat workflow with one agent",
        steps: [
          {
            id: "chat",
            name: "Chat Response",
            type: "agent",
            agentId: "assistant",
          },
        ],
      },
      "multi-step": {
        name: "Multi-Step Analysis",
        description: "Multi-step analysis workflow",
        steps: [
          {
            id: "analyze",
            name: "Analyze Input",
            type: "agent",
            agentId: "analyzer",
          },
          {
            id: "summarize",
            name: "Summarize Results",
            type: "agent",
            agentId: "summarizer",
          },
        ],
      },
    }

    const templateConfig = templates[template as keyof typeof templates]
    if (!templateConfig) {
      throw new Error(`Unknown template: ${template}`)
    }

    return {
      id: template,
      ...templateConfig,
    }
  }

  private async listWorkflows(options: any): Promise<void> {
    try {
      const workflowsDir = join(process.cwd(), "workflows")

      try {
        await fs.access(workflowsDir)
      } catch {
        this.warn("No workflows directory found. Create a workflow first.")
        return
      }

      const files = await fs.readdir(workflowsDir)
      const workflowFiles = files.filter((f) => f.endsWith(".json"))

      if (workflowFiles.length === 0) {
        this.warn("No workflows found.")
        return
      }

      const workflows = []
      for (const file of workflowFiles) {
        const content = await fs.readFile(join(workflowsDir, file), "utf-8")
        const workflow = JSON.parse(content)
        workflows.push(workflow)
      }

      if (options.format === "json") {
        console.log(JSON.stringify(workflows, null, 2))
      } else {
        console.log("\nWorkflows:")
        console.log("─".repeat(80))
        workflows.forEach((workflow) => {
          console.log(`${workflow.name} (${workflow.id})`)
          console.log(`  Steps: ${workflow.steps?.length || 0}`)
          console.log(`  Parallel: ${workflow.parallel ? "Yes" : "No"}`)
          if (workflow.description) {
            console.log(`  Description: ${workflow.description}`)
          }
          console.log()
        })
      }
    } catch (error) {
      await this.handleError(error as Error)
    }
  }

  private async runWorkflow(workflowId: string, options: any): Promise<void> {
    const spinner = this.createSpinner("Running workflow...")

    try {
      // This would implement actual workflow execution
      // For now, we'll simulate it
      spinner.text = "Loading workflow configuration..."

      const workflowPath = join(process.cwd(), "workflows", `${workflowId}.json`)
      const workflowConfig = JSON.parse(await fs.readFile(workflowPath, "utf-8"))

      let input: any = {}
      if (options.input) {
        input = JSON.parse(options.input)
      } else if (options.file) {
        const inputContent = await fs.readFile(options.file, "utf-8")
        input = JSON.parse(inputContent)
      } else {
        const { inputData } = await inquirer.prompt([
          {
            type: "input",
            name: "inputData",
            message: "Input data (JSON):",
            default: "{}",
          },
        ])
        input = JSON.parse(inputData)
      }

      spinner.text = "Executing workflow..."

      // Simulate workflow execution
      await new Promise((resolve) => setTimeout(resolve, 2000))

      spinner.succeed()
      this.success(`Workflow completed: ${workflowId}`)
      console.log("Result:", { status: "completed", input, steps: workflowConfig.steps?.length || 0 })
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async validateWorkflow(workflowId: string): Promise<void> {
    const spinner = this.createSpinner("Validating workflow...")

    try {
      const workflowPath = join(process.cwd(), "workflows", `${workflowId}.json`)
      const workflowConfig = JSON.parse(await fs.readFile(workflowPath, "utf-8"))

      // Basic validation
      const errors: string[] = []

      if (!workflowConfig.id) errors.push("Missing workflow ID")
      if (!workflowConfig.name) errors.push("Missing workflow name")
      if (!workflowConfig.steps || !Array.isArray(workflowConfig.steps)) {
        errors.push("Missing or invalid steps array")
      } else {
        workflowConfig.steps.forEach((step: any, index: number) => {
          if (!step.id) errors.push(`Step ${index}: Missing step ID`)
          if (!step.type) errors.push(`Step ${index}: Missing step type`)
          if (step.type === "agent" && !step.agentId) {
            errors.push(`Step ${index}: Missing agent ID for agent step`)
          }
        })
      }

      spinner.succeed()

      if (errors.length === 0) {
        this.success(`Workflow validation passed: ${workflowId}`)
      } else {
        this.error(`Workflow validation failed: ${workflowId}`)
        errors.forEach((error) => {
          console.log(`  - ${error}`)
        })
      }
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }
}
