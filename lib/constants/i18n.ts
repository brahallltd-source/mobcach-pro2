/**
 * Centralized Arabic UI copy for notifications, roles, statuses, registration,
 * and sidebar labels. Server `createNotification` localizes English keys here.
 */

/** Role display titles (Arabic). */
export const ROLE_TITLE_AR: Record<string, string> = {
  PLAYER: "لاعب",
  AGENT: "وكيل",
  ADMIN: "مسؤول",
  SUPER_ADMIN: "المدير العام",
};

/** Account / link status labels shown in UI. */
export const STATUS_LABEL_AR: Record<string, string> = {
  PENDING: "قيد المراجعة",
  PENDING_APPROVAL: "قيد المراجعة",
  PENDING_AGENT: "قيد اختيار الوكيل",
  ACTIVE: "نشط",
  inactive: "غير نشط",
  REJECTED: "مرفوض",
  rejected: "مرفوض",
};

/** English notification title → Arabic (exact / case-insensitive). */
export const NOTIFICATION_TITLE_EN_TO_AR: Record<string, string> = {
  "application approved": "تم قبول طلب الوكيل",
  "application rejected": "تم رفض طلب الوكيل",
  "bonus awarded": "تم منح المكافأة",
  "account created by your agent": "تم إنشاء حسابك من قبل الوكيل",
  "agent unlinked": "تم فك ربط الوكيل",
  "referral code used": "تم استخدام رمز الدعوة",
  "new order received": "طلب شحن جديد",
  "order created": "تم إنشاء الطلب",
  "energy reward ready": "مكافأة الطاقة جاهزة",
  "duplicate proof detected": "تم رصد إثبات مكرر",
  "🚩 duplicate proof detected": "🚩 تم رصد إثبات مكرر",
  "proof uploaded": "تم رفع إثبات الدفع",
  "payout rejected": "تم رفض طلب السحب",
  "payout completed": "تم إكمال طلب السحب",
  "payout sent": "تم إرسال طلب السحب",
  "transaction approved": "تم قبول عملية الشحن",
  "new message": "رسالة جديدة من الوكيل",
};

/** Player registration — Arabic field hints and copy. */
export const REGISTER_AR = {
  fullName: "الاسم الكامل",
  username: "اسم المستخدم",
  email: "البريد الإلكتروني",
  phone: "رقم الهاتف (واتساب)",
  password: "كلمة المرور",
  city: "المدينة",
  country: "الدولة",
  birthDate: "تاريخ الميلاد",
  optionalAgentCode: "كود الوكيل (اختياري)",
  pendingTitle: "تم استلام طلبك",
  pendingBody:
    "تم استلام طلبك بنجاح. حسابك الآن قيد المراجعة من قبل الوكيل المختار. ستصلك رسالة عند التفعيل.",
  goLogin: "الانتقال إلى تسجيل الدخول",
  noteInvite:
    "عند التسجيل عبر رابط دعوة الوكيل، يبقى حسابك قيد المراجعة حتى يفعّلك الوكيل. لا تُعرض أكواد الدعوة في خانة اسم المستخدم.",
  noteAgentCode:
    "إذا أدخلت كود وكيل صحيحاً يُفعّل حسابك مباشرة. إذا تركت الخانة فارغة ولم تستخدم رابط دعوة، ستختار وكيلاً في الخطوة التالية.",
} as const;

export const REGISTRATION_PENDING_SUCCESS_AR = REGISTER_AR.pendingBody;

/** Sidebar labels — player (Arabic, unified). */
export const SIDEBAR_PLAYER_AR = {
  overview: "لوحة التحكم",
  newOrder: "طلب شحن",
  orders: "الطلبات",
  chat: "المحادثة",
  winnings: "الأرباح",
  profile: "الملف الشخصي",
} as const;

/** Sidebar labels — agent (Arabic, unified). */
export const SIDEBAR_AGENT_AR = {
  home: "الرئيسية",
  myPlayers: "لاعبوني",
  invites: "الدعوات والمكافآت",
  linkRequests: "طلبات الارتباط",
  requestsHistory: "سجل الطلبات",
  operationsLog: "سجل العمليات",
  paymentSettings: "إعدادات الدفع",
  paymentProofs: "مراجعة إثباتات الدفع",
  orders: "الطلبات",
  chat: "المحادثة",
  activations: "تفعيل اللاعبين",
  inviteAgent: "دعوة وكيل",
  recharge: "الشحن",
  balanceFromAdmin: "رصيد من الإدارة",
  withdrawals: "طلبات السحب",
  winnerRequests: "طلبات الأرباح",
  bonus: "المكافآت",
  settings: "الإعدادات",
  support: "الدعم الفني",
} as const;

const AR_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function textLooksArabic(s: string): boolean {
  return AR_CHAR.test(s);
}

export function localizeNotificationTitle(title: string): string {
  const raw = String(title ?? "").trim();
  if (!raw) return title;
  if (textLooksArabic(raw)) return title;
  const mapped = NOTIFICATION_TITLE_EN_TO_AR[raw] ?? NOTIFICATION_TITLE_EN_TO_AR[raw.toLowerCase()];
  return mapped ?? title;
}

export function localizeNotificationMessage(message: string): string {
  const raw = String(message ?? "");
  const m = raw.trim();
  if (!m) return message;
  if (textLooksArabic(m)) return message;

  if (/your payout request was rejected/i.test(m)) {
    return "تم رفض طلب السحب من قبل الإدارة.";
  }
  const completed = m.match(/Your payout of ([\d.,]+) DH has been completed\.?/i);
  if (completed) {
    return `تم إكمال طلب السحب بقيمة ${completed[1]} درهم.`;
  }
  const sent = m.match(/Your payout of ([\d.,]+) DH has been sent\.?/i);
  if (sent) {
    return `تم إرسال طلب السحب بقيمة ${sent[1]} درهم.`;
  }

  const dup = m.match(/^Order ([^ ]+) flagged for duplicate proof!/i);
  if (dup) {
    return `تم الإبلاغ عن الطلب ${dup[1]} بسبب إثبات مكرر.`;
  }
  const up = m.match(/^Player uploaded proof for order ([^ ]+)\.?/i);
  if (up) {
    return `رفع اللاعب إثبات الدفع للطلب ${up[1]}.`;
  }

  const exact = NOTIFICATION_MESSAGE_EN_TO_AR[m] ?? NOTIFICATION_MESSAGE_EN_TO_AR[m.toLowerCase()];
  return exact ?? message;
}

const NOTIFICATION_MESSAGE_EN_TO_AR: Record<string, string> = {
  "your payout request was rejected by admin.": "تم رفض طلب السحب من قبل الإدارة.",
};

/** Eastern Arabic numerals for badges and counts (UI). */
export function formatArabicNumerals(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "٠";
  return Math.floor(n).toLocaleString("ar-EG", { useGrouping: false });
}

/** Badge text for unread counts (caps at `max` with +). */
export function formatArabicUnreadBadge(count: number, max = 99): string {
  if (count <= 0) return "";
  if (count > max) return `${formatArabicNumerals(max)}+`;
  return formatArabicNumerals(count);
}

/** Chat nav badge when count &gt; threshold shows +threshold in Arabic digits. */
export function formatArabicChatOverflowBadge(count: number, threshold = 9): string {
  if (count <= threshold) return formatArabicNumerals(count);
  return `+${formatArabicNumerals(threshold)}`;
}

export function roleTitleAr(role: string | null | undefined): string {
  const k = String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return ROLE_TITLE_AR[k] ?? String(role ?? "");
}

export function statusLabelAr(status: string | null | undefined): string {
  const k = String(status ?? "").trim();
  return STATUS_LABEL_AR[k] ?? STATUS_LABEL_AR[k.toUpperCase()] ?? (status ? String(status) : "");
}
