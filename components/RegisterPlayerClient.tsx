"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AgentProfileCard, type AgentProfilePaymentMethod } from "@/components/AgentProfileCard";
import { GlassCard, OutlineButton, PrimaryButton, SelectField, Shell } from "@/components/ui";
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
import { COUNTRY_OPTIONS, getDialCode } from "@/lib/countries";
import { fetchSessionUser } from "@/lib/client-session";
import { REGISTER_AR, REGISTRATION_PENDING_SUCCESS_AR } from "@/lib/constants/i18n";
import { registerPlayerApiSchema, type RegisterPlayerApiValues } from "@/lib/validations/auth";

const AGENT_PICKER_SUCCESS_AR =
  "تم إنشاء حسابك وإرسال طلب الربط بالوكيل. عند الموافقة يمكنك تسجيل الدخول ومتابعة حالة الطلب من لوحة اللاعب.";

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
   * then horizontal agent list; final `POST` sends `selectedAgentId` for `AgentCustomer` `PENDING`.
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
    return args.hasAgentCode ? "/player/dashboard" : "/player/choose-agent";
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
  const [pendingAgentApproval, setPendingAgentApproval] = useState(false);
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState<DiscoveryAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [joiningAgentId, setJoiningAgentId] = useState<string | null>(null);
  const [agentPickerSuccess, setAgentPickerSuccess] = useState(false);

  const form = useForm<RegisterPlayerApiValues>({
    resolver: zodResolver(registerPlayerApiSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      phone: "+212",
      password: "",
      confirmPassword: "",
      country: "Morocco",
      city: "",
      dateOfBirth: "",
      inviteCode: "",
      agent_code: "",
    },
  });

  const inviteTrim = inviteCodeFromUrl.trim();
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

  const syncPhoneDialFromCountry = (country: string) => {
    const dial = getDialCode(country);
    if (dial) form.setValue("phone", dial, { shouldValidate: true });
  };

  const logoutExistingSession = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("mobcash_user");
    } catch {
      /* ignore */
    }
    setSessionUser(null);
    toast.success("تم تسجيل الخروج — يمكنك الآن إنشاء حساب جديد.");
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
    const fromSlider = Boolean(opts?.selectedAgentId);
    setLoading(true);
    try {
      const data = await postRegister({
        ...values,
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

      const userStatus = String(data.user?.status ?? "").toUpperCase();
      const isPendingApproval = userStatus === "PENDING_APPROVAL";

      if (isPendingApproval) {
        toast.success(fromSlider ? "تم إنشاء الحساب — طلبك قيد المراجعة." : "تم إنشاء الحساب — قيد المراجعة لدى الوكيل.");
        try {
          const loginRes = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              identifier: values.email.trim(),
              password: values.password,
            }),
          });
          const loginJson = (await loginRes.json().catch(() => ({}))) as {
            success?: boolean;
            user?: unknown;
          };
          if (loginRes.ok && loginJson.success === true && loginJson.user && typeof loginJson.user === "object") {
            localStorage.setItem("mobcash_user", JSON.stringify(loginJson.user));
          } else if (data.user) {
            localStorage.setItem("mobcash_user", JSON.stringify(data.user));
          }
        } catch {
          if (data.user) {
            localStorage.setItem("mobcash_user", JSON.stringify(data.user));
          }
        }
        if (fromSlider) {
          setAgentPickerSuccess(true);
        } else {
          setPendingAgentApproval(true);
        }
        return;
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
          identifier: values.email.trim(),
          password: values.password,
        }),
      });
      const loginJson = (await loginRes.json().catch(() => ({}))) as {
        success?: boolean;
        redirectAfterLogin?: string;
        user?: unknown;
        message?: string;
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
          localStorage.setItem("mobcash_user", JSON.stringify(loginJson.user));
        } else if (data.user && typeof data.user === "object") {
          localStorage.setItem("mobcash_user", JSON.stringify(data.user));
        }
        router.push(targetDashboard);
        return;
      }

      if (data.user && typeof data.user === "object") {
        localStorage.setItem("mobcash_user", JSON.stringify(data.user));
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

  const onSubmit = form.handleSubmit(async (values) => {
    await registerAfterValidation(values);
  });

  const onStep1Next = form.handleSubmit(() => {
    setStep(2);
  });

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
      ? "أنت تسجّل عبر رابط دعوة وكيل. سيُرسل طلبك للوكيل للموافقة قبل التفعيل الكامل."
      : isAgentPickerFlow
        ? "الخطوة 1: بياناتك الشخصية. ثم اختر وكيلك من القائمة في الخطوة 2."
        : "أنشئ حسابك الآن. إذا كان لديك كود وكيل سيتم ربط حسابك مباشرة، وإلا فستنتقل لاختيار وكيل بعد التسجيل.");

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
        ) : pendingAgentApproval ? (
          <GlassCard className="space-y-4 border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md md:p-8">
            <h2 className="text-xl font-semibold text-white">{REGISTER_AR.pendingTitle}</h2>
            <p className="text-sm leading-7 text-white/80">{REGISTRATION_PENDING_SUCCESS_AR}</p>
            <PrimaryButton type="button" onClick={() => router.push("/login")}>
              {REGISTER_AR.goLogin}
            </PrimaryButton>
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
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{REGISTER_AR.fullName} *</FormLabel>
                        <FormControl>
                          <Input placeholder={REGISTER_AR.fullName} autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{REGISTER_AR.email} *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={REGISTER_AR.email} autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
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
                          <Input type="password" placeholder={REGISTER_AR.password} autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
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
                          <Input type="password" placeholder="أعد إدخال كلمة المرور" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{REGISTER_AR.phone} *</FormLabel>
                        <FormControl>
                          <Input placeholder={REGISTER_AR.phone} autoComplete="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{REGISTER_AR.city} *</FormLabel>
                        <FormControl>
                          <Input placeholder={REGISTER_AR.city} autoComplete="address-level2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البلد *</FormLabel>
                        <FormControl>
                          <SelectField
                            name={field.name}
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v);
                              syncPhoneDialFromCountry(v);
                            }}
                          >
                            {COUNTRY_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label} ({item.dialCode})
                              </option>
                            ))}
                          </SelectField>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{REGISTER_AR.birthDate} *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!inviteTrim && !isAgentPickerFlow ? (
                    <FormField
                      control={form.control}
                      name="agent_code"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>{REGISTER_AR.optionalAgentCode}</FormLabel>
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
                      الخطوة التالية يرسل طلب ربط يحتاج موافقة الوكيل.
                    </>
                  ) : (
                    <>
                      {REGISTER_AR.noteAgentCode} تسجيل اللاعبين دائماً بحساب{" "}
                      <span className="font-semibold text-cyan-200">PLAYER</span> فقط.
                    </>
                  )}
                </div>

                <PrimaryButton type="submit" disabled={loading} className="w-full md:w-auto">
                  {loading
                    ? t("processing")
                    : isAgentPickerFlow && step === 1
                      ? "المتابعة — اختيار الوكيل"
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
