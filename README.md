# Documentation

Use this section to explore concepts, guides, and API references for AI Agent SDK Orchestrator.

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

The examples use OpenRouter and include fallbacks to free Mistral models:

```
mistralai/mistral-7b-instruct:free
mistralai/mistral-small-3.2-24b-instruct:free
mistralai/mistral-small-3.1-24b-instruct:free
```

### Example Output Screenshots

Screenshots of typical outputs are available under `public/examples/` and embedded below:

<p align="center"><img src="/basic.png" alt="Basic Workflow" /></p>

<p align="center"><strong>Multi-Model Pipeline</strong></p>
<p align="center"><img src="/multi-model-1.png" alt="Multi-Model (1)" /></p>
<p align="center"><img src="/multi-model-2.png" alt="Multi-Model (2)" /></p>
<p align="center"><img src="/examples/multi-model-3.png" alt="Multi-Model (3)" /></p>

<p align="center"><img src="./public/examples/stream.png" alt="Streaming Responses" /></p>

<p align="center"><img src="/tools.png" alt="Custom Tools" /></p>

## Reference

- Agents: `docs/agents.md`
- Workflows: `docs/workflows.md`
- Providers: `docs/providers.md`
- Plugins: `docs/plugins.md`
- API Reference: `docs/api.md`
