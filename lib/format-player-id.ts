/** Short display id for UI (never show full UUID in lists). */
export function formatShortPlayerId(id: string | null | undefined): string {
  const raw = String(id ?? "").trim();
  if (!raw) return "—";
  return `#${raw.substring(0, 8).toUpperCase()}`;
}
