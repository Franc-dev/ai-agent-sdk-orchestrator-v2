# AI Agent SDK Orchestrator

TypeScript SDK and CLI for building robust AI agent workflows with OpenRouter.

## Powered by OpenRouter

This project is powered by OpenRouter for model access and routing. You can create a free account and get an API key from [OpenRouter](https://openrouter.ai). OpenRouter provides free daily credits (typically up to 50 credits/day) which are sufficient to run the included examples.

## Guides

- Getting Started: `docs/getting-started.md`

## Running the Examples

All examples load environment variables from `.env` automatically via the npm scripts.

1) Create `.env` in the project root:

```
OPENROUTER_API_KEY=your_openrouter_api_key
```

If you don't have an API key yet, sign up at [OpenRouter](https://openrouter.ai) to obtain one. Accounts include free daily credits (usually 50/day) for testing.

2) Run examples:

```bash
npm run example:basic        # Simple single-agent workflow
npm run example:multi-model  # Multi-agent, multi-model pipeline
npm run example:stream       # Streaming responses to stdout
npm run example:tools        # Custom tools demonstration
```

## CLI Usage

The package ships with a CLI `ai-agent`.

Install globally (optional):

```bash
npm i -g ai-agent-sdk-orchestrator
```

Or use npx locally:

```bash
npx ai-agent-sdk-orchestrator@latest --help
```

Initialize a project (use the project subcommand):

```bash
# via npx
npx ai-agent-sdk-orchestrator project init my-ai-project
cd my-ai-project

# or if installed globally
ai-agent project init my-ai-project
```

Notes:

- The positional value `my-ai-project` is used as the default for `--name` during the interactive prompt. Press Enter to accept it.
 
Open common resources quickly:

```bash
# Open docs or repo in your default browser
ai-agent open --docs
ai-agent open --repo

# Open project folders in your OS file manager
ai-agent open --project
ai-agent open --agents
ai-agent open --workflows
ai-agent open --plugins
ai-agent open --logs

# Open any URL or path
ai-agent open --url https://example.com
ai-agent open --path C:\\some\\folder
```

Authenticate providers (set API keys):

```bash
# Set OpenRouter API key into .env at project root
ai-agent auth set-openrouter sk-or-v1-...

# Show configured keys (masked)
ai-agent auth show
```

### Workflows via CLI

Tip: create agents first so you can reference their IDs in steps:

```bash
ai-agent agent create
```

Create a simple workflow (single agent):

```bash
ai-agent workflow create --id chat --name "Chat" --agent assistant
# creates workflows/chat.json with a single agent step using agentId "assistant"
```

Interactive workflow builder (multiple steps):

```bash
ai-agent workflow create
# Prompts for: name/description/parallel → add steps repeatedly
# Step types: agent, tool, condition, loop, parallel
# For agent step you’ll be asked for agentId (e.g., "assistant")
# Saves to workflows/<generated-id>.json
```

List workflows:

```bash
ai-agent workflow list
```

Validate a workflow file:

```bash
ai-agent workflow validate chat
```

Run a workflow:

```bash
ai-agent run chat --input '{"message":"Hello"}'
# Expects ./workflows/chat.json and referenced agents to exist
```

JSON quoting on different shells:

```bash
# PowerShell
ai-agent run chat --input "{\"message\":\"Hello\"}"

# Windows CMD
ai-agent run chat --input "{""message"":""Hello""}"

# Git Bash / WSL / macOS/Linux shells
ai-agent run chat --input '{"message":"Hello"}'

# Or use a file
echo {"message":"Hello"} > input.json
ai-agent run chat --file input.json
```

 
Agents and workflows:

```bash
# Create an agent interactively
ai-agent agent create

# List agents
ai-agent agent list

# Show an agent's details (ID, model, etc.)
ai-agent agent show <agentId>

# Run a workflow (expects ./workflows/<id>.json)
ai-agent run <workflowId> --input '{"message":"Hello"}'  # see JSON quoting notes below

# Show a workflow's details (ID, name, steps)
ai-agent workflow show <workflowId>
```

Examples for a workflow id `fire-coding`:

```bash
# PowerShell
ai-agent run fire-coding --input "{\"message\":\"hello fire code\"}"

# Windows CMD
ai-agent run fire-coding --input "{""message"":""hello fire code""}"

# Git Bash / WSL / macOS/Linux shells
ai-agent run fire-coding --input '{"message":"hello fire code"}'

# Using a file (works everywhere)
echo {"message":"hello fire code"} > input.json
ai-agent run fire-coding --file input.json
```

Multi-step workflow file example (`workflows/fire-coding.json`):

```json
{
  "id": "fire-coding",
  "name": "Fire Coding",
  "steps": [
    { "id": "analyze", "type": "agent", "agentId": "fire-coder" },
    { "id": "plan", "type": "agent", "agentId": "fire-coder" },
    { "id": "implement", "type": "agent", "agentId": "fire-coder" }
  ]
}
```

## Install and Upgrade

Install from npm registry:

```bash
# project-local (recommended)
npm i ai-agent-sdk-orchestrator@latest

# or install the CLI globally
npm i -g ai-agent-sdk-orchestrator@latest
```

Install directly from a GitHub branch/tag (useful for testing diffs with main):

```bash
# main branch
npm i github:Franc-dev/ai-agent-sdk-orchestrator-v2#main

# a feature branch or tag
npm i github:Franc-dev/ai-agent-sdk-orchestrator-v2#my-branch
npm i github:Franc-dev/ai-agent-sdk-orchestrator-v2#v1.0.3
```

If upgrade seems stuck, clear cache and reinstall:

```bash
npm cache verify
npm cache clean --force
rm -rf node_modules package-lock.json
npm i
```

## Programmatic usage

```ts
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-env node */
/* global console, process, require, module */
import { config } from "dotenv";
import { AgentOrchestrator, Agent, Workflow } from "ai-agent-sdk-orchestrator";
import chalk from "chalk";

// Load environment variables from .env file
config();


// --- Main Application Logic ---
async function main() {
  console.log(chalk.cyan("🚀 Initializing Simplified AI Workflow Orchestrator"));
  console.log(chalk.gray("=".repeat(60)));

  // --- 1. CREATE THE ORCHESTRATOR ---
  const orchestrator = new AgentOrchestrator({ logLevel: "info" });

  // --- 2. DEFINE ORIGINAL AGENTS ---
  const creativeWriterAgent = new Agent({
    id: "creative-writer",
    name: "Creative Story Writer",
    model: {
      provider: "openrouter",
      model: "openai/gpt-4o",
      apiKey: process.env.OPENROUTER_API_KEY!,
      fallbackModels: ["mistralai/mistral-7b-instruct:free"],
    },
    systemPrompt: "You are a world-class short story author. Write a compelling and imaginative story based on the user's topic. The story should have a clear beginning, middle, and end.",
    temperature: 0.8,
  });

  const summarizerAgent = new Agent({
    id: "summarizer",
    name: "Story Summarizer",
    model: {
      provider: "openrouter",
      model: "meta-llama/llama-3.1-8b-instruct",
      apiKey: process.env.OPENROUTER_API_KEY!,
      fallbackModels: ["mistralai/mistral-7b-instruct:free"],
    },
    systemPrompt: "You are a text summarization expert. Take the provided story and create a concise, one-paragraph summary.",
    temperature: 0.2,
  });

  const sentimentAnalyzerAgent = new Agent({
    id: "sentiment-analyzer",
    name: "Sentiment Analyzer",
    model: {
      provider: "openrouter",
      model: "google/gemma-7b-it:free",
      apiKey: process.env.OPENROUTER_API_KEY!,
    },
    systemPrompt: "Analyze the sentiment of the provided story. Respond with only a single word: Positive, Negative, or Neutral.",
    temperature: 0.1,
  });


  // --- 3. REGISTER AGENTS ---
  console.log("Registering agents...");
  orchestrator.registerAgent(creativeWriterAgent);
  orchestrator.registerAgent(summarizerAgent);
  orchestrator.registerAgent(sentimentAnalyzerAgent);
  console.log("Agents registered successfully.");

  // --- 4. CREATE THE WORKFLOW (SIMPLIFIED) ---
  const workflow = new Workflow({
    id: "creative-analysis-workflow",
    name: "Creative Writing and Analysis Workflow",
    description: "Generates a story, then summarizes it and analyzes its sentiment.",
    steps: [
      {
        id: "generate_story",
        name: "Generate Story",
        type: "agent",
        agentId: "creative-writer",
        // No 'params' needed; it will receive the initial input from orchestrator.execute()
      },
      {
        id: "summarize_story",
        name: "Summarize Story",
        type: "agent",
        agentId: "summarizer",
         // No 'params' needed; it will automatically receive the output from the previous step
      },
      {
        id: "analyze_sentiment",
        name: "Analyze Sentiment",
        type: "agent",
        agentId: "sentiment-analyzer",
        // This step is tricky without explicit input mapping. It will likely receive
        // the output from 'summarize_story'. To analyze the ORIGINAL story, a more
        // complex workflow structure would be needed if the package supports it.
        // For now, we will let it analyze the summary.
      },
    ],
  });

  orchestrator.registerWorkflow(workflow);
  console.log("Workflow registered successfully.");


  // --- 5. EXECUTE THE WORKFLOW ---
  const topic = "An astronaut who finds a mysterious, glowing plant on Mars.";
  
  console.log(chalk.blue(`\nProcessing topic through the creative pipeline...`));
  console.log(chalk.bold("Initial Topic:"), topic);
  
  const startTime = Date.now();
  try {
    // The 'topic' object key must match the expected input of the first agent.
    // Let's assume the agent expects a 'message' property.
    const result = await orchestrator.execute("creative-analysis-workflow", {
      message: topic,
    });
    const totalTime = Date.now() - startTime;

    console.log("\n" + chalk.green("📊 Final Results:"));
    console.log(chalk.gray("─".repeat(60)));

    console.log("\n" + chalk.yellow("📖 Generated Story:"));
    console.log(result.variables.generate_story);

    console.log("\n" + chalk.yellow("📝 Summary of Story:"));
    console.log(result.variables.summarize_story);

    console.log("\n" + chalk.yellow("🎭 Sentiment of Summary:"));
    console.log(result.variables.analyze_sentiment);

    console.log("\n" + chalk.green("📈 Execution Metrics:"));
    console.log(chalk.gray("─".repeat(30)));
    console.log(chalk.bold("Total time:"), totalTime, "ms");
    console.log(chalk.bold("Steps executed:"), result.history.length);

    result.history.forEach((step, i) => {
      console.log(`${i + 1}. ${step.stepId}: ${step.duration}ms`);
    });

  } catch (error) {
    console.error("\n" + chalk.red("An error occurred during workflow execution:"), error);
  } finally {
    await orchestrator.shutdown();
    console.log(chalk.cyan("\nOrchestrator shut down."));
  }
}

// Run the main function
main().catch(console.error);
```

The examples use OpenRouter and include fallbacks to free Mistral models:

```
mistralai/mistral-7b-instruct:free
mistralai/mistral-small-3.2-24b-instruct:free
mistralai/mistral-small-3.1-24b-instruct:free
```

### Example Output Screenshots

Screenshots of typical outputs are available under `public/examples/` and embedded below:

<p align="center"><strong>Basic Workflow</strong></p>
<p align="center"><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1756980268/blog-images/mmxzxelwcpr561coepig.png" alt="Basic Workflow" /></p>

<p align="center"><strong>Multi-Model Pipeline</strong></p>
<p align="center"><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1756980141/blog-images/t5iheajafwgzxvycpnsz.png" alt="Multi-Model (1)" /></p>
<p align="center"><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1756980189/blog-images/jr1fnbwm783vgcebkbly.png" alt="Multi-Model (2)" /></p>
<p align="center"><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1756980209/blog-images/jlphps6njtizihbaf6n5.png" alt="Multi-Model (3)" /></p>

<p align="center"><strong>Stream Workflow</strong></p>
<p align="center"><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1756980228/blog-images/iqspgqrsidv0g2nrodnl.png" alt="Streaming Responses" /></p>

<p align="center"><strong>Custom Tools Workflow</strong></p>
<p align="center"><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1756980250/blog-images/j3r5rvq5xpe175xi9kez.png" alt="Custom Tools" /></p>

## Reference

- Agents: `docs/agents.md`
- Workflows: `docs/workflows.md`
- Providers: `docs/providers.md`
- Plugins: `docs/plugins.md`
- API Reference: `docs/api.md`
