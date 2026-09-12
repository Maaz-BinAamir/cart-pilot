import type { UIMessage } from "ai";

const historyBudget = 24_000;

/** Keep the transcript in the UI; send recent context without old catalog payloads. */
export function prepareChatHistory(messages: UIMessage[]): UIMessage[] {
  const userIndexes = messages.flatMap((message, index) => message.role === "user" ? [index] : []);
  const recentToolsStart = userIndexes.at(-2) ?? 0;
  const lastUserIndex = userIndexes.at(-1) ?? 0;
  const turns: UIMessage[][] = [];

  for (const [index, message] of messages.entries()) {
    if (message.role === "user" || !turns.length) turns.push([]);
    const parts = message.parts.filter((part) => {
      if (part.type === "reasoning") return false;
      if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
        const state = (part as { state: string }).state;
        // Interrupted calls have no result to pair with. Keep approvals and completed calls intact.
        if (state === "input-streaming" || state === "input-available") return false;
        if (index < recentToolsStart) return false;
        // Old unanswered approval cards must not become actionable on a later turn.
        if (index < lastUserIndex && (state === "approval-requested" || state === "approval-responded")) return false;
      }
      return true;
    });
    if (parts.length) turns[turns.length - 1].push({ ...message, parts });
  }

  // Drop whole turns so an assistant tool result never loses its call or approval.
  const sizes = turns.map((turn) => JSON.stringify(turn).length);
  let size = sizes.reduce((total, length) => total + length, 0);
  let start = 0;
  while (size > historyBudget && start < turns.length - 1) size -= sizes[start++];
  return turns.slice(start).flat();
}
