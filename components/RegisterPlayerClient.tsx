"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AgentProfileCard, type AgentProfilePaymentMethod } from "@/components/AgentProfileCard";
import { GlassCard, OutlineButton, PrimaryButton, Shell } from "@/components/ui";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLanguage } from "@/components/language";
import { clearClientSession, fetchSessionUser, saveClientSession } from "@/lib/client-session";
import { REGISTER_AR } from "@/lib/constants/i18n";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { registerPlayerApiSchema, type RegisterPlayerApiValues } from "@/lib/validations/auth";
import { syncPushSubscriptionWithServer } from "@/hooks/usePushNotifications";

const AGENT_PICKER_SUCCESS_AR =
  "تم إنشاء حسابك وتفعيله بنجاح وربطه بالوكيل بشكل فوري. يمكنك الآن تسجيل الدخول مباشرة.";

type DiscoveryAgent = {
  agentId: string;
  display_name: string;
  username: string;
  online: boolean;
  rating_percent: number;
  paymentMethods?: AgentProfilePaymentMethod[];
};

type RegisterPlayerClientProps = {
  registerApiPath?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  /**
   * When true (and no `?ref=` invite), registration is two steps: validated profile form,
   * then horizontal agent list; final `POST` sends `selectedAgentId` for instant connected activation.
   */
  multiStepAgentSelection?: boolean;
};

type RegisterUserPayload = {
  id?: string;
  email?: string;
  username?: string;
  role?: string;
  status?: string | null;
  assigned_agent_id?: string | null;
};

function sanitizeMoroccoLocal(raw: string): string {
  let d = raw.replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (d.length > 0 && d[0] !== "6" && d[0] !== "7") {
    d = d.replace(/^[^67]+/, "");
  }
  return d.slice(0, 9);
}

function sanitizeInternationalLocal(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 12);
}

function validateLocalPhone(dialCode: string, local: string): string | null {
  if (dialCode === "+212") {
    // Matches +212[5-7]XXXXXXXX after server-side normalization.
    if (!/^[5-7]\d{8}$/.test(local)) {
      return "رقم الهاتف المغربي غير صالح. الصيغة الصحيحة مثال: +212612345678";
    }
    return null;
  }

  if (!/^\d{6,12}$/.test(local)) {
    return "رقم الهاتف غير صالح. أدخل بين 6 و12 أرقام.";
  }
  return null;
}

function resolvePostRegistrationRedirect(args: {
  role: string;
  nextStep?: string;
  redirectAfterLogin?: string;
  hasAgentCode: boolean;
}): string {
  if (args.redirectAfterLogin) return args.redirectAfterLogin;
  if (args.nextStep) return args.nextStep;
  const r = args.role.toUpperCase();
  if (r === "AGENT") return "/agent/dashboard";
  if (r === "PLAYER") {
    return args.hasAgentCode ? "/player/dashboard" : "/player/select-agent";
  }
  return "/player/dashboard";
}

export function RegisterPlayerClient({
  registerApiPath = "/api/auth/register",
  pageTitle,
  pageSubtitle,
  multiStepAgentSelection = false,
}: RegisterPlayerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState<DiscoveryAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [joiningAgentId, setJoiningAgentId] = useState<string | null>(null);
  const [agentPickerSuccess, setAgentPickerSuccess] = useState(false);
  const [selectedDialCode, setSelectedDialCode] = useState("+212");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterPlayerApiValues>({
    resolver: zodResolver(registerPlayerApiSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      country: "Morocco",
      city: "",
      dateOfBirth: "",
      inviteCode: "",
      agent_code: "",
    },
  });
  const {
    formState: { errors },
  } = form;

  const inviteTrim = inviteCodeFromUrl.trim();
  const dialCodeOptions = Array.from(new Set(COUNTRY_OPTIONS.map((c) => c.dialCode)));
  const typedAgentCode = form.watch("agent_code");
  /** Two-step profile + agent list when enabled and not registering via `?ref=` invite. */
  const isAgentPickerFlow = Boolean(multiStepAgentSelection) && !inviteTrim;

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim();
    setInviteCodeFromUrl(ref ?? "");
  }, [searchParams]);

  useEffect(() => {
    form.setValue("inviteCode", inviteCodeFromUrl);
  }, [inviteCodeFromUrl, form]);

  useEffect(() => {
    if (!isAgentPickerFlow || step !== 2) return;
    let cancelled = false;
    setAgentsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/agents/active", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { agents?: DiscoveryAgent[] };
        if (!cancelled) setAgents(Array.isArray(data.agents) ? data.agents : []);
      } catch {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAgentPickerFlow, step]);

  useEffect(() => {
    void (async () => {
      const u = (await fetchSessionUser()) as Record<string, unknown> | null;
      setSessionUser(u);
      setSessionChecked(true);
    })();
  }, []);

  const logoutExistingSession = async () => {
    const nativePushToken =
      typeof window !== "undefined" ? localStorage.getItem("native_push_token") ?? "" : "";
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nativePushToken: nativePushToken || undefined,
        }),
      });
    } catch {
      /* ignore */
    }
    try {
      clearClientSession();
      localStorage.removeItem("native_push_token");
    } catch {
      /* ignore */
    }
    setSessionUser(null);
    toast.success("تم تسجيل الخروج — يمكنك الآن إنشاء حساب جديد.");
  };

  const validatePhoneField = (phoneLocal: string): boolean => {
    const msg = validateLocalPhone(selectedDialCode, phoneLocal);
    if (msg) {
      form.setError("phone", { type: "manual", message: msg });
      return false;
    }
    form.clearErrors("phone");
    return true;
  };

  const postRegister = async (payload: Record<string, unknown>) => {
    const res = await fetch(registerApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      message?: string;
      role?: string;
      user?: RegisterUserPayload | null;
      nextStep?: string;
    };
    return { ok: res.ok, status: res.status, ...data };
  };

  async function registerAfterValidation(
    values: RegisterPlayerApiValues,
    opts?: { selectedAgentId?: string }
  ) {
    setLoading(true);
    try {
      const phoneLocalRaw = String(values.phone ?? "");
      const phoneLocal = phoneLocalRaw.replace(/\D/g, "");
      const fullPhone = `${selectedDialCode}${phoneLocal}`;
      const resolvedCountry =
        COUNTRY_OPTIONS.find((c) => c.dialCode === selectedDialCode)?.value || "Morocco";
      const data = await postRegister({
        ...values,
        name: values.username,
        email: String(values.email ?? "").trim().toLowerCase(),
        phone: fullPhone,
        country: resolvedCountry,
        city: "",
        dateOfBirth: "",
        role: "PLAYER",
        inviteCode: inviteTrim || values.inviteCode || "",
        agent_code: (inviteTrim || opts?.selectedAgentId) ? "" : values.agent_code || "",
        ...(opts?.selectedAgentId ? { selectedAgentId: opts.selectedAgentId } : {}),
      });

      if (!data.ok) {
        throw new Error(
          (typeof data.error === "string" && data.error) ||
            (typeof data.message === "string" && data.message) ||
            "فشل التسجيل. يرجى التحقق من البيانات."
        );
      }

      toast.success("تم إنشاء الحساب بنجاح!");

      const role = String(data.role || "PLAYER").toUpperCase();
      const nextStep = typeof data.nextStep === "string" && data.nextStep.trim() ? data.nextStep.trim() : "";
      const hasAgentCode = Boolean(inviteTrim || values.agent_code?.trim() || opts?.selectedAgentId);

      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: values.username.trim(),
          password: values.password,
        }),
      });
      const loginJson = (await loginRes.json().catch(() => ({}))) as {
        success?: boolean;
        redirectAfterLogin?: string;
        user?: unknown;
        message?: string;
        sessionToken?: string;
      };

      const redirectAfterLogin =
        typeof loginJson.redirectAfterLogin === "string" && loginJson.redirectAfterLogin.trim()
          ? loginJson.redirectAfterLogin.trim()
          : undefined;

      const targetDashboard = resolvePostRegistrationRedirect({
        role,
        nextStep,
        redirectAfterLogin,
        hasAgentCode,
      });

      if (loginRes.ok && loginJson.success === true) {
        if (loginJson.user && typeof loginJson.user === "object") {
          saveClientSession(loginJson.user, loginJson.sessionToken);
        } else if (data.user && typeof data.user === "object") {
          saveClientSession(data.user);
        }
        void syncPushSubscriptionWithServer();
        router.push(targetDashboard);
        return;
      }

      if (data.user && typeof data.user === "object") {
        saveClientSession(data.user);
      }
      toast.error(
        typeof loginJson.message === "string" && loginJson.message
          ? loginJson.message
          : "تعذّر تسجيل الدخول تلقائياً. سجّل الدخول يدوياً من صفحة الدخول."
      );
      router.push("/login");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ في الشبكة، المرجو المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  }

  const onFormInvalid = (errors: FieldErrors<RegisterPlayerApiValues>) => {
    console.log("Form Errors:", errors);
    toast.error("يرجى تصحيح الحقول المطلوبة قبل المتابعة.");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!validatePhoneField(values.phone)) return;
    await registerAfterValidation(values);
  }, onFormInvalid);

  const onStep1Next = form.handleSubmit((values) => {
    if (!validatePhoneField(values.phone)) return;
    const hasAgentCode = String(values.agent_code ?? "").trim().length > 0;
    if (hasAgentCode) {
      void registerAfterValidation(values);
      return;
    }
    setStep(2);
  }, onFormInvalid);

  async function handleSelectAgent(agentId: string) {
    const values = form.getValues();
    setJoiningAgentId(agentId);
    try {
      await registerAfterValidation(values, { selectedAgentId: agentId });
    } finally {
      setJoiningAgentId(null);
    }
  }

  useEffect(() => {
    if (inviteTrim) {
      setStep(1);
      setAgentPickerSuccess(false);
    }
  }, [inviteTrim]);

  const title = pageTitle ?? t("playerRegistration");
  const subtitle =
    pageSubtitle ??
    (inviteTrim
      ? "أنت تسجّل عبر رابط دعوة وكيل. سيتم تفعيل حسابك وربطه بالوكيل مباشرة."
      : isAgentPickerFlow
        ? "الخطوة 1: بيانات الحساب. ثم اختر وكيلك من القائمة في الخطوة 2 للتفعيل الفوري."
        : "أنشئ حسابك الآن. أدخل كود الوكيل لتفعيل الحساب وربطه مباشرة.");

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-white/60 md:text-base">{subtitle}</p>
        </div>
        {isAgentPickerFlow ? (
          <div className="flex justify-center">
            <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-100">
              {step === 1 ? "الخطوة ١ من ٢ — البيانات" : "الخطوة ٢ من ٢ — اختيار الوكيل"}
            </span>
          </div>
        ) : null}

        {sessionChecked && sessionUser ? (
          <GlassCard className="border border-amber-400/30 bg-amber-500/10 p-4 backdrop-blur-md md:p-5">
            <p className="text-sm font-medium text-amber-50">
              أنت مسجّل الدخول بالفعل بحساب آخر. لتجنّب خلط الجلسات مع الحساب الجديد، يُنصح بتسجيل الخروج أولاً ثم
              إكمال التسجيل.
            </p>
            <PrimaryButton type="button" className="mt-4" onClick={() => void logoutExistingSession()}>
              تسجيل الخروج والمتابعة
            </PrimaryButton>
          </GlassCard>
        ) : null}

        {agentPickerSuccess ? (
          <GlassCard className="relative overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-white/[0.04] to-cyan-600/10 p-8 text-center shadow-2xl backdrop-blur-md md:p-12">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/40">
                <CheckCircle2 className="h-9 w-9 text-emerald-300" aria-hidden />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">تم بنجاح</h2>
              <p className="text-base leading-relaxed text-white/85 md:text-lg">{AGENT_PICKER_SUCCESS_AR}</p>
              <PrimaryButton type="button" className="mt-2 min-w-[200px]" onClick={() => router.push("/login")}>
                {REGISTER_AR.goLogin}
              </PrimaryButton>
            </div>
          </GlassCard>
        ) : isAgentPickerFlow && step === 2 ? (
          <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md md:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">اختر وكيلك</h2>
                <p className="mt-1 text-sm text-white/60">مرّر أفقياً واضغط «اختيار هذا الوكيل» على الوكيل المناسب.</p>
              </div>
              <OutlineButton
                type="button"
                className="shrink-0 !border-white/20 !text-slate-200 shadow-none transition-colors hover:!border-white/30 hover:!bg-white/10 hover:!text-white"
                onClick={() => setStep(1)}
              >
                ← تعديل البيانات
              </OutlineButton>
            </div>
            {agentsLoading ? (
              <p className="py-16 text-center text-white/60">جاري تحميل قائمة الوكلاء…</p>
            ) : agents.length === 0 ? (
              <p className="py-12 text-center text-white/55">لا يوجد وكلاء متاحون حالياً. حاول لاحقاً أو عدّل بياناتك.</p>
            ) : (
              <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin md:mx-0">
                {agents.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="w-[min(100%,22rem)] shrink-0 snap-center px-2 first:pl-3 last:pr-3 md:w-[24rem]"
                  >
                    <div className={joiningAgentId === agent.agentId ? "pointer-events-none opacity-60" : ""}>
                      <AgentProfileCard
                        agent={{
                          id: agent.agentId,
                          name: agent.display_name,
                          username: agent.username,
                          isOnline: agent.online,
                          rating: agent.rating_percent,
                          paymentMethods: agent.paymentMethods,
                        }}
                        headerLabel="وكيل متاح"
                        actionButtonLabel="اختيار هذا الوكيل"
                        onAction={() => void handleSelectAgent(agent.agentId)}
                      />
                      {joiningAgentId === agent.agentId ? (
                        <div className="pointer-events-none -mt-2 flex justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        ) : (
          <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md md:p-8">
            <Form {...form}>
              <form
                onSubmit={isAgentPickerFlow && step === 1 ? onStep1Next : onSubmit}
                className="space-y-6"
              >
                <input type="hidden" name="role" value="PLAYER" readOnly aria-hidden />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{REGISTER_AR.username} *</FormLabel>
                        <FormControl>
                          <Input placeholder={REGISTER_AR.username} autoComplete="username" {...field} />
                        </FormControl>
                        <FormMessage />
                        {errors.username?.message ? (
                          <p className="mt-1 text-xs text-rose-300">{String(errors.username.message)}</p>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>* {t("emailAddress")}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        {errors.email?.message ? (
                          <p className="mt-1 text-xs text-rose-300">{String(errors.email.message)}</p>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{REGISTER_AR.password} *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder={REGISTER_AR.password}
                              autoComplete="new-password"
                              className="pr-12"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-white/45 transition hover:text-white/70"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                        {errors.password?.message ? (
                          <p className="mt-1 text-xs text-rose-300">{String(errors.password.message)}</p>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تأكيد كلمة المرور *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="أعد إدخال كلمة المرور"
                              autoComplete="new-password"
                              className="pr-12"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((v) => !v)}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-white/45 transition hover:text-white/70"
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                        {errors.confirmPassword?.message ? (
                          <p className="mt-1 text-xs text-rose-300">
                            {String(errors.confirmPassword.message)}
                          </p>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("phoneNumberWhatsApp")} *</FormLabel>
                        <FormControl>
                          <div className="flex overflow-hidden rounded-md border border-input bg-background">
                            <span
                              dir="ltr"
                              className="inline-flex items-center rounded-l-md rounded-r-none border border-r-0 border-input bg-muted px-2 py-1.5 text-xs text-muted-foreground"
                            >
                              <select
                                dir="ltr"
                                value={selectedDialCode}
                                onChange={(e) => {
                                  const nextDial = e.target.value;
                                  setSelectedDialCode(nextDial);
                                  const current = String(form.getValues("phone") ?? "");
                                  const cleaned =
                                    nextDial === "+212"
                                      ? sanitizeMoroccoLocal(current)
                                      : sanitizeInternationalLocal(current);
                                  form.setValue("phone", cleaned, { shouldDirty: true, shouldValidate: false });
                                }}
                                className="rounded-md border border-white/15 bg-background px-2 py-1 text-xs text-white outline-none"
                                aria-label="Country code"
                              >
                                {dialCodeOptions.map((code) => (
                                  <option key={code} value={code}>
                                    {code}
                                  </option>
                                ))}
                              </select>
                            </span>
                            <input
                              dir="ltr"
                              type="text"
                              inputMode="numeric"
                              autoComplete="tel-national"
                              placeholder="612345678"
                              className="min-w-0 flex-1 rounded-l-none rounded-r-md border-0 bg-background px-3 py-3 text-left text-sm text-white outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                              value={field.value}
                              onChange={(e) => {
                                const next =
                                  selectedDialCode === "+212"
                                    ? sanitizeMoroccoLocal(e.target.value)
                                    : sanitizeInternationalLocal(e.target.value);
                                field.onChange(next);
                                if (errors.phone) form.clearErrors("phone");
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        {errors.phone?.message ? (
                          <p className="mt-1 text-xs text-rose-300">{String(errors.phone.message)}</p>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  {!inviteTrim ? (
                    <FormField
                      control={form.control}
                      name="agent_code"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>{t("optionalAgentCode")}</FormLabel>
                          <FormControl>
                            <Input {...field} className="border-cyan-500/30" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  {inviteTrim ? (
                    <p className="md:col-span-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                      تم التقاط رمز الدعوة من الرابط بشكل آمن ولن يُعرض في خانة اسم المستخدم.
                    </p>
                  ) : isAgentPickerFlow ? (
                    <p className="md:col-span-2 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-50">
                      بعد التحقق من بياناتك ستنتقل لاختيار وكيل من القائمة في الخطوة التالية.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-primary/20 bg-muted/10 p-4 text-sm text-white/60 backdrop-blur-sm">
                  {inviteTrim ? (
                    <>{REGISTER_AR.noteInvite}</>
                  ) : isAgentPickerFlow ? (
                    <>
                      تسجيلك كـ <span className="font-semibold text-cyan-200">PLAYER</span> فقط. اختيار الوكيل في
                      الخطوة التالية يفعّل الحساب تلقائياً ويربطه بالوكيل مباشرة.
                    </>
                  ) : (
                    <>
                      {REGISTER_AR.noteAgentCode} يتم تفعيل اللاعب وربطه بالوكيل بشكل فوري عبر{" "}
                      <span className="font-semibold text-cyan-200">PLAYER</span> فقط.
                    </>
                  )}
                </div>

                <PrimaryButton type="submit" disabled={loading} className="w-full md:w-auto">
                  {loading
                    ? t("processing")
                    : isAgentPickerFlow && step === 1
                      ? String(typedAgentCode ?? "").trim()
                        ? "إنشاء الحساب وبدء اللعب"
                        : "المتابعة — اختيار الوكيل"
                      : t("continueNext")}
                </PrimaryButton>
              </form>
            </Form>
          </GlassCard>
        )}
      </div>
    </Shell>
  );
}
