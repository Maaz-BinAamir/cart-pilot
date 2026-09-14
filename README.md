# Cart Pilot

Cart Pilot is a demo electronics storefront with a real Groq-backed shopping agent. The model searches and compares a 72-product fictional catalog through trusted commerce tools. It cannot invent live prices or stock, and it cannot place an order without the shopper approving the checkout card.

## Run it

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `GROQ_API_KEY` in `.env.local`.
4. Run `npm run dev` and open `http://localhost:3000`.

The default model is `qwen/qwen3.8-27b`. Change `GROQ_MODEL` if the model is unavailable or Groq replaces the preview.

Without an API key, the catalog and `/admin` simulation controls remain usable. Chat stays disabled instead of falling back to scripted responses.

## Demo flow

- Ask for a product using a budget, intended use, and delivery deadline.
- Compare the shortlist and ask about synthetic reviews or specifications.
- Request a purchase. Cart Pilot checks the current price, stock, and delivery estimate before presenting an approval card.
- Approve the simulated checkout, then track or cancel the order in the same conversation.
- Open `/admin` in the same tab to sell out a product, move its price, slow shipping, or delay an existing order.
- Return to the shopper conversation and ask Cart Pilot to check again.

## Trusted boundary

The [domain glossary](./CONTEXT.md) defines the project language. [ADR 0001](./docs/adr/0001-model-directed-tool-controlled-commerce.md) records why the language model directs tools but never owns commerce facts or mutations.

The agent uses the current AI SDK `ToolLoopAgent`, `createAgentUIStream`, `useChat`, and tool approval APIs. Groq credentials stay in the server environment.

## Demo sessions

Orders, inventory changes, and chat history belong to the current tab and use browser sessionStorage. Refreshing the tab retains the demo. A fresh tab starts separately; browser tab duplication or session restoration can copy or restore a session. Use Reset demo in Admin to clear orders, inventory changes, and chat together. New chat clears only the conversation.

Each request validates the submitted demo snapshot and creates an isolated store. Successful checkout and cancellation tools stream the updated snapshot to the browser before their result. No database, server memory shared between requests, or extra environment variables are required on Vercel.

This is intentionally an editable, simulated browser session, not an authenticated commerce system. Do not use its snapshots for real payments or fulfillment. If sessionStorage is unavailable, state lasts only until the current page reloads.

## Checks

```text
npm test
npm run typecheck
npm run lint
npm run build
```

