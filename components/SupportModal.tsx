"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { GlassCard, PrimaryButton, SelectField, TextArea } from "@/components/ui";

const SUBJECT_OPTIONS = [
  "تأخر الشحن",
  "مشكلة في السحب",
  "شكوى ضد وكيل",
  "استفسار عام",
  "أخرى",
] as const;

const supportTicketSchema = z.object({
  subject: z.enum(SUBJECT_OPTIONS),
  message: z.string().trim().min(10, "الرسالة يجب أن تكون 10 أحرف على الأقل").max(8000, "الرسالة طويلة جداً"),
});

type SupportTicketForm = z.infer<typeof supportTicketSchema>;

/** Dialog-style support form (Radix-free). Posts to `POST /api/support`. */
export function SupportModal() {
  const [open, setOpen] = useState(false);
  const form = useForm<SupportTicketForm>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: "استفسار عام",
      message: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: values.subject,
          message: values.message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        toast.error(data.message || "فشل الإرسال");
        return;
      }
      toast.success("تم إرسال رسالتك بنجاح. سيقوم فريقنا بالرد عليك قريباً.");
      form.reset({ subject: "استفسار عام", message: "" });
      setOpen(false);
    } catch {
      toast.error("خطأ في الشبكة");
    }
  });

  return (
    <>
      <PrimaryButton
        type="button"
        className="w-full bg-white/10 text-white shadow-none hover:brightness-100 hover:bg-white/15"
        onClick={() => setOpen(true)}
      >
        الدعم الفني 🎧
      </PrimaryButton>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-support-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <GlassCard
            className="relative w-full max-w-md p-6 shadow-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute end-3 top-3 rounded-full border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id="player-support-dialog-title" className="text-lg font-semibold text-white">
              الدعم الفني
            </h2>
            <p className="mt-1 text-sm text-white/55">اختر نوع الطلب ثم اشرح المشكلة. سنرد عليك من فريق الدعم.</p>

            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50" htmlFor="support-subject">
                  الموضوع
                </label>
                <Controller
                  name="subject"
                  control={form.control}
                  render={({ field }) => (
                    <SelectField id="support-subject" {...field}>
                      {SUBJECT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </SelectField>
                  )}
                />
                {form.formState.errors.subject ? (
                  <p className="mt-1 text-xs text-rose-300">{form.formState.errors.subject.message}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50" htmlFor="support-message">
                  الرسالة
                </label>
                <TextArea id="support-message" rows={6} placeholder="صف المشكلة…" {...form.register("message")} />
                {form.formState.errors.message ? (
                  <p className="mt-1 text-xs text-rose-300">{form.formState.errors.message.message}</p>
                ) : null}
              </div>
              <div className="flex gap-2 pt-1">
                <PrimaryButton type="button" className="flex-1 bg-white/10 hover:bg-white/15" onClick={() => setOpen(false)}>
                  إلغاء
                </PrimaryButton>
                <PrimaryButton type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "جاري الإرسال…" : "إرسال"}
                </PrimaryButton>
              </div>
            </form>
          </GlassCard>
        </div>
      ) : null}
    </>
  );
}
