# Getting Started with AI Agent SDK Orchestrator

## Installation

\`\`\`bash
npm install ai-agent-sdk-orchestrator
\`\`\`

## Quick Start

### 1. Initialize a Project

\`\`\`bash
npx ai-agent init my-ai-project
cd my-ai-project
\`\`\`

### 2. Configure Environment

Copy `.env.example` to `.env` and add your API keys:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env`:
\`\`\`
OPENROUTER_API_KEY=your_openrouter_api_key
OPENAI_API_KEY=your_openai_api_key
\`\`\`

### 3. Create Your First Agent

\`\`\`bash
ai-agent agent create --name "Assistant" --model "anthropic/claude-3-sonnet"
\`\`\`

### 4. Create a Workflow

\`\`\`bash
ai-agent workflow create --template simple-chat
\`\`\`

### 5. Run the Workflow

\`\`\`bash
ai-agent run simple-chat --input '{"message": "Hello!"}'
\`\`\`

## Programmatic Usage

\`\`\`typescript
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
  steps: [{
    id: 'respond',
    type: 'agent',
    agentId: 'assistant'
  }]
})

orchestrator.registerWorkflow(workflow)

// Execute
const result = await orchestrator.execute('chat', {
  message: 'Hello!'
})

console.log(result.variables.respond)
\`\`\`

## Next Steps

- [Agent Configuration](./agents.md)
- [Workflow Design](./workflows.md)
- [Plugin Development](./plugins.md)
- [Model Providers](./providers.md)
