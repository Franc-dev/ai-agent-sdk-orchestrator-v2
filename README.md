# AI Agent SDK Orchestrator

Robust TypeScript SDK for building AI agent workflows with multi-model support, orchestration, observability, and plugins.

## Features

- 🤖 **Multi-model providers**: OpenRouter, Vercel AI Gateway, OpenAI, and custom
- 🔄 **Workflow orchestration**: Sequential and parallel step execution
- 🛠️ **Tool integration**: Built-in and custom tools
- 📊 **Observability**: Structured logs, tracing, metrics
- 🔌 **Plugin system**: Extensible architecture
- ⚡ **Streaming**: Real-time token streams
- 🔁 **Retries**: Configurable backoff strategies
- 🎯 **Type safety**: Strict TypeScript types

## Installation

```bash
npm install ai-agent-sdk-orchestrator
```

## Quick start

```typescript
import { AgentOrchestrator, Agent, Workflow } from 'ai-agent-sdk-orchestrator'

// Create an orchestrator
const orchestrator = new AgentOrchestrator({ logLevel: 'info' })

// Define an agent
const agent = new Agent({
  id: 'assistant',
  name: 'AI Assistant',
  model: {
    provider: 'openrouter',
    model: 'anthropic/claude-3-sonnet',
    apiKey: process.env.OPENROUTER_API_KEY
  },
  systemPrompt: 'You are a helpful AI assistant.'
})

// Create a workflow
const workflow = new Workflow({
  id: 'simple-chat',
  name: 'Simple Chat Workflow',
  steps: [
    { id: 'respond', name: 'Generate Response', type: 'agent', agentId: 'assistant' }
  ]
})

// Register and execute
orchestrator.registerAgent(agent)
orchestrator.registerWorkflow(workflow)

const result = await orchestrator.execute('simple-chat', { message: 'Hello, how are you?' })
console.log(result.output)
```

## CLI usage

After installing, the CLI is available as `ai-agent`.

```bash
ai-agent --help
```

Common scripts in this repo:

```bash
npm run build
npm run dev
npm test
```

## Examples

- `examples/basic-workflow.ts`
- `examples/multi-model-agent.ts`
- `examples/streaming-responses.ts`

Run an example:

```bash
npm run example:basic
```

## Documentation

- Getting Started: `docs/getting-started.md`

## Contributing

Issues and PRs are welcome. Please run lint and tests before submitting:

```bash
npm run lint && npm run type-check && npm test
```

## License

MIT


