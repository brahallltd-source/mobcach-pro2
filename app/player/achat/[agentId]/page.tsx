"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { fetchSessionUser, redirectToLogin } from "@/lib/client-session";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import type { PublicPaymentMethodPayload } from "@/lib/agent-payment-settings";
import {
  fetchPublicAgentProfile,
  publicAgentAvailableBalance,
  publicAgentProfileFetchInit,
  publicAgentProfileUrl,
} from "@/lib/public-agent-client";

type FlowStep = "METHOD" | "AMOUNT" | "CONFIRM";

type AgentData = {
  id: string;
  fullName: string;
  phone: string;
  availableBalance: number;
  balance?: number;
  activePaymentMethods: PublicPaymentMethodPayload[];
};

function waDigits(phone: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) return `212${d.slice(1)}`;
  return d;
}

/** Limits shown and validated = agent-configured catalog only (not wallet balance). */
function limitsForMethod(m: PublicPaymentMethodPayload) {
  const min = Math.max(0, Number(m.minAmount) || 0);
  const max = Math.max(0, Number(m.maxAmount) || 0);
  return { min, max };
}

export default function AchatStepOnePage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currentStep, setCurrentStep] = useState<FlowStep>("METHOD");
  const [selectedMethod, setSelectedMethod] = useState<PublicPaymentMethodPayload | null>(null);
  const [methodLimits, setMethodLimits] = useState<{ min: number; max: number } | null>(null);

  const [amount, setAmount] = useState("");
  const [gosportUsername, setGosportUsername] = useState<string | null>(null);
  const [playerEmail, setPlayerEmail] = useState("");

  const loadAgent = useCallback(async () => {
    if (!params.agentId) return;
    try {
      const res = await fetch(publicAgentProfileUrl(String(params.agentId)), publicAgentProfileFetchInit);
      const data = await res.json();
      if (!res.ok || !data.agent) {
        throw new Error(data.message || "Agent not found");
      }
      const methods = Array.isArray(data.agent.activePaymentMethods)
        ? (data.agent.activePaymentMethods as PublicPaymentMethodPayload[])
        : [];
      setAgent({
        ...data.agent,
        availableBalance: data.agent.availableBalance ?? data.agent.balance ?? 0,
        activePaymentMethods: methods,
      });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في تحميل الوكيل");
    } finally {
      setLoading(false);
    }
  }, [params.agentId]);

  const hydratePlayer = useCallback(async () => {
    const u = (await fetchSessionUser()) as MobcashUser | null;
    if (!u || String(u.role).toLowerCase() !== "player") {
      redirectToLogin();
      return;
    }
    setPlayerEmail(u.email);
    const g = u.player?.gosportUsername;
    setGosportUsername(typeof g === "string" && g.trim() ? g.trim() : null);
  }, []);

  useEffect(() => {
    void hydratePlayer();
  }, [hydratePlayer]);

  useEffect(() => {
    void loadAgent();
    const interval = setInterval(() => void loadAgent(), 10_000);
    return () => clearInterval(interval);
  }, [loadAgent]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadAgent();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadAgent]);

  const numericAmount = Number(String(amount).replace(",", ".")) || 0;

  /** Step 2+: method limits (catalog) + hidden guard vs agent wallet (refreshed in background). */
  const amountValidationError = useMemo(() => {
    if (!selectedMethod || !agent) return null;
    if (currentStep !== "AMOUNT" && currentStep !== "CONFIRM") return null;
    if (!amount.trim()) return null;
    if (!Number.isFinite(numericAmount)) return "أدخل رقماً صالحاً";

    const minA = Math.max(0, Number(selectedMethod.minAmount) || 0);
    const maxA = Math.max(0, Number(selectedMethod.maxAmount) || 0);
    const agentBalance = Math.max(0, Number(agent.availableBalance) || 0);

    if (numericAmount < minA) {
      return `الحد الأدنى هو ${minA} DH`;
    }
    if (numericAmount > maxA) {
      return `الحد الأقصى لهذه الوسيلة هو ${maxA} DH`;
    }
    if (numericAmount > agentBalance) {
      return "عذراً، رصيد الوكيل الحالي لا يغطي هذا المبلغ. يرجى اختيار مبلغ أقل أو التواصل معه.";
    }
    return null;
  }, [amount, numericAmount, selectedMethod, agent, currentStep]);

  const selectMethod = (m: PublicPaymentMethodPayload) => {
    if (!agent) return;
    const lim = limitsForMethod(m);
    if (lim.max < lim.min) {
      toast.error("إعدادات هذه الوسيلة غير صالحة (الحد الأقصى أقل من الحد الأدنى).");
      return;
    }
    setSelectedMethod(m);
    setMethodLimits(lim);
    setAmount("");
    setCurrentStep("AMOUNT");
  };

  const goBackToMethods = () => {
    setCurrentStep("METHOD");
    setSelectedMethod(null);
    setMethodLimits(null);
    setAmount("");
  };

  const goBackToAmount = () => setCurrentStep("AMOUNT");

  const goToConfirm = () => {
    if (amountValidationError || !amount.trim() || !methodLimits) {
      toast.error(amountValidationError || "أدخل مبلغاً ضمن الحدود");
      return;
    }
    setCurrentStep("CONFIRM");
  };

  const handleSubmit = async () => {
    if (!agent || !playerEmail || !selectedMethod || !methodLimits) return;
    if (!gosportUsername) {
      toast.error("لا يوجد حساب GoSport365 مفعّل على ملفك. تواصل مع وكيلك لإكمال التفعيل.");
      return;
    }
    if (amountValidationError) {
      toast.error(amountValidationError);
      return;
    }

    setSubmitting(true);
    try {
      const fresh = await fetchPublicAgentProfile(agent.id);
      if (!fresh.ok || !fresh.data) {
        throw new Error(fresh.message || "تعذّر التحقق من رصيد الوكيل");
      }
      const liveBalance = publicAgentAvailableBalance(fresh.data);
      if (numericAmount > liveBalance) {
        toast.error(
          "عذراً، رصيد الوكيل الحالي لا يغطي هذا المبلغ. عدّل المبلغ أو أعد المحاولة لاحقاً.",
        );
        const methods = Array.isArray(fresh.data.activePaymentMethods)
          ? (fresh.data.activePaymentMethods as PublicPaymentMethodPayload[])
          : [];
        setAgent((prev) =>
          prev
            ? {
                ...prev,
                availableBalance: liveBalance,
                activePaymentMethods: methods.length ? methods : prev.activePaymentMethods,
              }
            : prev,
        );
        return;
      }

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerEmail,
          agentId: agent.id,
          amount: numericAmount,
          paymentMethodName: selectedMethod.methodTitle,
          currentStep: 2,
          status: "pending_payment",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; order?: { id: string } };
      if (!res.ok) throw new Error(data.message || "فشل إنشاء الطلب");
      if (!data.order?.id) throw new Error("لم يُرجع الخادم رقم الطلب");
      router.push(`/player/orders/${data.order.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "فشل في إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="جاري تحميل بيانات الشحن…" />
      </SidebarShell>
    );
  }

  if (error || !agent) {
    return (
      <SidebarShell role="player">
        <GlassCard className="mx-auto flex max-w-lg flex-col items-center gap-4 p-10 text-center">
          <p className="text-lg font-semibold text-white">تعذّر تحميل بيانات الوكيل</p>
          <p className="text-sm text-white/50">{error ?? "تحقق من الرابط."}</p>
          <button
            type="button"
            onClick={() => router.push("/player/dashboard")}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-950"
          >
            العودة للرئيسية
          </button>
        </GlassCard>
      </SidebarShell>
    );
  }

  const wa = waDigits(agent.phone);
  const subtitle =
    currentStep === "METHOD"
      ? "اختر وسيلة الدفع ثم أدخل المبلغ ضمن الحدود المحددة."
      : currentStep === "AMOUNT"
        ? "أدخل المبلغ وفق الحدود — يُستخدم حساب GoSport365 من ملفك."
        : "راجع التفاصيل ثم أرسل الطلب.";

  return (
    <SidebarShell role="player">
      <PageHeader title="طلب شحن" subtitle={subtitle} />

      <div className="mx-auto mt-8 max-w-xl px-1">
        <GlassCard className="overflow-hidden border border-white/10 bg-[#070c14]/90 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl md:p-10">
          {currentStep === "METHOD" && (
            <div className="space-y-6">
              <p className="text-center text-sm font-medium text-white/60">الخطوة ١ — اختيار وسيلة الدفع</p>
              {agent.activePaymentMethods.length === 0 ? (
                <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-6 text-center text-sm text-amber-100">
                  لا توجد وسائل دفع مفعّلة لهذا الوكيل. تواصل معه عبر واتساب أو المحادثة.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {agent.activePaymentMethods.map((m) => {
                    const minV = Math.max(0, Number(m.minAmount) || 0);
                    const maxV = Math.max(0, Number(m.maxAmount) || 0);
                    const misconfigured = maxV < minV;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={misconfigured}
                        onClick={() => selectMethod(m)}
                        className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-start transition hover:border-cyan-400/35 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <div className="flex w-full items-center gap-2">
                          <CreditCard className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
                          <span className="font-semibold text-white">{m.methodTitle}</span>
                          <ChevronRight className="ms-auto h-4 w-4 text-white/30" aria-hidden />
                        </div>
                        <p className="text-sm text-white/50">
                          من {minV} DH إلى {maxV} DH
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentStep === "AMOUNT" && selectedMethod && methodLimits && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goBackToMethods}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  رجوع
                </button>
                <span className="text-xs text-white/40">الخطوة ٢ — المبلغ</span>
              </div>

              <div className="flex flex-col items-center gap-3">
                {gosportUsername ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    <span>حساب موثّق</span>
                    <span className="font-mono text-emerald-100/90">{gosportUsername}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
                    لم يُضبط اسم GoSport365 بعد — راسل وكيلك لإكمال التفعيل.
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-lg font-bold text-white md:text-xl">
                  طريقة الدفع:{" "}
                  <span className="text-cyan-200">{selectedMethod.methodTitle}</span>
                </p>
                <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/75">
                  <span>الحد الأدنى: {methodLimits.min} DH</span>
                  <span className="text-white/25">|</span>
                  <span>الحد الأقصى: {methodLimits.max} DH</span>
                </div>
              </div>

              <div className="relative py-2">
                <div className="flex items-end justify-center gap-2 border-b border-white/10 pb-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.,]/g, "");
                      setAmount(v);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-center text-5xl font-black tracking-tight text-white outline-none ring-0 placeholder:text-white/15 focus:ring-0 md:text-6xl"
                  />
                  <span className="shrink-0 pb-1 text-2xl font-bold text-cyan-300/90 md:text-3xl">DH</span>
                </div>
                {amountValidationError ? (
                  <p className="mt-3 text-center text-sm font-medium text-rose-400">{amountValidationError}</p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={!!amountValidationError || !amount.trim() || !gosportUsername}
                onClick={goToConfirm}
                className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-4 text-base font-bold tracking-wide text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                متابعة للتأكيد
              </button>
            </div>
          )}

          {currentStep === "CONFIRM" && selectedMethod && methodLimits && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goBackToAmount}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  رجوع
                </button>
                <span className="text-xs text-white/40">الخطوة ٣ — التأكيد</span>
              </div>

              {amountValidationError ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm font-medium text-rose-200">
                  {amountValidationError}
                </p>
              ) : null}

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/50">طريقة الدفع</span>
                  <span className="font-semibold text-white">{selectedMethod.methodTitle}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/50">المبلغ</span>
                  <span className="font-mono text-lg font-bold text-cyan-200">{numericAmount} DH</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/50">الحدود</span>
                  <span className="text-white/80">
                    {methodLimits.min} – {methodLimits.max} DH
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-white/50">حساب GoSport</span>
                  <span className="font-mono text-white/90">{gosportUsername ?? "—"}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting || !gosportUsername || !!amountValidationError}
                onClick={() => void handleSubmit()}
                className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-4 text-base font-bold tracking-wide text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "جاري الإرسال…" : "إرسال طلب الشحن 🚀"}
              </button>
            </div>
          )}
        </GlassCard>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 backdrop-blur-sm">
          <p>
            <span className="text-white/45">وكيلك:</span>{" "}
            <span className="font-semibold text-white">{agent.fullName}</span>
          </p>
          <div className="flex items-center gap-2">
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20"
                aria-label="واتساب الوكيل"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => router.push(`/player/chat?agentId=${encodeURIComponent(agent.id)}`)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 transition hover:bg-cyan-500/20"
              aria-label="محادثة مباشرة"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
