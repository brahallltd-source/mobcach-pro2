import * as z from "zod";

/** Moroccan wallet methods that submit a phone number in `details`. */
export const WALLET_PHONE_METHODS = [
  "ORANGE_MONEY",
  "JIBI",
  "MTCASH",
  "DABAPAY",
] as const;

/**
 * Strict treasury recharge validation (client-side; server re-validates in
 * `lib/agent-treasury-recharge.ts`).
 */
export const rechargeSchema = z
  .object({
    amount: z.coerce.number().min(100, "أقل مبلغ للشحن هو 100 درهم"),
    method: z.enum([
      "CIH",
      "ORANGE_MONEY",
      "JIBI",
      "MTCASH",
      "DABAPAY",
      "SKRILL",
    ]),
    details: z.string().min(1, "هذا الحقل مطلوب"),
    motif: z.string().min(3, "يجب إدخال مرجع العملية (Motif)"),
    receiptUrl: z.string().min(5, "صورة الإيصال إجبارية"),
  })
  .superRefine((data, ctx) => {
    if (data.method === "CIH") {
      const rib = data.details.replace(/\s+/g, "");
      if (!/^\d{24}$/.test(rib)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "رقم الحساب (RIB) يجب أن يتكون من 24 رقماً بالضبط",
          path: ["details"],
        });
      }
    }

    if ((WALLET_PHONE_METHODS as readonly string[]).includes(data.method)) {
      const phone = data.details.replace(/\s+/g, "");
      if (!/^(06|07)\d{8}$/.test(phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "رقم الهاتف يجب أن يبدأ بـ 06 أو 07 ويتكون من 10 أرقام",
          path: ["details"],
        });
      }
    }

    if (data.method === "SKRILL") {
      if (!/^\S+@\S+\.\S+$/.test(data.details.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "صيغة البريد الإلكتروني غير صحيحة",
          path: ["details"],
        });
      }
    }
  });

export type RechargeFormValues = z.infer<typeof rechargeSchema>;

export function mapTreasuryDetailsToApi(
  method: string,
  details: string,
): Record<string, string> {
  const m = method.toUpperCase();
  if (m === "CIH") return { rib: details.replace(/\s+/g, "") };
  if ((WALLET_PHONE_METHODS as readonly string[]).includes(m)) {
    return { phone: details.replace(/\s+/g, "") };
  }
  if (m === "SKRILL") return { email: details.trim() };
  return {};
}
