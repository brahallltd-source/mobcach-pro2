import * as z from "zod";
import { getDialCode } from "@/lib/countries";

/** Morocco national mobile: 9 digits starting with 6 or 7 (no leading 0, no country code). */
export const MA_NATIONAL_PHONE_REGEX = /^(6|7)\d{8}$/;

/** Morocco international (stored in DB / sent to API). */
export const MA_INTL_PHONE_REGEX = /^\+212(6|7)\d{8}$/;

export const MA_NATIONAL_PHONE_MESSAGE =
  "رقم الهاتف يجب أن يكون 9 أرقام تبدأ بـ 6 أو 7 (بدون 0 في البداية)";

export const AGENT_MIN_AGE_MESSAGE =
  "يجب أن يكون عمرك 18 سنة أو أكثر للتسجيل كوكيل";

function ageYearsOnDate(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function parseLocalDateOnly(value: string): Date {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!parts) return new Date(NaN);
  const y = Number(parts[1]);
  const m = Number(parts[2]);
  const d = Number(parts[3]);
  return new Date(y, m - 1, d);
}

/** Normalize wire value to national digits only for Zod (accepts legacy +212… from API clients). */
export function extractNationalPhoneForAgentSchema(rawPhone: string, country: string): string {
  const p = String(rawPhone || "").replace(/\s+/g, "");
  if (country === "Morocco") {
    if (MA_INTL_PHONE_REGEX.test(p)) return p.slice(4);
    return p.replace(/\D/g, "");
  }
  const dial = getDialCode(country);
  if (dial && p.startsWith(dial)) return p.slice(dial.length).replace(/\D/g, "");
  return p.replace(/\D/g, "");
}

function isValidNationalForCountry(national: string, country: string): boolean {
  if (country === "Morocco") {
    return MA_NATIONAL_PHONE_REGEX.test(national);
  }
  return /^\d{8,12}$/.test(national);
}

export const agentRegisterSchema = z
  .object({
    fullName: z.string().trim().min(2, "الاسم الكامل مطلوب"),
    username: z.string().trim().min(2, "اسم المستخدم مطلوب"),
    email: z.string().trim().email("البريد الإلكتروني غير صالح"),
    password: z.string().min(8, { message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }),
    /** No min length here; cross-field rules below. */
    confirmPassword: z.string().optional(),
    birthDate: z
      .string({ required_error: "تاريخ الميلاد مطلوب" })
      .trim()
      .min(1, "تاريخ الميلاد مطلوب")
      .transform(parseLocalDateOnly),
    country: z.string().trim().min(1, "الدولة مطلوبة"),
    city: z.string().trim().min(1, "المدينة مطلوبة"),
    phoneNumber: z
      .string()
      .trim()
      .transform((s) => s.replace(/\s+/g, "")),
    note: z.string().trim().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "أكد كلمة المرور",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    const national = extractNationalPhoneForAgentSchema(data.phoneNumber, data.country);
    if (!isValidNationalForCountry(national, data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          data.country === "Morocco"
            ? MA_NATIONAL_PHONE_MESSAGE
            : "رقم الهاتف غير صالح لهذه الدولة (8–12 رقماً بعد رمز الدولة)",
        path: ["phoneNumber"],
      });
    }

    const today = new Date();
    if (Number.isNaN(data.birthDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاريخ الميلاد غير صالح",
        path: ["birthDate"],
      });
      return;
    }
    if (data.birthDate.getTime() > today.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاريخ الميلاد لا يمكن أن يكون في المستقبل",
        path: ["birthDate"],
      });
      return;
    }
    if (ageYearsOnDate(data.birthDate, today) < 18) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: AGENT_MIN_AGE_MESSAGE,
        path: ["birthDate"],
      });
    }
  })
  .transform((data) => {
    const national = extractNationalPhoneForAgentSchema(data.phoneNumber, data.country);
    const dial = getDialCode(data.country) || "+";
    const phoneNumber =
      data.country === "Morocco" ? `+212${national}` : `${dial}${national}`;
    return { ...data, phoneNumber };
  });

export type AgentRegisterFormValues = z.infer<typeof agentRegisterSchema>;

export type AgentRegisterFormInput = z.input<typeof agentRegisterSchema>;

export function normalizeAgentBirthDateInput(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const s = v.trim();
    const head = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    if (head) return head[1]!;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

export function formatAgentRegisterFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_root";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Payload sent to `/api/apply-agent` (no `confirmPassword`). */
export type AgentRegisterApiPayload = Omit<AgentRegisterFormValues, "confirmPassword">;
