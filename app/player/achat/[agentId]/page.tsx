"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, MessageCircle } from "lucide-react";
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

type FlowStep = "AMOUNT" | "IDENTITY" | "PAYMENT" | "PROOF";
type AgentData = {
  id: string;
  fullName: string;
  phone: string;
  availableBalance: number;
  balance?: number;
  activePaymentMethods: PublicPaymentMethodPayload[];
};

function normalizePlayerStatus(status: string | null | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}

function waDigits(phone: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) return `212${d.slice(1)}`;
  return d;
}

export default function PlayerAchatLifecyclePage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentData | null>(null);

  const [playerEmail, setPlayerEmail] = useState("");
  const [playerAccountActive, setPlayerAccountActive] = useState<string | null>(null);
  const [step, setStep] = useState<FlowStep>("AMOUNT");

  const [amountInput, setAmountInput] = useState("");
  const [gosportUsername, setGosportUsername] = useState("");
  const [confirmGosportUsername, setConfirmGosportUsername] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PublicPaymentMethodPayload | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const loadAgent = useCallback(async () => {
    if (!params.agentId) return;
    const res = await fetch(publicAgentProfileUrl(String(params.agentId)), publicAgentProfileFetchInit);
    const data = await res.json();
    if (!res.ok || !data.agent) throw new Error(data.message || "Agent not found");
    const methods = Array.isArray(data.agent.activePaymentMethods)
      ? (data.agent.activePaymentMethods as PublicPaymentMethodPayload[])
      : [];
    const raw = data.agent as { availableBalance?: unknown; balance?: unknown };
    const balNum = Number(raw.availableBalance ?? raw.balance ?? 0);
    setAgent({
      ...data.agent,
      availableBalance: Number.isFinite(balNum) ? balNum : 0,
      activePaymentMethods: methods,
    });
  }, [params.agentId]);

  const hydratePlayer = useCallback(async () => {
    const user = (await fetchSessionUser()) as MobcashUser | null;
    if (!user || String(user.role).toLowerCase() !== "player") {
      redirectToLogin();
      return;
    }
    setPlayerEmail(user.email);
    setPlayerAccountActive(normalizePlayerStatus(user.player?.status));
    const existing = String(user.player?.gosportUsername ?? "").trim();
    if (existing) {
      setGosportUsername(existing);
      setConfirmGosportUsername(existing);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([hydratePlayer(), loadAgent()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر تحميل البيانات");
      } finally {
        setLoading(false);
      }
    })();
  }, [hydratePlayer, loadAgent]);

  const numericAmount = useMemo(() => {
    const value = String(amountInput).trim().replace(",", ".");
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }, [amountInput]);

  const amountError = useMemo(() => {
    if (!amountInput.trim()) return "أدخل مبلغ الشحن";
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return "المبلغ غير صالح";
    const available = Number(agent?.availableBalance ?? 0);
    if (numericAmount > available) {
      return "عذراً، رصيد الوكيل الحالي لا يغطي هذا المبلغ. اختر مبلغاً أقل.";
    }
    return null;
  }, [amountInput, numericAmount, agent?.availableBalance]);

  const identityError = useMemo(() => {
    const a = gosportUsername.trim();
    const b = confirmGosportUsername.trim();
    if (!a || !b) return "املأ اسم المستخدم وتأكيده";
    if (a !== b) return "تأكيد اسم مستخدم GoSport365 غير مطابق";
    return null;
  }, [gosportUsername, confirmGosportUsername]);

  const paymentError = useMemo(() => {
    if (!selectedMethod) return "اختر وسيلة دفع";
    const minA = Number(selectedMethod.minAmount ?? 0);
    const maxA = Number(selectedMethod.maxAmount ?? 0);
    if (numericAmount < minA) return `الحد الأدنى لهذه الوسيلة هو ${minA} DH`;
    if (numericAmount > maxA) return `الحد الأقصى لهذه الوسيلة هو ${maxA} DH`;
    return null;
  }, [selectedMethod, numericAmount]);

  const proofError = useMemo(() => {
    if (!proofFile) return "ارفع صورة الوصل (JPG أو PNG)";
    const type = String(proofFile.type || "").toLowerCase();
    if (!(type === "image/jpeg" || type === "image/jpg" || type === "image/png")) {
      return "الملف يجب أن يكون JPG أو PNG فقط";
    }
    return null;
  }, [proofFile]);

  const goToIdentity = () => {
    if (playerAccountActive !== "active") {
      toast.error("الحساب غير مفعّل بعد. راسل وكيلك لإكمال التفعيل قبل الشحن.");
      return;
    }
    if (amountError) {
      toast.error(amountError);
      return;
    }
    setStep("IDENTITY");
  };

  const goToPayment = () => {
    if (identityError) {
      toast.error(identityError);
      return;
    }
    setStep("PAYMENT");
  };

  const goToProof = () => {
    if (paymentError) {
      toast.error(paymentError);
      return;
    }
    setStep("PROOF");
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("تم النسخ");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const submitWithProof = async () => {
    if (!agent || !selectedMethod) return;
    if (amountError || identityError || paymentError || proofError) {
      toast.error(amountError || identityError || paymentError || proofError || "تحقق من البيانات");
      return;
    }

    setSubmitting(true);
    try {
      const fresh = await fetchPublicAgentProfile(agent.id);
      if (!fresh.ok || !fresh.data) throw new Error(fresh.message || "تعذّر التحقق من رصيد الوكيل");
      const liveBalance = publicAgentAvailableBalance(fresh.data);
      console.log("Validating Deposit -> Requested:", numericAmount, "Agent Balance:", liveBalance);
      if (numericAmount > liveBalance) {
        toast.error("رصيد الوكيل تغيّر الآن ولا يغطي هذا المبلغ.");
        return;
      }

      const formData = new FormData();
      formData.append("playerEmail", playerEmail);
      formData.append("agentId", agent.id);
      formData.append("amount", String(numericAmount));
      formData.append("paymentMethodName", selectedMethod.methodTitle);
      formData.append("gosportUsername", gosportUsername.trim());
      formData.append("status", "pending_payment");
      formData.append("file", proofFile as File);

      const res = await fetch("/api/create-order", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { message?: string; order?: { id: string } };
      if (!res.ok) throw new Error(data.message || "فشل إنشاء الطلب");
      if (!data.order?.id) throw new Error("لم يُرجع الخادم رقم الطلب");
      toast.success("تم إرسال الإثبات بنجاح");
      router.push(`/player/orders/${data.order.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل في إرسال الإثبات");
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
        <GlassCard className="mx-auto max-w-lg p-8 text-center text-white/70">{error || "تعذّر تحميل الوكيل"}</GlassCard>
      </SidebarShell>
    );
  }

  const wa = waDigits(agent.phone);

  return (
    <SidebarShell role="player">
      <PageHeader title="طلب شحن" subtitle="4 خطوات: المبلغ، التحقق، بيانات الدفع، رفع الوصل." />
      <div className="mx-auto mt-8 max-w-2xl space-y-5">
        <GlassCard className="space-y-6 p-6 md:p-8">
          {step === "AMOUNT" && (
            <section className="space-y-4">
              <p className="text-sm font-semibold text-white/60">الخطوة 1 — أدخل مبلغ الشحن</p>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-center text-4xl font-black text-white outline-none"
              />
              {amountError ? <p className="text-sm text-rose-300">{amountError}</p> : null}
              <button
                type="button"
                onClick={goToIdentity}
                className="w-full rounded-full bg-cyan-500 px-5 py-3 font-bold text-slate-950"
              >
                متابعة
              </button>
            </section>
          )}

          {step === "IDENTITY" && (
            <section className="space-y-4">
              <button type="button" onClick={() => setStep("AMOUNT")} className="inline-flex items-center gap-2 text-sm text-white/70">
                <ArrowLeft size={16} /> رجوع
              </button>
              <p className="text-sm font-semibold text-white/60">الخطوة 2 — تحقق الهوية</p>
              <input
                value={gosportUsername}
                onChange={(e) => setGosportUsername(e.target.value)}
                placeholder="player user name gosport365"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none"
              />
              <input
                value={confirmGosportUsername}
                onChange={(e) => setConfirmGosportUsername(e.target.value)}
                placeholder="confirm player user name gosport365"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none"
              />
              {identityError ? <p className="text-sm text-rose-300">{identityError}</p> : null}
              <button type="button" onClick={goToPayment} className="w-full rounded-full bg-cyan-500 px-5 py-3 font-bold text-slate-950">
                متابعة لبيانات الدفع
              </button>
            </section>
          )}

          {step === "PAYMENT" && (
            <section className="space-y-4">
              <button type="button" onClick={() => setStep("IDENTITY")} className="inline-flex items-center gap-2 text-sm text-white/70">
                <ArrowLeft size={16} /> رجوع
              </button>
              <p className="text-sm font-semibold text-white/60">الخطوة 3 — اختر وسيلة الدفع وبيانات الحساب</p>
              {agent.activePaymentMethods.length === 0 ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  لا توجد وسائل دفع مفعّلة لهذا الوكيل.
                </p>
              ) : (
                <div className="grid gap-3">
                  {agent.activePaymentMethods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethod(method)}
                      className={`rounded-2xl border px-4 py-3 text-start ${
                        selectedMethod?.id === method.id ? "border-cyan-400 bg-cyan-500/15" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <p className="font-semibold text-white">{method.methodTitle}</p>
                      <p className="text-xs text-white/50">
                        {method.minAmount} - {method.maxAmount} DH
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {selectedMethod?.copyable && selectedMethod.copyable.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <p className="mb-4 text-xs font-bold tracking-wider text-cyan-400">
                    بيانات الدفع (يرجى التحويل إلى هذا الحساب):
                  </p>
                  <div className="space-y-3">
                    {selectedMethod.copyable.map((field: { key: string; label: string; value: string }) => (
                      <div key={field.key} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                        <span className="text-xs text-white/50">{field.label}:</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-cyan-300">{field.value}</span>
                          <button
                            type="button"
                            onClick={() => void copyValue(field.value)}
                            className="rounded-lg bg-white/5 p-2 text-white/40 transition-colors hover:bg-cyan-500/20 hover:text-cyan-400"
                            title={`نسخ ${field.label}`}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedMethod ? (
                <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  لا توجد بيانات قابلة للنسخ لهذه الوسيلة.
                </div>
              ) : null}
              {paymentError ? <p className="text-sm text-rose-300">{paymentError}</p> : null}
              <button type="button" onClick={goToProof} className="w-full rounded-full bg-cyan-500 px-5 py-3 font-bold text-slate-950">
                متابعة لرفع الوصل
              </button>
            </section>
          )}

          {step === "PROOF" && (
            <section className="space-y-4">
              <button type="button" onClick={() => setStep("PAYMENT")} className="inline-flex items-center gap-2 text-sm text-white/70">
                <ArrowLeft size={16} /> رجوع
              </button>
              <p className="text-sm font-semibold text-white/60">الخطوة 4 — ارفع الوصل ثم أرسل</p>
              <label className="block rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
                {proofFile ? `تم اختيار: ${proofFile.name}` : "اضغط لاختيار صورة الوصل (JPG/PNG)"}
              </label>
              {proofError ? <p className="text-sm text-rose-300">{proofError}</p> : null}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitWithProof()}
                className="w-full rounded-full bg-emerald-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
              >
                {submitting ? "جاري الإرسال..." : "Send Proof"}
              </button>
            </section>
          )}
        </GlassCard>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
          <span>
            الوكيل: <span className="font-semibold text-white">{agent.fullName}</span>
          </span>
          <div className="flex items-center gap-2">
            {wa ? (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-emerald-500/35 p-2 text-emerald-300">
                WhatsApp
              </a>
            ) : null}
            <button type="button" onClick={() => router.push(`/player/chat?agentId=${encodeURIComponent(agent.id)}`)} className="rounded-full border border-cyan-500/35 p-2 text-cyan-300">
              <MessageCircle size={16} />
            </button>
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
