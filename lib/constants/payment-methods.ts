/**
 * Single source of truth: catalog ids, UI categories, and which fields are required when a method is active.
 * Min / max deposit (MAD) are required for every active method in addition to the listed fields.
 */
export const PAYMENT_METHOD_CATEGORIES = ["bank", "cash", "telecom", "digital"] as const;
export type PaymentMethodCategory = (typeof PAYMENT_METHOD_CATEGORIES)[number];

/** Keys stored on each `User.paymentMethods[]` row (plus `isActive`, `id`, `min_amount`, `max_amount`). */
export type PaymentMethodStoredFieldKey =
  | "full_name"
  | "rib_24_digits"
  | "motif"
  | "phone"
  | "cashplus_flow"
  | "wallet_phone"
  | "webpay_full_name";

export const PAYMENT_FIELD_LABEL_AR: Record<PaymentMethodStoredFieldKey | "min_amount" | "max_amount", string> = {
  full_name: "الاسم الكامل",
  rib_24_digits: "RIB (24 رقماً)",
  motif: "المرجع / Motif",
  phone: "رقم الهاتف",
  cashplus_flow: "نوع العملية (Cash Plus)",
  wallet_phone: "هاتف المحفظة",
  webpay_full_name: "الاسم في WePay",
  min_amount: "الحد الأدنى للإيداع (MAD)",
  max_amount: "الحد الأقصى للإيداع (MAD)",
};

export const CASHPLUS_FLOW_OPTIONS = [
  { value: "envoi_mobile", label: "Envoi vers mobile" },
  { value: "conference", label: "Conference" },
] as const;

export type CashplusFlowValue = (typeof CASHPLUS_FLOW_OPTIONS)[number]["value"];

export const ALL_PAYMENT_METHODS = [
  {
    id: "cih",
    title: "CIH Bank",
    category: "bank",
    instructionHint: "الاسم كما في البنك، RIB 24 رقماً، والمرجع.",
    activeFieldKeys: ["full_name", "rib_24_digits", "motif"] as const,
  },
  {
    id: "attijari",
    title: "Attijariwafa Bank",
    category: "bank",
    instructionHint: "الاسم، RIB 24 رقماً، والمرجع.",
    activeFieldKeys: ["full_name", "rib_24_digits", "motif"] as const,
  },
  {
    id: "lbankalik",
    title: "LbankaLIK",
    category: "bank",
    instructionHint: "الاسم، RIB 24 رقماً، والمرجع.",
    activeFieldKeys: ["full_name", "rib_24_digits", "motif"] as const,
  },
  {
    id: "bank_populaire",
    title: "Banque Populaire",
    category: "bank",
    instructionHint: "الاسم، RIB 24 رقماً، والمرجع.",
    activeFieldKeys: ["full_name", "rib_24_digits", "motif"] as const,
  },
  {
    id: "bmce",
    title: "BMCE Bank of Africa",
    category: "bank",
    instructionHint: "الاسم، RIB 24 رقماً، والمرجع.",
    activeFieldKeys: ["full_name", "rib_24_digits", "motif"] as const,
  },
  {
    id: "cfg",
    title: "CFG Bank",
    category: "bank",
    instructionHint: "الاسم، RIB 24 رقماً، والمرجع.",
    activeFieldKeys: ["full_name", "rib_24_digits", "motif"] as const,
  },
  {
    id: "cashplus",
    title: "Cash Plus",
    category: "cash",
    instructionHint: "اختر نوع العملية ثم الهاتف والاسم الكامل.",
    activeFieldKeys: ["cashplus_flow", "phone", "full_name"] as const,
  },
  {
    id: "jibi",
    title: "Jibi",
    category: "cash",
    instructionHint: "الهاتف، الاسم، والمرجع.",
    activeFieldKeys: ["phone", "full_name", "motif"] as const,
  },
  {
    id: "wafacash",
    title: "Wafacash",
    category: "cash",
    instructionHint: "الهاتف والاسم الكامل.",
    activeFieldKeys: ["phone", "full_name"] as const,
  },
  {
    id: "cash_express_auto",
    title: "Cash Express Auto",
    category: "cash",
    instructionHint: "هاتف نقطة الخدمة؛ يوفّر اللاعب الكود والمبلغ.",
    activeFieldKeys: ["phone"] as const,
  },
  {
    id: "mtcash",
    title: "MT Cash",
    category: "telecom",
    instructionHint: "الهاتف والاسم الكامل.",
    activeFieldKeys: ["phone", "full_name"] as const,
  },
  {
    id: "orange_money",
    title: "Orange Money",
    category: "telecom",
    instructionHint: "الهاتف والاسم الكامل.",
    activeFieldKeys: ["phone", "full_name"] as const,
  },
  {
    id: "daba_pay",
    title: "Daba Pay",
    category: "digital",
    instructionHint: "الهاتف والاسم؛ يدخل اللاعب رمز التحقق 6 أرقام.",
    activeFieldKeys: ["phone", "full_name"] as const,
  },
  {
    id: "wepay_cih",
    title: "WePay CIH",
    category: "digital",
    instructionHint: "هاتف المحفظة والاسم في WePay.",
    activeFieldKeys: ["wallet_phone", "webpay_full_name"] as const,
  },
] as const;

export type PaymentMethodId = (typeof ALL_PAYMENT_METHODS)[number]["id"];

export const PAYMENT_METHOD_IDS = ALL_PAYMENT_METHODS.map((m) => m.id) as unknown as [
  PaymentMethodId,
  ...PaymentMethodId[],
];

export const PAYMENT_METHOD_COUNT = ALL_PAYMENT_METHODS.length;

export const PAYMENT_METHOD_BANKS = ALL_PAYMENT_METHODS.filter((m) => m.category === "bank");
export const PAYMENT_METHOD_CASH = ALL_PAYMENT_METHODS.filter((m) => m.category === "cash");
export const PAYMENT_METHOD_TELECOM = ALL_PAYMENT_METHODS.filter((m) => m.category === "telecom");
export const PAYMENT_METHOD_DIGITAL = ALL_PAYMENT_METHODS.filter((m) => m.category === "digital");

const BY_ID = new Map<string, (typeof ALL_PAYMENT_METHODS)[number]>(
  ALL_PAYMENT_METHODS.map((m) => [m.id, m])
);

export function paymentMethodById(id: string): (typeof ALL_PAYMENT_METHODS)[number] | undefined {
  return BY_ID.get(String(id ?? "").trim());
}

export function paymentMethodTitle(id: string): string {
  const t = paymentMethodById(id)?.title;
  if (t) return t;
  const fallback = String(id ?? "").trim();
  return fallback.length > 0 ? fallback : "—";
}

/** Field keys required when the method is active (excluding `min_amount` / `max_amount`). */
export function activeFieldKeysForMethod(id: string): readonly PaymentMethodStoredFieldKey[] {
  const m = paymentMethodById(id);
  return m ? (m.activeFieldKeys as readonly PaymentMethodStoredFieldKey[]) : [];
}

/** Preset labels for admin treasury bank rows. */
export const ADMIN_BANK_METHOD_OPTIONS = PAYMENT_METHOD_BANKS.map((m) => m.title);

/** Preset labels for admin treasury cash rows. */
export const ADMIN_CASH_METHOD_OPTIONS = PAYMENT_METHOD_CASH.map((m) => m.title);
