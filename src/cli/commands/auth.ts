import { promises as fs } from "fs"
import { join } from "path"
import { BaseCLI } from "./base"

export class AuthCLI extends BaseCLI {
  protected setupCommands(): void {
    const auth = this.program.command("auth").description("Manage API keys for providers")

    auth
      .command("set-openrouter <apiKey>")
      .description("Set OPENROUTER_API_KEY in .env")
      .option("-p, --path <envPath>", "path to .env file", ".env")
      .action(async (apiKey: string, options) => {
        await this.setEnvKey("OPENROUTER_API_KEY", apiKey, options.path)
      })

    auth
      .command("show")
      .description("Show configured API keys status")
      .option("-p, --path <envPath>", "path to .env file", ".env")
      .action(async (options) => {
        await this.showStatus(options.path)
      })
  }

  private async setEnvKey(key: string, value: string, envPath: string): Promise<void> {
    const spinner = this.createSpinner(`Saving ${key}...`)
    const fullPath = join(process.cwd(), envPath)
    try {
      let content = ""
      try {
        content = await fs.readFile(fullPath, "utf-8")
      } catch {
        // create a fresh .env from example if present
        try {
          const example = await fs.readFile(join(process.cwd(), ".env.example"), "utf-8")
          content = example
        } catch {
          content = ""
        }
      }

      const lines = content.split(/\r?\n/)
      let found = false
      const newLines = lines.map((line) => {
        if (line.trim().startsWith(`${key}=`)) {
          found = true
          return `${key}=${value}`
        }
        return line
      })
      if (!found) newLines.push(`${key}=${value}`)

      await fs.writeFile(fullPath, newLines.join("\n"))
      spinner.succeed()
      this.success(`${key} saved to ${envPath}`)
    } catch (error) {
      await this.handleError(error as Error, spinner)
    }
  }

  private async showStatus(envPath: string): Promise<void> {
    try {
      const fullPath = join(process.cwd(), envPath)
      let content = ""
      try {
        content = await fs.readFile(fullPath, "utf-8")
      } catch {
        this.warn(`${envPath} not found`)
        return
      }
      const env: Record<string, string> = {}
      content.split(/\r?\n/).forEach((line) => {
        const idx = line.indexOf("=")
        if (idx > 0) {
          const k = line.slice(0, idx).trim()
          const v = line.slice(idx + 1)
          env[k] = v
        }
      })
      const openrouter = env.OPENROUTER_API_KEY
      const masked = openrouter ? `${openrouter.slice(0, 4)}****${openrouter.slice(-4)}` : "not set"
      console.log("\nAuth Status:")
      console.log("─".repeat(40))
      console.log(`OPENROUTER_API_KEY: ${masked}`)
    } catch (error) {
      await this.handleError(error as Error)
    }
  }
}


