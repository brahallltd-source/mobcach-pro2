"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextField,
} from "@/components/ui";
import { publicAgentProfileFetchInit, publicAgentProfileUrl } from "@/lib/public-agent-client";

type CopyRow = { key: string; label: string; value: string };

type ActivePaymentMethod = {
  id: string;
  methodTitle: string;
  category: string | null;
  minAmount: number;
  maxAmount: number;
  copyable: CopyRow[];
};

type PublicAgent = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  availableBalance: number;
  executionTimeLabel?: string;
  activePaymentMethods: ActivePaymentMethod[];
};

async function copyField(label: string, value: string) {
  const v = String(value ?? "").trim();
  if (!v) {
    toast.error("لا يوجد نص للنسخ");
    return;
  }
  try {
    await navigator.clipboard.writeText(v);
    toast.success(`تم نسخ ${label}`);
  } catch {
    toast.error("تعذّر النسخ من المتصفح");
  }
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  const display = String(value ?? "").trim() || "—";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
        <p className="mt-0.5 break-all font-mono text-sm text-white" dir="auto">
          {display}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copyField(label, value)}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/15 p-2 text-cyan-200 transition hover:bg-cyan-500/25"
        aria-label={`نسخ ${label}`}
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PlayerRechargeWithAgentPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = String(params?.agentId || "").trim();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const u = JSON.parse(saved) as { email?: string; role?: string; assignedAgentId?: string };
    if (u.role !== "player") return void (window.location.href = "/login");
    if (u.assignedAgentId) {
      router.replace("/player/dashboard");
      return;
    }
    setUserEmail(String(u.email || ""));
  }, [router]);

  const loadAgent = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      setError("معرّف الوكيل غير صالح");
      return;
    }
    try {
      const res = await fetch(publicAgentProfileUrl(agentId), publicAgentProfileFetchInit);
      const data = await res.json();
      if (!res.ok || !data.agent) {
        throw new Error(data.message || "الوكيل غير موجود");
      }
      const a = data.agent as PublicAgent & { balance?: unknown };
      const balNum = Number(a.availableBalance ?? a.balance ?? 0);
      setAgent({
        ...a,
        availableBalance: Number.isFinite(balNum) ? balNum : 0,
        activePaymentMethods: Array.isArray(a.activePaymentMethods) ? a.activePaymentMethods : [],
      });
      setSelectedId(null);
      setAmount("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "تعذّر تحميل بيانات الوكيل");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadAgent();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadAgent]);

  const agentName = agent
    ? String(agent.fullName || agent.username || agent.email || "الوكيل")
    : "";
  const selected = agent?.activePaymentMethods?.find((m) => m.id === selectedId) ?? null;

  const amountNum = useMemo(() => {
    const n = parseFloat(String(amount).replace(",", ".").trim());
    return Number.isFinite(n) ? n : NaN;
  }, [amount]);

  const amountInRange = useMemo(() => {
    if (!selected) return true;
    if (!Number.isFinite(amountNum)) return false;
    return amountNum >= selected.minAmount && amountNum <= selected.maxAmount;
  }, [selected, amountNum]);

  const leastMinMethod = useMemo(() => {
    if (!agent?.activePaymentMethods?.length) return null;
    return Math.min(...agent.activePaymentMethods.map((m) => m.minAmount));
  }, [agent]);

  const globalInsufficientBalance = useMemo(() => {
    if (!agent || leastMinMethod == null) return false;
    return agent.availableBalance < leastMinMethod;
  }, [agent, leastMinMethod]);

  const amountExceedsAgentWallet = useMemo(() => {
    if (!agent || !Number.isFinite(amountNum) || amountNum <= 0) return false;
    return amountNum > agent.availableBalance;
  }, [agent, amountNum]);

  const needsPaymentChoice = Boolean(agent && agent.activePaymentMethods.length > 0);
  const confirmDisabled = useMemo(() => {
    if (busy) return true;
    if (needsPaymentChoice && !selected) return true;
    if (needsPaymentChoice && selected) {
      if (!Number.isFinite(amountNum) || amountNum <= 0) return true;
      if (!amountInRange) return true;
    }
    return false;
  }, [busy, needsPaymentChoice, selected, amountNum, amountInRange]);

  const confirmLink = async () => {
    if (!userEmail || !agentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/player/select-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerEmail: userEmail, agentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "فشل ربط الوكيل");
      }
      const raw = localStorage.getItem("mobcash_user");
      if (raw) {
        const u = JSON.parse(raw) as Record<string, unknown>;
        localStorage.setItem(
          "mobcash_user",
          JSON.stringify({
            ...u,
            assigned_agent_id: agentId,
            assignedAgentId: agentId,
            player_status: "active",
          })
        );
      }
      router.replace(`/player/achat/${encodeURIComponent(agentId)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  if (!userEmail && !loading) {
    return null;
  }

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="جاري التحميل..." />
      </SidebarShell>
    );
  }

  if (error && !agent) {
    return (
      <SidebarShell role="player">
        <PageHeader title="خطأ" subtitle={error} />
        <GlassCard className="p-8 text-center">
          <PrimaryButton onClick={() => router.push("/player/select-agent")}>
            العودة لاختيار الوكيل
          </PrimaryButton>
        </GlassCard>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title="تأكيد الوكيل ووسيلة الدفع"
        subtitle="اختر وسيلة الدفع، راجع الحدود، ثم أدخل مبلغ الإيداع ضمن النطاق قبل التأكيد."
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <GlassCard className="p-6 md:p-8">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-xl font-bold text-cyan-200">
              {agentName.slice(0, 1)}
            </div>
            <div>
              <p className="text-xs uppercase text-white/45">الوكيل المختار</p>
              <p className="text-xl font-bold">{agentName}</p>
              {agent?.executionTimeLabel ? (
                <p className="mt-1 text-xs text-white/50">زمن التنفيذ: {agent.executionTimeLabel}</p>
              ) : null}
            </div>
          </div>
        </GlassCard>

        {globalInsufficientBalance && agent && agent.activePaymentMethods.length > 0 ? (
          <GlassCard className="border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm leading-relaxed text-rose-100">
            عذراً، رصيد الوكيل الحالي لا يكفي لهذا المبلغ. رصيد الوكيل المتاح أقل من أدنى مبلغ مسموح لوسائل الدفع
            ({Math.round(leastMinMethod ?? 0)} MAD). جرّب وكيلاً آخر أو تواصل مع الوكيل.
          </GlassCard>
        ) : null}

        {agent && agent.activePaymentMethods.length > 0 && !globalInsufficientBalance ? (
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white">وسيلة الدفع</h2>
            <p className="mt-1 text-sm text-white/50">اختر وسيلة لعرض التفاصيل القابلة للنسخ وحدود المبلغ.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.activePaymentMethods.map((m) => {
                const on = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(m.id);
                      setAmount("");
                    }}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      on
                        ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-50"
                        : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20"
                    }`}
                  >
                    {m.methodTitle}
                  </button>
                );
              })}
            </div>

            {selected ? (
              <div className="mt-6 space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                    <Check className="h-4 w-4 shrink-0" aria-hidden />
                    بيانات {selected.methodTitle}
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">
                    الحد الأدنى: {Math.round(selected.minAmount)} DH | الحد الأقصى:{" "}
                    {Math.round(selected.maxAmount)} DH
                  </span>
                </div>
                {selected.copyable.map((row) => (
                  <CopyableRow key={row.key} label={row.label} value={row.value} />
                ))}

                <div className="border-t border-white/10 pt-4">
                  <label className="mb-1 block text-xs font-medium text-white/55">مبلغ الإيداع (MAD)</label>
                  <TextField
                    type="number"
                    min={selected.minAmount}
                    max={selected.maxAmount}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`بين ${Math.round(selected.minAmount)} و ${Math.round(selected.maxAmount)}`}
                  />
                  {Number.isFinite(amountNum) && !amountInRange ? (
                    <p className="mt-2 text-sm text-rose-300" role="alert">
                      المبلغ يجب أن يكون بين {Math.round(selected.minAmount)} و {Math.round(selected.maxAmount)}{" "}
                      MAD.
                    </p>
                  ) : null}
                  {selected && amountInRange && amountExceedsAgentWallet ? (
                    <p className="mt-2 text-sm text-rose-300" role="alert">
                      عذراً، رصيد الوكيل الحالي لا يكفي لهذا المبلغ.
                    </p>
                  ) : null}
                  {selected &&
                  amountInRange &&
                  Number.isFinite(amountNum) &&
                  amountNum > 0 &&
                  !amountExceedsAgentWallet ? (
                    <div className="mt-4">
                      <Link
                        href={`/player/recharge/${encodeURIComponent(agentId)}/submit-proof?methodId=${encodeURIComponent(selected.id)}&amount=${encodeURIComponent(String(amountNum))}`}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                      >
                        إرسال إثبات الدفع
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-amber-200/90">اختر وسيلة أعلاه لعرض تفاصيل التحويل والحدود.</p>
            )}
          </GlassCard>
        ) : agent ? (
          <GlassCard className="border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100/90">
            لا توجد وسائل دفع مفعّلة من طرف الوكيل. يمكنك المتابعة للربط أو اختيار وكيل آخر يعرض وسائل واضحة.
          </GlassCard>
        ) : null}

        <GlassCard className="p-6 md:p-8">
          <p className="flex items-center gap-2 text-sm text-white/60">
            <Zap className="h-4 w-4 text-amber-300" />
            بعد التأكيد ستُوجَّه لإتمام طلب الشحن مع نفس الوكيل.
          </p>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <PrimaryButton
            className="mt-6 flex w-full items-center justify-center gap-2 py-4"
            disabled={confirmDisabled}
            onClick={() => void confirmLink()}
          >
            {busy ? "جاري الربط..." : "تأكيد والمتابعة"}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          {needsPaymentChoice && selected && confirmDisabled && amountNum > 0 && !amountInRange ? (
            <p className="mt-2 text-center text-xs text-rose-300/90">عدّل المبلغ ليتوافق مع حدود الوكيل لتفعيل التأكيد.</p>
          ) : null}
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
            onClick={() => router.push("/player/select-agent")}
          >
            اختيار وكيل آخر
          </button>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
