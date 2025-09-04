import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: "node18",
  splitting: false,
  treeshake: true,
  external: ["@ai-sdk/openai", "openai"],
  banner: {
    js: "#!/usr/bin/env node",
  },
})
