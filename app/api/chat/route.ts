import { groq } from "@ai-sdk/groq";
import {
  createAgentUIStreamResponse,
  stepCountIs,
  tool,
  ToolLoopAgent,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  cancelOrder,
  checkInventory,
  compareProducts,
  getOrder,
  getProduct,
  listOrders,
  placeOrder,
  searchProducts,
} from "@/src/lib/store";

import { prepareChatHistory } from "@/src/lib/chat-history";

export const maxDuration = 60;

const categories = ["Laptops", "Audio", "Phones", "Gaming", "Cameras", "Accessories"] as const;

const systemPrompt = `You are Cart Pilot, a concise and careful personal shopping agent for a fictional electronics store.

Your job is to discover what the shopper actually needs, search the live catalog, compare strong candidates, and explain a recommendation in plain language. Ask one focused question if budget, intended use, or delivery timing is essential and missing.

Rules:
- Never invent a product, price, inventory count, review, delivery date, or order state. Use a commerce tool for every current store fact.
- Search before recommending. Check inventory before saying a product is available.
- Keep shortlists to at most three products unless the shopper asks for more.
- Explain tradeoffs. Do not claim one product is "best" without tying it to stated preferences.
- Before placing an order, call checkInventory for the exact product and quantity. Then call placeOrder. The application will present its approval card; do not claim success until the tool returns an order.
- The saved demo customer is Jordan Lee at 18 Mercer Street, Brooklyn, NY 11201. Payment is a simulated card ending in 4242. Never ask for real payment details.
- Use getOrder or listOrders before discussing tracking or cancellation. Only processing and packed orders can be cancelled.
- If a tool reports a price, stock, or delivery change, state it clearly and offer the nearest useful alternative.
- Never expose chain-of-thought or hidden reasoning. Give the shopper only the useful conclusion and supporting facts.
- This is a demo store with synthetic reviews. Say so if asked.

Use compact prose. Product names should include their brand. Prices are USD.`;

const shoppingAgent = new ToolLoopAgent({
    model: groq(process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b"),
    instructions: systemPrompt,
    stopWhen: stepCountIs(8),
    maxOutputTokens: 800,
    temperature: 0.7,
    providerOptions: {
      groq: {
        reasoningEffort: "low",
        reasoningFormat: "hidden",
        parallelToolCalls: false,
      },
    },
    tools: {
      searchProducts: tool({
        description: "Search the live product catalog by needs, category, price, or required arrival date. Use this before recommending products.",
        inputSchema: z.object({
          query: z.string().optional().describe("Natural-language needs and preferences, such as lightweight laptop for photo editing"),
          category: z.enum(categories).optional(),
          minPrice: z.number().nonnegative().optional(),
          maxPrice: z.number().positive().optional(),
          mustArriveBy: z.string().optional().describe("ISO date YYYY-MM-DD"),
          limit: z.number().int().min(1).max(10).optional(),
        }),
        execute: async (input) => searchProducts(input),
      }),
      getProduct: tool({
        description: "Read current details and synthetic reviews for one product.",
        inputSchema: z.object({ productId: z.string() }),
        execute: async ({ productId }) => getProduct(productId),
      }),
      compareProducts: tool({
        description: "Compare current facts for two to four catalog products.",
        inputSchema: z.object({ productIds: z.array(z.string()).min(2).max(4) }),
        execute: async ({ productIds }) => compareProducts(productIds),
      }),
      checkInventory: tool({
        description: "Verify current price, stock, total, and arrival estimate for an exact product and quantity. Always call immediately before placeOrder.",
        inputSchema: z.object({
          productId: z.string(),
          quantity: z.number().int().min(1).max(5).default(1),
        }),
        execute: async ({ productId, quantity }) => checkInventory(productId, quantity),
      }),
      placeOrder: tool({
        description: "Place a simulated order using the saved address and simulated payment. This tool always requires explicit shopper approval.",
        inputSchema: z.object({
          productId: z.string(),
          quantity: z.number().int().min(1).max(5).default(1),
        }),
        needsApproval: true,
        execute: async ({ productId, quantity }) => placeOrder(productId, quantity),
      }),
      listOrders: tool({
        description: "List the shopper's simulated orders with current delivery and cancellation states.",
        inputSchema: z.object({}),
        execute: async () => ({ orders: listOrders() }),
      }),
      getOrder: tool({
        description: "Get tracking history and current status for one order.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: async ({ orderId }) => getOrder(orderId),
      }),
      cancelOrder: tool({
        description: "Cancel an eligible processing or packed order and restore inventory. Requires shopper approval.",
        inputSchema: z.object({ orderId: z.string() }),
        needsApproval: true,
        execute: async ({ orderId }) => cancelOrder(orderId),
      }),
    },
});

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return new Response("GROQ_API_KEY is not configured.", { status: 503 });
  }

  const { messages }: { messages: UIMessage[] } = await request.json();

  return createAgentUIStreamResponse({
    agent: shoppingAgent,
    uiMessages: prepareChatHistory(messages),
    abortSignal: request.signal,
    timeout: { totalMs: 55_000 },
  });
}
