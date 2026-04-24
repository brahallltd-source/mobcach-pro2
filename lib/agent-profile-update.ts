import { z } from "zod";

/** Body for `PATCH /api/agent/profile` — `username` must never be applied server-side. */
export const agentProfileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1, "الاسم الكامل مطلوب").max(200),
    email: z.string().trim().email("بريد غير صالح").max(320),
    phone: z.string().trim().min(6, "رقم الهاتف قصير جداً").max(40),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmNewPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasAny = Boolean(
      (data.currentPassword && data.currentPassword.length > 0) ||
        (data.newPassword && data.newPassword.length > 0) ||
        (data.confirmNewPassword && data.confirmNewPassword.length > 0)
    );
    if (!hasAny) return;
    if (!data.currentPassword?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "أدخل كلمة المرور الحالية لتغييرها",
        path: ["currentPassword"],
      });
    }
    if (!data.newPassword?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "أدخل كلمة المرور الجديدة",
        path: ["newPassword"],
      });
    }
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تأكيد كلمة المرور غير متطابق",
        path: ["confirmNewPassword"],
      });
    }
    if (data.newPassword && data.newPassword.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        path: ["newPassword"],
      });
    }
  });

export type AgentProfileUpdateInput = z.infer<typeof agentProfileUpdateSchema>;
