import { z } from "zod";
import {
  ALL_PAYMENT_METHODS,
  activeFieldKeysForMethod,
  CASHPLUS_FLOW_OPTIONS,
  PAYMENT_FIELD_LABEL_AR,
  PAYMENT_METHOD_COUNT,
  PAYMENT_METHOD_IDS,
  type CashplusFlowValue,
  type PaymentMethodCategory,
  type PaymentMethodId,
  type PaymentMethodStoredFieldKey,
  paymentMethodById,
  paymentMethodTitle,
} from "@/lib/constants/payment-methods";

export { PAYMENT_FIELD_LABEL_AR };

/** Stored on `User.executionTime` for agents. */
export const AGENT_EXECUTION_TIME_VALUES = ["15 min", "30 min", "45 min", "60 min"] as const;
export type AgentExecutionTimeValue = (typeof AGENT_EXECUTION_TIME_VALUES)[number];

export const AGENT_PAYMENT_CATEGORIES = ["bank", "cash", "telecom", "digital"] as const;
export type AgentPaymentCategory = (typeof AGENT_PAYMENT_CATEGORIES)[number];

export const AGENT_PAYMENT_CATALOG = ALL_PAYMENT_METHODS.map((m) => ({
  id: m.id,
  name: m.title,
  category: m.category as AgentPaymentCategory,
  instructionHint: m.instructionHint,
}));

export const AGENT_PAYMENT_CATALOG_LENGTH = PAYMENT_METHOD_COUNT;

export type AgentPaymentCatalogEntry = (typeof AGENT_PAYMENT_CATALOG)[number];
export type AgentPaymentMethodId = PaymentMethodId;

const METHOD_ID_TUPLE = PAYMENT_METHOD_IDS;

export type AgentPaymentMethodRow = {
  id: PaymentMethodId;
  isActive: boolean;
  min_amount: number;
  max_amount: number;
  full_name: string;
  rib_24_digits: string;
  motif: string;
  phone: string;
  cashplus_flow: CashplusFlowValue | "";
  wallet_phone: string;
  webpay_full_name: string;
};

const methodIdSchema = z.enum(METHOD_ID_TUPLE);

/** RIB must be exactly 24 digits when non-empty (inactive methods may keep ""). Spaces stripped before validation. */
const RIB_24_MESSAGE =
  "يجب أن يتكون رقم الحساب (RIB) من 24 رقماً بالضبط، بدون مسافات أو أحرف.";

const rib24DigitsSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(
    z.union([
      z.literal(""),
      z.string().regex(/^\d{24}$/, { message: RIB_24_MESSAGE }),
    ])
  );

const cashplusFlowSchema = z.union([
  z.enum(["envoi_mobile", "conference"]),
  z.literal(""),
]);

export const agentPaymentMethodRowSchema = z.object({
  id: methodIdSchema,
  isActive: z.boolean(),
  min_amount: z.coerce.number().min(0, "الحد الأدنى يجب أن يكون ≥ 0"),
  max_amount: z.coerce.number().min(0, "الحد الأقصى يجب أن يكون ≥ 0"),
  full_name: z.string().max(400),
  rib_24_digits: rib24DigitsSchema,
  motif: z.string().max(500),
  phone: z.string().max(80),
  cashplus_flow: cashplusFlowSchema.optional().default(""),
  wallet_phone: z.string().max(80),
  webpay_full_name: z.string().max(400),
});

function refineActivePaymentRow(m: AgentPaymentMethodRow, i: number, ctx: z.RefinementCtx) {
  if (!m.isActive) return;

  if (!(Number(m.min_amount) < Number(m.max_amount))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "الحد الأدنى يجب أن يكون أصغر من الحد الأقصى",
      path: ["paymentMethods", i, "max_amount"],
    });
  }

  const keys = activeFieldKeysForMethod(m.id);
  for (const key of keys) {
    if (key === "cashplus_flow") {
      const v = m.cashplus_flow;
      if (!v || (v !== "envoi_mobile" && v !== "conference")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "اختر نوع عملية Cash Plus",
          path: ["paymentMethods", i, "cashplus_flow"],
        });
      }
      continue;
    }
    if (key === "rib_24_digits") {
      const rib = String((m as Record<string, unknown>)[key] ?? "").replace(/\s/g, "");
      if (!rib) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `أدخل ${PAYMENT_FIELD_LABEL_AR.rib_24_digits}`,
          path: ["paymentMethods", i, "rib_24_digits"],
        });
      } else if (!/^\d{24}$/.test(rib)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: RIB_24_MESSAGE,
          path: ["paymentMethods", i, "rib_24_digits"],
        });
      }
      continue;
    }
    const raw = String((m as Record<string, unknown>)[key] ?? "").trim();
    if (!raw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `أدخل ${PAYMENT_FIELD_LABEL_AR[key as PaymentMethodStoredFieldKey]}`,
        path: ["paymentMethods", i, key],
      });
    }
  }
}

export const agentPaymentSettingsSchema = z
  .object({
    executionTime: z.enum(AGENT_EXECUTION_TIME_VALUES),
    paymentMethods: z.array(agentPaymentMethodRowSchema).length(AGENT_PAYMENT_CATALOG_LENGTH),
  })
  .superRefine((data, ctx) => {
    data.paymentMethods.forEach((m, i) => {
      refineActivePaymentRow(m as AgentPaymentMethodRow, i, ctx);
    });
  });

export type AgentPaymentSettingsForm = z.infer<typeof agentPaymentSettingsSchema>;

export const SUPPORTED_AGENT_PAYMENT_METHODS = AGENT_PAYMENT_CATALOG;

const DEFAULT_MIN = 100;
const DEFAULT_MAX = 50000;

export function defaultAgentPaymentSettings(): AgentPaymentSettingsForm {
  return {
    executionTime: "30 min",
    paymentMethods: ALL_PAYMENT_METHODS.map((m) => ({
      id: m.id,
      isActive: false,
      min_amount: DEFAULT_MIN,
      max_amount: DEFAULT_MAX,
      full_name: "",
      rib_24_digits: "",
      motif: "",
      phone: "",
      cashplus_flow: "" as const,
      wallet_phone: "",
      webpay_full_name: "",
    })),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

const LEGACY_METHOD_ID_MAP: Record<string, PaymentMethodId | null> = {
  attijariwafa: "attijari",
  attijariwafa_bank: "attijari",
  attijari: "attijari",
  bp_ma: "bank_populaire",
  cdm_ma: null,
  sg_ma: null,
  cash_plus: "cashplus",
  express_automatique: "cash_express_auto",
  mt_cash: "mtcash",
  dabapay: "daba_pay",
  skrill: null,
  inwi_money: null,
};

function normalizeStoredMethodId(raw: string): PaymentMethodId | null {
  const id = String(raw ?? "").trim();
  if (LEGACY_METHOD_ID_MAP[id] !== undefined) {
    return LEGACY_METHOD_ID_MAP[id];
  }
  if (paymentMethodById(id)) return id as PaymentMethodId;
  return null;
}

function migrateLegacyPaymentRow(
  id: PaymentMethodId,
  item: Record<string, unknown>
): Partial<AgentPaymentMethodRow> {
  const legacyName = typeof item.name === "string" ? item.name : "";
  const legacyAcct = typeof item.accountNumber === "string" ? item.accountNumber : "";
  const legacyDetails = typeof item.details === "string" ? item.details : "";
  const acct = legacyAcct.trim() || legacyDetails.trim();
  const motif = typeof item.motif === "string" ? item.motif : "";
  const title = paymentMethodTitle(id);
  const full_name =
    legacyName.trim() && legacyName.trim() !== title.trim() ? legacyName.trim() : "";

  const min_amount = Number(item.min_amount ?? DEFAULT_MIN) || DEFAULT_MIN;
  const max_amount = Number(item.max_amount ?? DEFAULT_MAX) || DEFAULT_MAX;

  const cat = paymentMethodById(id)?.category;
  let rib_24_digits = typeof item.rib_24_digits === "string" ? item.rib_24_digits : "";
  let phone = typeof item.phone === "string" ? item.phone : "";
  let wallet_phone = typeof item.wallet_phone === "string" ? item.wallet_phone : "";
  let webpay_full_name = typeof item.webpay_full_name === "string" ? item.webpay_full_name : "";

  if (cat === "bank" && !rib_24_digits && acct) {
    rib_24_digits = acct.replace(/\s/g, "");
  }
  if ((cat === "cash" || cat === "telecom" || cat === "digital") && id !== "wepay_cih") {
    if (!phone && acct) phone = acct;
  }
  if (id === "wepay_cih") {
    if (!wallet_phone && acct) wallet_phone = acct;
    if (!webpay_full_name && full_name) webpay_full_name = full_name;
  }

  const cashplus_flow =
    item.cashplus_flow === "envoi_mobile" || item.cashplus_flow === "conference"
      ? item.cashplus_flow
      : "";

  return {
    isActive: Boolean(item.isActive),
    min_amount,
    max_amount,
    full_name: typeof item.full_name === "string" ? item.full_name : full_name,
    rib_24_digits,
    motif,
    phone,
    cashplus_flow: cashplus_flow as CashplusFlowValue | "",
    wallet_phone,
    webpay_full_name,
  };
}

export function parseAgentPaymentMethodsJson(raw: unknown): AgentPaymentSettingsForm["paymentMethods"] {
  const base = defaultAgentPaymentSettings().paymentMethods;
  if (!Array.isArray(raw)) return base;

  const byId = new Map<PaymentMethodId, Partial<AgentPaymentMethodRow>>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const mapped = normalizeStoredMethodId(String(item.id ?? ""));
    if (!mapped) continue;
    const next = migrateLegacyPaymentRow(mapped, item);
    const prev = byId.get(mapped);
    if (!prev) {
      byId.set(mapped, next);
    } else {
      byId.set(mapped, {
        ...prev,
        ...next,
        full_name: String(next.full_name ?? "").trim() || prev.full_name,
        rib_24_digits: String(next.rib_24_digits ?? "").trim() || prev.rib_24_digits,
        motif: String(next.motif ?? "").trim() || prev.motif,
        phone: String(next.phone ?? "").trim() || prev.phone,
        wallet_phone: String(next.wallet_phone ?? "").trim() || prev.wallet_phone,
        webpay_full_name: String(next.webpay_full_name ?? "").trim() || prev.webpay_full_name,
        cashplus_flow: (next.cashplus_flow || prev.cashplus_flow) as CashplusFlowValue | "",
        min_amount: Number(next.min_amount ?? prev.min_amount) || prev.min_amount,
        max_amount: Number(next.max_amount ?? prev.max_amount) || prev.max_amount,
        isActive: Boolean(next.isActive) || Boolean(prev.isActive),
      });
    }
  }

  return base.map((row) => {
    const patch = byId.get(row.id as PaymentMethodId);
    if (!patch) return row;
    return {
      id: row.id,
      isActive: Boolean(patch.isActive),
      min_amount: Number(patch.min_amount ?? row.min_amount) || row.min_amount,
      max_amount: Number(patch.max_amount ?? row.max_amount) || row.max_amount,
      full_name: String(patch.full_name ?? row.full_name ?? ""),
      rib_24_digits: String(patch.rib_24_digits ?? row.rib_24_digits ?? ""),
      motif: String(patch.motif ?? row.motif ?? ""),
      phone: String(patch.phone ?? row.phone ?? ""),
      cashplus_flow: (patch.cashplus_flow ?? row.cashplus_flow ?? "") as CashplusFlowValue | "",
      wallet_phone: String(patch.wallet_phone ?? row.wallet_phone ?? ""),
      webpay_full_name: String(patch.webpay_full_name ?? row.webpay_full_name ?? ""),
    };
  });
}

export function catalogIndicesForCategory(category: AgentPaymentCategory): number[] {
  return AGENT_PAYMENT_CATALOG.map((m, i) => (m.category === category ? i : -1)).filter((i) => i >= 0);
}

export function validatePaymentMethodsCategorySlice(
  methods: AgentPaymentMethodRow[],
  indices: number[]
): { ok: true } | { ok: false; firstIndex: number; field: string; message: string } {
  for (const i of indices) {
    const m = methods[i];
    if (!m || !m.isActive) continue;
    if (!(Number(m.min_amount) < Number(m.max_amount))) {
      return {
        ok: false,
        firstIndex: i,
        field: "max_amount",
        message: "الحد الأدنى يجب أن يكون أصغر من الحد الأقصى",
      };
    }
    const keys = activeFieldKeysForMethod(m.id);
    for (const key of keys) {
      if (key === "cashplus_flow") {
        if (!m.cashplus_flow || (m.cashplus_flow !== "envoi_mobile" && m.cashplus_flow !== "conference")) {
          return { ok: false, firstIndex: i, field: "cashplus_flow", message: "اختر نوع عملية Cash Plus" };
        }
      } else if (key === "rib_24_digits") {
        const rib = String((m as Record<string, unknown>)[key] ?? "").replace(/\s/g, "");
        if (!rib) {
          return {
            ok: false,
            firstIndex: i,
            field: "rib_24_digits",
            message: `أدخل ${PAYMENT_FIELD_LABEL_AR.rib_24_digits}`,
          };
        }
        if (!/^\d{24}$/.test(rib)) {
          return {
            ok: false,
            firstIndex: i,
            field: "rib_24_digits",
            message: RIB_24_MESSAGE,
          };
        }
      } else {
        const raw = String((m as Record<string, unknown>)[key] ?? "").trim();
        if (!raw) {
          return {
            ok: false,
            firstIndex: i,
            field: key,
            message: `أدخل ${PAYMENT_FIELD_LABEL_AR[key as PaymentMethodStoredFieldKey]}`,
          };
        }
      }
    }
  }
  return { ok: true };
}

export type PublicPaymentMethodPayload = {
  id: string;
  methodTitle: string;
  category: PaymentMethodCategory | null;
  minAmount: number;
  maxAmount: number;
  copyable: { key: string; label: string; value: string }[];
};

export function toPublicPaymentMethodPayload(row: AgentPaymentMethodRow): PublicPaymentMethodPayload {
  const copyable: { key: string; label: string; value: string }[] = [];
  for (const key of activeFieldKeysForMethod(row.id)) {
    if (key === "cashplus_flow") {
      const v = row.cashplus_flow;
      if (v === "envoi_mobile" || v === "conference") {
        const labelOpt = CASHPLUS_FLOW_OPTIONS.find((o) => o.value === v);
        copyable.push({
          key,
          label: PAYMENT_FIELD_LABEL_AR.cashplus_flow,
          value: labelOpt?.label ?? v,
        });
      }
      continue;
    }
    const val = String((row as Record<string, unknown>)[key] ?? "").trim();
    if (val) {
      copyable.push({
        key,
        label: PAYMENT_FIELD_LABEL_AR[key as PaymentMethodStoredFieldKey],
        value: val,
      });
    }
  }
  return {
    id: row.id,
    methodTitle: paymentMethodTitle(row.id),
    category: paymentMethodById(row.id)?.category ?? null,
    minAmount: row.min_amount,
    maxAmount: row.max_amount,
    copyable,
  };
}

export function parseExecutionTime(raw: string | null | undefined): AgentExecutionTimeValue {
  const s = String(raw ?? "").trim();
  if (AGENT_EXECUTION_TIME_VALUES.includes(s as AgentExecutionTimeValue)) {
    return s as AgentExecutionTimeValue;
  }
  return "30 min";
}
