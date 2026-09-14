import { createAgentUIStream, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { z } from "zod";
import { createStore } from "@/src/lib/store";
import { createShoppingAgent } from "@/src/lib/shopping-agent";
import { chatErrorMessage } from "@/src/lib/chat-error";
import { prepareChatHistory } from "@/src/lib/chat-history";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) return new Response("GROQ_API_KEY is not configured.", { status: 503 });
  let messages: UIMessage[];
  let store: ReturnType<typeof createStore>;
  try {
    const body = await request.json();
    messages = z.array(z.custom<UIMessage>((value) => Boolean(value && typeof value === "object" && "parts" in value && Array.isArray(value.parts)))).parse(body.messages);
    store = createStore(body.session);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid chat or demo session." }, { status: 400 });
    throw error;
  }
  const startedAt = Date.now();
  const stream = createUIMessageStream({
    onError: chatErrorMessage,
    execute: async ({ writer }) => {
      const agent = createShoppingAgent(store, (session) => {
        writer.write({ type: "data-store", data: session, transient: true });
      });
      writer.merge(await createAgentUIStream({
        agent,
        onError: chatErrorMessage,
        uiMessages: prepareChatHistory(messages),
        abortSignal: request.signal,
        timeout: { totalMs: 55_000 },
        onStepEnd: (step) => {
          console.info("cart-pilot.step", {
            elapsedMs: Date.now() - startedAt,
            step: step.stepNumber,
            finishReason: step.finishReason,
            outputTokens: step.usage.outputTokens,
            tools: step.toolCalls.map((call) => call.toolName),
          });
        },
      }));
    },
  });
  return createUIMessageStreamResponse({ stream });
}
