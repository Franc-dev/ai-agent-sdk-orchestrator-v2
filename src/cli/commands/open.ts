import { join } from "path"
import open from "open"
import { BaseCLI } from "./base"

export class OpenCLI extends BaseCLI {
  protected setupCommands(): void {
    this.program
      .command("open")
      .description("Open docs, repo, or project folders in default app")
      .option("--docs", "open documentation website")
      .option("--repo", "open GitHub repository")
      .option("--project", "open current project folder")
      .option("--agents", "open agents folder")
      .option("--workflows", "open workflows folder")
      .option("--plugins", "open plugins folder")
      .option("--logs", "open logs folder")
      .option("--url <url>", "open an arbitrary URL")
      .option("--path <path>", "open an arbitrary path")
      .action(async (options) => {
        await this.handleOpen(options)
      })
  }

  private async handleOpen(options: any): Promise<void> {
    try {
      // Priority: explicit url/path → specific flags → default
      if (options.url) {
        await open(String(options.url))
        this.success(`Opened URL`)
        return
      }

      if (options.path) {
        const target = String(options.path)
        await open(target)
        this.success(`Opened: ${target}`)
        return
      }

      if (options.docs) {
        await open("https://github.com/Franc-dev/ai-agent-sdk-orchestrator-v2#readme")
        this.success("Opened docs")
        return
      }

      if (options.repo) {
        await open("https://github.com/Franc-dev/ai-agent-sdk-orchestrator-v2")
        this.success("Opened repository")
        return
      }

      const cwd = process.cwd()

      if (options.project) {
        await open(cwd)
        this.success("Opened project folder")
        return
      }

      if (options.agents) {
        await open(join(cwd, "agents"))
        this.success("Opened agents folder")
        return
      }

      if (options.workflows) {
        await open(join(cwd, "workflows"))
        this.success("Opened workflows folder")
        return
      }

      if (options.plugins) {
        await open(join(cwd, "plugins"))
        this.success("Opened plugins folder")
        return
      }

      if (options.logs) {
        await open(join(cwd, "logs"))
        this.success("Opened logs folder")
        return
      }

      // Default: show quick help summary
      this.info("Nothing to open. Try one of: --docs --repo --project --agents --workflows --plugins --logs --url --path")
    } catch (error) {
      await this.handleError(error as Error)
    }
  }
}


