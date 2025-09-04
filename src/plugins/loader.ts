import { promises as fs } from "fs"
import { join, extname } from "path"
import type { BasePlugin, PluginConstructor } from "./base"
import { PluginRegistry } from "./registry"

export interface LoaderConfig {
  searchPaths: string[]
  fileExtensions: string[]
  enableCache: boolean
}

export class PluginLoader {
  private config: LoaderConfig
  private loadedModules = new Map<string, any>()

  constructor(config: Partial<LoaderConfig> = {}) {
    this.config = {
      searchPaths: config.searchPaths || ["./plugins", "./node_modules"],
      fileExtensions: config.fileExtensions || [".js", ".ts"],
      enableCache: config.enableCache ?? true,
    }
  }

  async loadPlugin(nameOrPath: string, config?: any): Promise<BasePlugin> {
    let pluginModule: any

    // Try to load from registry first
    if (PluginRegistry.has(nameOrPath)) {
      return PluginRegistry.create(nameOrPath, config)
    }

    // Try to load from file system
    try {
      pluginModule = await this.loadModule(nameOrPath)
    } catch (err: unknown) {
      // Try to find plugin in search paths
      pluginModule = await this.findAndLoadPlugin(nameOrPath)
    }

    if (!pluginModule) {
      throw new Error(`Plugin not found: ${nameOrPath}`)
    }

    // Extract plugin constructor
    const PluginConstructor = this.extractPluginConstructor(pluginModule)
    if (!PluginConstructor) {
      throw new Error(`Invalid plugin module: ${nameOrPath}`)
    }

    // Register plugin if not already registered
    const meta = PluginConstructor.metadata
    const name = meta?.name || (PluginConstructor as any).name
    if (!PluginRegistry.has(name)) {
      PluginRegistry.register(PluginConstructor)
    }

    return new PluginConstructor(config)
  }

  async loadPluginsFromDirectory(directory: string): Promise<BasePlugin[]> {
    const plugins: BasePlugin[] = []

    try {
      const files = await fs.readdir(directory)

      for (const file of files) {
        const filePath = join(directory, file)
        const stat = await fs.stat(filePath)

        if (stat.isFile() && this.isSupportedFile(file)) {
          try {
            const plugin = await this.loadPlugin(filePath)
            plugins.push(plugin)
          } catch (err: unknown) {
            const error = err as Error
            console.warn(`Failed to load plugin from ${filePath}:`, error?.message || err)
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error
      console.warn(`Failed to read plugin directory ${directory}:`, error?.message || err)
    }

    return plugins
  }

  private async loadModule(path: string): Promise<any> {
    if (this.config.enableCache && this.loadedModules.has(path)) {
      return this.loadedModules.get(path)
    }

    // In a real implementation, this would use dynamic imports
    // For now, we'll simulate module loading
    const module = await this.simulateModuleLoad(path)

    if (this.config.enableCache) {
      this.loadedModules.set(path, module)
    }

    return module
  }

  private async simulateModuleLoad(path: string): Promise<any> {
    // This is a placeholder for actual module loading
    // In a real implementation, you would use:
    // return await import(path)
    throw new Error(`Module loading not implemented: ${path}`)
  }

  private async findAndLoadPlugin(name: string): Promise<any> {
    for (const searchPath of this.config.searchPaths) {
      for (const ext of this.config.fileExtensions) {
        const pluginPath = join(searchPath, `${name}${ext}`)

        try {
          await fs.access(pluginPath)
          return await this.loadModule(pluginPath)
        } catch {
          // Continue searching
        }
      }
    }

    return null
  }

  private extractPluginConstructor(module: any): PluginConstructor | null {
    // Try different export patterns
    if (module.default && module.default.metadata) {
      return module.default
    }

    if (module.metadata) {
      return module
    }

    // Look for exported classes with metadata
    for (const [key, value] of Object.entries(module)) {
      if (typeof value === "function" && (value as any).metadata) {
        return value as PluginConstructor
      }
    }

    return null
  }

  private isSupportedFile(filename: string): boolean {
    const ext = extname(filename)
    return this.config.fileExtensions.includes(ext)
  }

  clearCache(): void {
    this.loadedModules.clear()
  }
}
