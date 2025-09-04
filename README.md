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

Initialize a project:

```bash
npx ai-agent-sdk-orchestrator init my-ai-project
cd my-ai-project
```

Agents and workflows:

```bash
# Create an agent interactively
ai-agent agent create

# List agents
ai-agent agent list

# Run a workflow (expects ./workflows/<id>.json)
ai-agent run <workflowId> --input '{"message":"Hello"}'
```

## Programmatic usage

```ts
import { AgentOrchestrator, Agent, Workflow } from "ai-agent-sdk-orchestrator"

// Create orchestrator
const orchestrator = new AgentOrchestrator({ logLevel: "info" })

// Create agent
const agent = new Agent({
  id: "assistant",
  name: "AI Assistant",
  model: {
    provider: "openrouter",
    model: "anthropic/claude-3.5-sonnet",
    apiKey: process.env.OPENROUTER_API_KEY!,
    fallbackModels: [
      "mistralai/mistral-7b-instruct:free",
      "mistralai/mistral-small-3.2-24b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ],
  },
})

// Register agent
orchestrator.registerAgent(agent)

// Create and register workflow
const workflow = new Workflow({
  id: "chat",
  name: "Chat Workflow",
  steps: [{ id: "respond", type: "agent", agentId: "assistant" }],
})

orchestrator.registerWorkflow(workflow)

// Execute
const result = await orchestrator.execute("chat", { message: "Hello!" })
console.log(result.variables.respond)
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
