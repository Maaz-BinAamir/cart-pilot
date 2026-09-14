import { groq } from "@ai-sdk/groq";
import {
  stepCountIs,
  tool,
  ToolLoopAgent,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { createStore } from "@/src/lib/store";
import type { DemoSession } from "@/src/lib/demo-session";

const categories = ["Laptops", "Audio", "Phones", "Gaming", "Cameras", "Accessories"] as const;

const systemPrompt = `You are Cart Pilot, a concise and careful personal shopping agent for a fictional electronics store.

Your job is to discover what the shopper actually needs, search the live catalog, compare strong candidates, and explain a recommendation in plain language. Ask one focused question if budget, intended use, or delivery timing is essential and missing.

Rules:
- Never invent a product, price, inventory count, review, delivery date, or order state. Use a commerce tool for every current store fact.
- Search before making a new recommendation. For a follow-up about an identified product, call its detail or inventory tool directly; do not search again to rediscover its ID.
- Check inventory before saying a product is available. An unavailable result is a successful stock check, not a tool failure.
- Keep shortlists to at most three products unless the shopper asks for more.
- Explain tradeoffs. Do not claim one product is "best" without tying it to stated preferences.
- Before placing an order, call checkInventory for the exact product and quantity. Then call placeOrder. The application will present its approval card; do not claim success until the tool returns an order.
- If a tool returns an error or fails, do not claim the order was placed or cancelled. Explain the failure.
- The saved demo customer is Jordan Lee at 18 Mercer Street, Brooklyn, NY 11201. Payment is a simulated card ending in 4242. Never ask for real payment details.
- Use getOrder or listOrders before discussing tracking or cancellation. Only processing and packed orders can be cancelled.
- If a tool reports a price, stock, or delivery change, state it clearly. Do not invent why it changed. Offer at most one available alternative when useful.
- After tools return, always finish with a user-facing answer. Do not end with only a promise to check something.
- A request to continue means finish the previous answer, not place another order or repeat a cancellation.
- Never expose chain-of-thought or hidden reasoning. Give the shopper only the useful conclusion and supporting facts.
- This is a demo store with synthetic reviews. Say so if asked.

Use compact prose. Product names should include their brand. Prices are USD.`;

export const createShoppingAgent = (store: ReturnType<typeof createStore>, onMutation: (session: DemoSession) => void, model: LanguageModel = groq(process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b")) => new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    stopWhen: stepCountIs(8),
    maxOutputTokens: 800,
    maxRetries: 0,
    // Reserve the last step for an answer instead of ending on another tool call.
    prepareStep: ({ stepNumber }) => stepNumber === 7 ? { toolChoice: "none" } : undefined,
    temperature: 0.7,
    providerOptions: {
      groq: {
        reasoningEffort: typeof model !== "string" && model.modelId.startsWith("qwen/") ? "none" : "low",
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
        execute: async (input) => store.searchProducts(input),
      }),
      getProduct: tool({
        description: "Read current details and synthetic reviews for one product.",
        inputSchema: z.object({ productId: z.string() }),
        execute: async ({ productId }) => store.getProduct(productId),
      }),
      compareProducts: tool({
        description: "Compare current facts for two to four catalog products.",
        inputSchema: z.object({ productIds: z.array(z.string()).min(2).max(4) }),
        execute: async ({ productIds }) => store.compareProducts(productIds),
      }),
      checkInventory: tool({
        description: "Verify current price, stock, total, and arrival estimate for an exact product and quantity. Always call immediately before placeOrder.",
        inputSchema: z.object({
          productId: z.string(),
          quantity: z.number().int().min(1).max(5).default(1),
        }),
        execute: async ({ productId, quantity }) => store.checkInventory(productId, quantity),
      }),
      placeOrder: tool({
        description: "Place a simulated order using the saved address and simulated payment. This tool always requires explicit shopper approval.",
        inputSchema: z.object({
          productId: z.string(),
          quantity: z.number().int().min(1).max(5).default(1),
        }),
        needsApproval: true,
        execute: async ({ productId, quantity }, { toolCallId }) => {
          const result = store.placeOrder(productId, quantity, toolCallId);
          if (!("error" in result)) onMutation(store.getSession());
          return result;
        },
      }),
      listOrders: tool({
        description: "List the shopper's simulated orders with current delivery and cancellation states.",
        inputSchema: z.object({}),
        execute: async () => ({ orders: store.listOrders() }),
      }),
      getOrder: tool({
        description: "Get tracking history and current status for one order.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: async ({ orderId }) => store.getOrder(orderId),
      }),
      cancelOrder: tool({
        description: "Cancel an eligible processing or packed order and restore inventory. Requires shopper approval.",
        inputSchema: z.object({ orderId: z.string() }),
        needsApproval: true,
        execute: async ({ orderId }) => {
          const result = store.cancelOrder(orderId);
          if (result.cancelled) onMutation(store.getSession());
          return result;
        },
      }),
    },
});

