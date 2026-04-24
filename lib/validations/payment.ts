import * as z from "zod";

/* ── Admin: treasury (Super Admin) — may include crypto/USDT; accountName rules follow type ── */

const adminTreasuryTypeSchema = z.enum(["bank", "cash", "crypto"]);

/**
 * Super-admin treasury `PaymentMethod` create body (`POST /api/admin/payment-methods`).
 * `accountName` is required for `bank`; optional / empty for `crypto` and `cash` (enforced in `.refine` below).
 */
export const adminPaymentMethodSchema = z
  .object({
    name: z.string().min(1, "يجب إدخال اسم الطريقة"),
    type: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      adminTreasuryTypeSchema,
    ),
    accountName: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v === null || v === undefined ? "" : String(v)).trim()),
    accountNumber: z.string().min(1, "رقم الحساب أو عنوان المحفظة مطلوب").trim(),
    isActive: z.coerce.boolean().default(true),
    currency: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        const s = v === null || v === undefined ? "" : String(v).trim();
        return s || "MAD";
      }),
  })
  .refine(
    (data) => {
      if (data.type === "bank" && data.accountName.length === 0) return false;
      return true;
    },
    { message: "اسم صاحب الحساب مطلوب للتحويلات البنكية", path: ["accountName"] },
  );

/** Backward-compatible alias (admin route historically imported this name). */
export const paymentMethodSchema = adminPaymentMethodSchema;

/** Normalize optional holder name for Prisma (`String?`) on admin rows. */
export function treasuryAccountNameForPrisma(accountName: string): string | null {
  const t = accountName.trim();
  return t.length > 0 ? t : null;
}

/* ── Agent: only bank + cash (mobile / wallet in product terms); no crypto; accountName always required ── */

const optionalTrim = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? "" : String(v).trim()));

function preprocessTypeLower(v: unknown) {
  return typeof v === "string" ? v.trim().toLowerCase() : v;
}

/** Prisma `PaymentMethodType` uses `cash` for non-bank “wallet / operator” methods — never `crypto`. */
const agentAllowedType = z.preprocess(
  preprocessTypeLower,
  z.enum(["bank", "cash"], {
    errorMap: () => ({
      message: "نوع الطريقة: بنكي أو محفظة فقط. لا يمكن للوكيل إضافة USDT أو كريبتو.",
    }),
  }),
);

const agentPaymentMethodFields = {
  type: agentAllowedType,
  method_name: z.string().min(1, "يجب إدخال اسم الطريقة").transform((s) => s.trim()),
  currency: optionalTrim.transform((s) => s || "MAD"),
  account_name: z
    .string()
    .min(2, "اسم صاحب الحساب مطلوب (حرفان على الأقل)")
    .transform((s) => s.trim()),
  rib: optionalTrim,
  wallet_address: optionalTrim,
  network: optionalTrim,
  phone: optionalTrim,
  fee_percent: z.coerce.number().optional().default(0),
  enabled: z.coerce.boolean().optional().default(true),
} as const;

const agentBaseObject = z.object(agentPaymentMethodFields);

const agentFieldRefinements = <S extends z.ZodRawShape>(base: z.ZodObject<S>) =>
  base
    .refine((d) => d.wallet_address.length === 0, {
      message: "الوكلاء لا يضيفون عناوين USDT/كريبتو",
      path: ["wallet_address"],
    })
    .refine((d) => d.type !== "bank" || d.rib.length > 0, {
      message: "أدخل RIB (24 رقماً) للبنكي",
      path: ["rib"],
    })
    .refine((d) => d.type !== "cash" || d.phone.length > 0, {
      message: "أدخل رقم الهاتف لوسيلة المحفظة/الكاش",
      path: ["phone"],
    });

/**
 * Agent `POST /api/agent/payment-methods` body. `type` is `bank` or `cash` (wallet-like); `account_name` always required; no crypto.
 */
export const agentPaymentMethodSchema = agentFieldRefinements(
  agentBaseObject.extend({ agentId: z.string().min(1, "agentId مطلوب") }),
);

export type AgentPaymentMethodCreate = z.infer<typeof agentPaymentMethodSchema>;

/**
 * Agent `PUT /api/agent/payment-methods` body: same business rules as create, with `methodId` instead of `agentId`.
 */
export const agentPaymentMethodUpdateSchema = agentFieldRefinements(
  agentBaseObject.extend({ methodId: z.string().min(1, "methodId مطلوب") }),
);
