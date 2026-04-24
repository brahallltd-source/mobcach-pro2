import { paymentMethodTitle } from "@/lib/constants/payment-methods";

/** Labels for marketplace pills from `User.paymentMethods` JSON (uses method `id` → catalog title). */
export function activeJsonPaymentLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (!o.isActive) continue;
    const id = String(o.id ?? "").trim();
    if (id) {
      out.push(paymentMethodTitle(id));
      continue;
    }
    const name = String(o.name ?? "").trim();
    if (name) out.push(name);
  }
  return out;
}
