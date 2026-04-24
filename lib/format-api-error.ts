/** Builds a user-visible string from typical API JSON error bodies (`error`, `message`, `details`, `receivedBody`). */
export function formatApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  const o = data as Record<string, unknown>;
  const main =
    (typeof o.error === "string" && o.error.trim()) ||
    (typeof o.message === "string" && o.message.trim()) ||
    "";
  const details = typeof o.details === "string" && o.details.trim() ? o.details.trim() : "";
  let out = main || "Request failed";
  if (details && details !== main) out += `\n${details}`;
  if (o.receivedBody !== undefined) {
    try {
      out += `\nReceived: ${JSON.stringify(o.receivedBody)}`;
    } catch {
      out += "\nReceived: (unserializable)";
    }
  }
  return out;
}
