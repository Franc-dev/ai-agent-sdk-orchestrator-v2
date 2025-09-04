# AI Agent SDK Orchestrator

A comprehensive TypeScript SDK for building robust AI agent workflows with multi-model support, logging, and orchestration capabilities.

## Features

- 🤖 **Multi-Model Support** - OpenRouter, Vercel AI Gateway, OpenAI, and custom providers
- 🔄 **Workflow Orchestration** - Sequential and parallel step execution
- 🛠️ **Tool Integration** - Built-in and custom tool support
- 📊 **Advanced Logging** - Comprehensive execution tracking and observability
- 🔌 **Plugin System** - Extensible architecture for custom functionality
- ⚡ **Streaming Support** - Real-time response streaming
- 🔄 **Retry Logic** - Configurable retry mechanisms with backoff
- 🎯 **Type Safety** - Full TypeScript support with strict typing

## Installation

\`\`\`bash
npm install ai-agent-sdk-orchestrator
\`\`\`

## Quick Start

\`\`\`typescript
import { AgentOrchestrator, Agent, Workflow } from 'ai-agent-sdk-orchestrator'

// Create an orchestrator
const orchestrator = new AgentOrchestrator({
  logLevel: 'info'
})

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
    {
      id: 'respond',
      name: 'Generate Response',
      type: 'agent',
      agentId: 'assistant'
    }
  ]
})

// Register and execute
orchestrator.registerAgent(agent)
orchestrator.registerWorkflow(workflow)

const result = await orchestrator.execute('simple-chat', {
  message: 'Hello, how are you?'
})

console.log(result.output)
\`\`\`

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Agent Configuration](./docs/agents.md)
- [Workflow Design](./docs/workflows.md)
- [Model Providers](./docs/providers.md)
- [Plugin Development](./docs/plugins.md)
- [API Reference](./docs/api.md)

## License

MIT
