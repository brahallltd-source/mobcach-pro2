import * as z from "zod";

/** Age in full years from a `YYYY-MM-DD` (or parseable) date string. */
export function computeAgeFromDateString(dateString: string): number {
  const today = new Date();
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) return -1;
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function assertAdultDateString(dateString: string, minAge = 18): boolean {
  return computeAgeFromDateString(dateString) >= minAge;
}

const dateOfBirthStringSchema = z
  .string()
  .min(1, "يرجى إدخال تاريخ الميلاد")
  .refine(
    (dateString) => assertAdultDateString(dateString, 18),
    { message: "عذراً، يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل" }
  );

/**
 * Player self-registration (public). Includes username + optional invite/agent codes for the API.
 * Server must re-validate with the same schema.
 */
export const registerPlayerApiSchema = z
  .object({
    name: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
    email: z
      .string()
      .email("بريد إلكتروني غير صالح")
      .transform((s) => s.trim().toLowerCase()),
    phone: z.string().min(8, "رقم الهاتف قصير جداً"),
    country: z.string().min(2, "يرجى إدخال البلد"),
    city: z.string().min(2, "يرجى إدخال المدينة"),
    dateOfBirth: dateOfBirthStringSchema,
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    confirmPassword: z.string().min(1, "يرجى تأكيد كلمة المرور"),
    username: z.string().min(2, "اسم المستخدم قصير جداً"),
    inviteCode: z.string().optional(),
    agent_code: z.string().optional(),
    /** Public registration: chosen agent (`Agent.id`) from marketplace slider — creates `AgentCustomer` with `PENDING`. */
    selectedAgentId: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || z.string().uuid().safeParse(v).success, {
        message: "معرف الوكيل غير صالح",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export type RegisterPlayerApiValues = z.infer<typeof registerPlayerApiSchema>;

/** Alias for docs / imports that expect `registerSchema`. */
export const registerSchema = registerPlayerApiSchema;

export type RegisterFormValues = RegisterPlayerApiValues;

/** KYC patch when submitting agent interest from profile (`/api/agent-requests`). */
export const agentRequestKycSchema = z.object({
  country: z.string().min(2, "يرجى إدخال البلد"),
  city: z.string().min(2, "يرجى إدخال المدينة"),
  dateOfBirth: dateOfBirthStringSchema,
});

export type AgentRequestKycValues = z.infer<typeof agentRequestKycSchema>;

/** Player → Agent application (`/api/player/become-agent`). */
export const becomeAgentApplicationSchema = z.object({
  userId: z.string().min(1, "معرف المستخدم مطلوب"),
  username: z.string().optional(),
  name: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
  email: z
    .string()
    .email("بريد إلكتروني غير صالح")
    .transform((s) => s.trim().toLowerCase()),
  phone: z.string().min(8, "رقم الهاتف قصير جداً"),
  country: z.string().min(2, "يرجى إدخال البلد"),
  city: z.string().min(2, "يرجى إدخال المدينة"),
  dateOfBirth: dateOfBirthStringSchema,
  note: z.string().optional(),
});

export type BecomeAgentApplicationValues = z.infer<typeof becomeAgentApplicationSchema>;
