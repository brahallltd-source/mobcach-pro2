"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SelectField,
  Shell,
  TextArea,
  TextField,
} from "@/components/ui";
import { COUNTRY_OPTIONS, getDialCode } from "@/lib/countries";
import {
  agentRegisterSchema,
  normalizeAgentBirthDateInput,
  type AgentRegisterFormInput,
  type AgentRegisterFormValues,
} from "@/lib/validations/agent-register";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-400">{message}</p>;
}

function maxAdultBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

function sanitizeMoroccoLocal(raw: string): string {
  let d = raw.replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (d.length > 0 && d[0] !== "6" && d[0] !== "7") {
    d = d.replace(/^[^67]+/, "");
  }
  return d.slice(0, 9);
}

function sanitizeOtherLocal(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 12);
}

function RegisterAgentPageContent() {
  const searchParams = useSearchParams();
  const inviteRef = useRef<string>("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AgentRegisterFormInput, unknown, AgentRegisterFormValues>({
    resolver: zodResolver(agentRegisterSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      birthDate: "",
      country: "Morocco",
      city: "",
      phoneNumber: "",
      note: "",
    },
  });

  const country = watch("country");
  const dial = getDialCode(country) || "+";
  const isMorocco = country === "Morocco";

  useEffect(() => {
    const r = searchParams.get("ref")?.trim();
    if (r) inviteRef.current = r;
  }, [searchParams]);

  const prevCountryRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevCountryRef.current === null) {
      prevCountryRef.current = country;
      return;
    }
    if (prevCountryRef.current !== country) {
      prevCountryRef.current = country;
      setValue("phoneNumber", "", { shouldValidate: false, shouldDirty: true });
    }
  }, [country, setValue]);

  const onSubmit = async (values: AgentRegisterFormValues) => {
    try {
      const { confirmPassword: _confirmPassword, birthDate, ...rest } = values;
      void _confirmPassword;

      const res = await fetch("/api/apply-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          birthDate: normalizeAgentBirthDateInput(birthDate),
          accountType: "AGENT",
          ...(inviteRef.current ? { ref: inviteRef.current } : {}),
        }),
      });

      let data: {
        success?: boolean;
        message?: string;
        fieldErrors?: Record<string, string>;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok) {
        if (data.fieldErrors) {
          for (const [key, msg] of Object.entries(data.fieldErrors)) {
            setError(key as FieldPath<AgentRegisterFormInput>, {
              type: "server",
              message: msg,
            });
          }
        }
        alert(data.message || "Application failed");
        return;
      }

      alert(data.message || "Application submitted");
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader
          title="Become an agent"
          subtitle="Complete the form below. All fields are validated before your application is sent for admin review."
        />
        <GlassCard className="p-6 md:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-y-5 gap-x-6 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-1">
              <TextField placeholder="Full name" autoComplete="name" {...register("fullName")} />
              <FieldError message={errors.fullName?.message} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-1">
              <TextField placeholder="Username" autoComplete="username" {...register("username")} />
              <FieldError message={errors.username?.message} />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <TextField type="email" placeholder="Email" autoComplete="email" {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Country</label>
                <SelectField {...register("country")}>
                  {COUNTRY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} ({item.dialCode})
                    </option>
                  ))}
                </SelectField>
                <FieldError message={errors.country?.message} />
              </div>
              <div className="flex flex-col gap-1">
                <TextField placeholder="City" autoComplete="address-level2" {...register("city")} />
                <FieldError message={errors.city?.message} />
              </div>
            </div>

            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Birth date</label>
              <input
                type="date"
                max={maxAdultBirthDate()}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-white outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                {...register("birthDate")}
              />
              <FieldError message={errors.birthDate?.message as string | undefined} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-1">
              <TextField type="password" placeholder="Password" autoComplete="new-password" {...register("password")} />
              <FieldError message={errors.password?.message} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-1">
              <TextField
                type="password"
                placeholder="Confirm password"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Phone number</label>
              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => (
                  <div className="flex overflow-hidden rounded-md border border-input bg-background">
                    <span
                      className="inline-flex items-center rounded-l-md rounded-r-none border border-r-0 border-input bg-muted px-3 py-3 text-sm text-muted-foreground"
                      aria-hidden
                    >
                      {dial}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="--------"
                      className="min-w-0 flex-1 rounded-l-none rounded-r-md border-0 bg-background px-3 py-3 text-sm text-white outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                      value={field.value}
                      onChange={(e) => {
                        const next = isMorocco
                          ? sanitizeMoroccoLocal(e.target.value)
                          : sanitizeOtherLocal(e.target.value);
                        field.onChange(next);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </div>
                )}
              />
              <FieldError message={errors.phoneNumber?.message} />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <TextArea rows={4} placeholder="Why do you want to become an agent?" {...register("note")} />
              <FieldError message={errors.note?.message} />
            </div>
            <div className="md:col-span-2">
              <PrimaryButton type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                {isSubmitting ? "Submitting..." : "Submit application"}
              </PrimaryButton>
            </div>
          </form>
        </GlassCard>
      </div>
    </Shell>
  );
}

export default function RegisterAgentPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="mx-auto max-w-4xl py-12 text-center text-white/70">Loading…</div>
        </Shell>
      }
    >
      <RegisterAgentPageContent />
    </Suspense>
  );
}
