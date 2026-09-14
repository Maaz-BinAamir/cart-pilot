export function chatErrorMessage(error: unknown): string {
  const detail = error && typeof error === "object" ? error as { statusCode?: number; lastError?: unknown; name?: string } : undefined;
  if (detail?.lastError) return chatErrorMessage(detail.lastError);
  if (detail?.statusCode === 429) return "Pilot has reached its model rate limit. Please wait a moment, then try again.";
  if (detail?.name === "TimeoutError" || detail?.name === "AbortError") return "The response took too long. Please try again.";
  return "Pilot could not finish this response. Please try again.";
}
