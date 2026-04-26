"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { GlassCard, PrimaryButton, SelectField, TextArea } from "@/components/ui";
import { usePlayerTx } from "@/hooks/usePlayerTx";

/** Canonical values accepted by `POST /api/support` (Arabic labels stored in DB). */
const SUBJECT_VALUES = [
  "تأخر الشحن",
  "مشكلة في السحب",
  "شكوى ضد وكيل",
  "استفسار عام",
  "أخرى",
] as const;

type SubjectValue = (typeof SUBJECT_VALUES)[number];

const DEFAULT_SUBJECT: SubjectValue = "استفسار عام";

export function SupportModal() {
  const tp = usePlayerTx();
  const [open, setOpen] = useState(false);

  const subjectEntries = useMemo(
    () =>
      [
        { value: "تأخر الشحن" as const, labelKey: "support.subjectDelay" },
        { value: "مشكلة في السحب" as const, labelKey: "support.subjectWithdraw" },
        { value: "شكوى ضد وكيل" as const, labelKey: "support.subjectAgentComplaint" },
        { value: "استفسار عام" as const, labelKey: "support.subjectGeneral" },
        { value: "أخرى" as const, labelKey: "support.subjectOther" },
      ] as const,
    []
  );

  const ticketSchema = useMemo(
    () =>
      z.object({
        subject: z.enum(SUBJECT_VALUES),
        message: z
          .string()
          .trim()
          .min(10, tp("support.messageMin"))
          .max(8000, tp("support.messageMax")),
      }),
    [tp]
  );

  type SupportTicketForm = z.infer<typeof ticketSchema>;

  const form = useForm<SupportTicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: DEFAULT_SUBJECT,
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
        toast.error(data.message || tp("support.sendFailed"));
        return;
      }
      toast.success(tp("support.sendSuccess"));
      form.reset({ subject: DEFAULT_SUBJECT, message: "" });
      setOpen(false);
    } catch {
      toast.error(tp("profile.networkError"));
    }
  });

  return (
    <>
      <PrimaryButton
        type="button"
        className="w-full bg-white/10 text-white shadow-none hover:brightness-100 hover:bg-white/15"
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 text-balance">{tp("support.openCta")}</span>
      </PrimaryButton>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-support-dialog-title"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <GlassCard className="relative w-full max-w-md p-6 shadow-glass">
              <button
                type="button"
                className="absolute end-3 top-3 rounded-full border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
                onClick={() => setOpen(false)}
                aria-label={tp("support.close")}
              >
                <X className="h-4 w-4" />
              </button>
              <h2 id="player-support-dialog-title" className="pe-10 text-lg font-semibold text-white">
                {tp("support.title")}
              </h2>
              <p className="mt-1 text-sm text-white/55">{tp("support.subtitle")}</p>

              <form className="mt-5 space-y-4" onSubmit={onSubmit}>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50" htmlFor="support-subject">
                    {tp("support.subjectLabel")}
                  </label>
                  <Controller
                    name="subject"
                    control={form.control}
                    render={({ field }) => (
                      <SelectField id="support-subject" {...field}>
                        {subjectEntries.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {tp(entry.labelKey)}
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
                    {tp("support.messageLabel")}
                  </label>
                  <TextArea
                    id="support-message"
                    rows={6}
                    placeholder={tp("support.messagePlaceholder")}
                    {...form.register("message")}
                  />
                  {form.formState.errors.message ? (
                    <p className="mt-1 text-xs text-rose-300">{form.formState.errors.message.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <PrimaryButton
                    type="button"
                    className="min-h-[2.75rem] flex-1 bg-white/10 hover:bg-white/15"
                    onClick={() => setOpen(false)}
                  >
                    <span className="text-balance">{tp("support.cancel")}</span>
                  </PrimaryButton>
                  <PrimaryButton type="submit" className="min-h-[2.75rem] flex-1" disabled={form.formState.isSubmitting}>
                    <span className="text-balance">
                      {form.formState.isSubmitting ? tp("support.sending") : tp("support.submit")}
                    </span>
                  </PrimaryButton>
                </div>
              </form>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </>
  );
}
