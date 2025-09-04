# Getting Started

Follow these steps to install, configure, and run your first workflow.

## 1. Install the package

```bash
npm install ai-agent-sdk-orchestrator
```

## 2. Initialize a project (CLI)

```bash
npx ai-agent init my-ai-project
cd my-ai-project
```

## 3. Configure environment

Copy env template and add your keys:

```bash
cp .env.example .env
```

Set required variables in `.env`:
```
OPENROUTER_API_KEY=your_openrouter_api_key
OPENAI_API_KEY=your_openai_api_key
```

## 4. Create an agent (CLI)

```bash
ai-agent agent create --name "Assistant" --model "anthropic/claude-3-sonnet"
```

## 5. Create a workflow (CLI)

```bash
ai-agent workflow create --template simple-chat
```

## 6. Run the workflow (CLI)

```bash
ai-agent run simple-chat --input '{"message": "Hello!"}'
```

## Programmatic usage

```typescript
import { AgentOrchestrator, Agent, Workflow } from 'ai-agent-sdk-orchestrator'

// Create orchestrator
const orchestrator = new AgentOrchestrator()

// Create agent
const agent = new Agent({
  id: 'assistant',
  name: 'AI Assistant',
  model: {
    provider: 'openrouter',
    model: 'anthropic/claude-3-sonnet',
    apiKey: process.env.OPENROUTER_API_KEY
  }
})

// Register agent
orchestrator.registerAgent(agent)

// Create and register workflow
const workflow = new Workflow({
  id: 'chat',
  name: 'Chat Workflow',
  steps: [
    { id: 'respond', type: 'agent', agentId: 'assistant' }
  ]
})

orchestrator.registerWorkflow(workflow)

// Execute
const result = await orchestrator.execute('chat', { message: 'Hello!' })
console.log(result.variables.respond)
```

## Next steps

- Agent Configuration: `docs/agents.md`
- Workflow Design: `docs/workflows.md`
- Plugin Development: `docs/plugins.md`
- Model Providers: `docs/providers.md`
