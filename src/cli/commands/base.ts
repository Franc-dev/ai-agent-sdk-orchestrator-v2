import type { Command } from "commander"
import chalk from "chalk"
import ora from "ora"
import { Logger } from "../../observability/logger"

export abstract class BaseCLI {
  protected program: Command
  protected logger: Logger

  constructor(program: Command) {
    this.program = program
    this.logger = new Logger({ level: "info", enableConsole: false })
    this.setupCommands()
  }

  protected abstract setupCommands(): void

  protected createSpinner(text: string) {
    return ora({
      text,
      color: "blue",
    })
  }

  protected success(message: string): void {
    console.log(chalk.green("✓"), message)
  }

  protected error(message: string): void {
    console.log(chalk.red("✗"), message)
  }

  protected warn(message: string): void {
    console.log(chalk.yellow("⚠"), message)
  }

  protected info(message: string): void {
    console.log(chalk.blue("ℹ"), message)
  }

  protected async handleError(error: Error, spinner?: any): Promise<void> {
    if (spinner) {
      spinner.fail()
    }
    this.error(error.message)
    if (this.program.opts().verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}
