import type { FinishReason, UIMessage } from "ai";

export function unfinishedResponse(message: UIMessage, finishReason?: FinishReason): string | null {
  if (message.parts.some((part) => "state" in part && part.state === "approval-requested")) return null;
  if (finishReason === "length") return "Pilot reached its response limit before finishing.";
  const lastTool = message.parts.findLastIndex((part) => part.type.startsWith("tool-") || part.type === "dynamic-tool");
  const hasAnswer = message.parts.slice(lastTool + 1).some((part) => part.type === "text" && part.text.trim());
  if (!hasAnswer) return lastTool >= 0
    ? "Pilot finished checking the store but did not finish its answer."
    : "Pilot stopped before producing an answer.";
  return null;
}

export function toolActivity(part: Record<string, unknown>) {
  const type = String(part.type ?? "").replace("tool-", "");
  const state = String(part.state ?? "");
  const output = part.output as { error?: string; id?: string; cancelled?: boolean; available?: boolean } | undefined;
  const approval = part.approval as { approved?: boolean } | undefined;
  const denied = state === "output-denied" || (state === "approval-responded" && approval?.approved === false);
  const failed = state === "output-error" || (state === "output-available" && (Boolean(output?.error)
    || (type === "placeOrder" && !output?.id)
    || (type === "cancelOrder" && output?.cancelled !== true)));
  const complete = state === "output-available" && !failed;
  const labels: Record<string, [string, string]> = {
    searchProducts: ["Searching live catalog", "Searched live catalog"],
    getProduct: ["Reading product details", "Read product details"],
    compareProducts: ["Comparing current options", "Compared current options"],
    checkInventory: ["Checking price and inventory", output?.available === false ? "Checked inventory: unavailable" : "Verified price and inventory"],
    placeOrder: ["Preparing checkout", "Order placed"],
    listOrders: ["Checking your orders", "Checked your orders"],
    getOrder: ["Reading delivery tracking", "Read delivery tracking"],
    cancelOrder: ["Checking cancellation", "Order cancelled"],
  };
  const label = denied ? "Action declined" : failed
    ? type === "placeOrder" ? "Order not placed" : type === "cancelOrder" ? "Order not cancelled" : "Store check failed"
    : labels[type]?.[complete ? 1 : 0] ?? "Using commerce tool";
  return { label, complete, failed: failed || denied };
}
