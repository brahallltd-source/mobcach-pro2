"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { CreditCard, MessageCircle } from "lucide-react";
import { GlassCard, PrimaryButton } from "@/components/ui";

type AgentPayload = {
  id: string;
  userId: string;
  name: string;
  username: string;
  email: string;
  isOnline: boolean;
  lastSeen: string;
};

type PaymentMethodRow = {
  id: string;
  methodName: string;
  type: string;
  currency: string;
  feePercent: number;
  instructions: string | null;
};

type MyAgentResponse = {
  agent: AgentPayload | null;
  paymentMethods?: PaymentMethodRow[] | null;
  chatHref?: string | null;
};

export function AgentStatusCard() {
  const router = useRouter();
  const [data, setData] = useState<MyAgentResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/player/my-agent", { credentials: "include", cache: "no-store" });
      const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const agent = (raw.agent as AgentPayload | null | undefined) ?? null;
      const paymentMethods = Array.isArray(raw.paymentMethods)
        ? (raw.paymentMethods as PaymentMethodRow[])
        : [];
      const normalized: MyAgentResponse = {
        agent,
        paymentMethods,
        chatHref: typeof raw.chatHref === "string" && raw.chatHref ? raw.chatHref : "/player/chat",
      };
      if (res.ok) setData(normalized);
      else setData({ agent: null, paymentMethods: [], chatHref: "/player/chat" });
    } catch {
      setData({ agent: null, paymentMethods: [], chatHref: "/player/chat" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-white/50">جاري تحميل بيانات الوكيل…</p>
      </GlassCard>
    );
  }

  if (!data?.agent) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-white/60">لا يوجد وكيل مرتبط بعد. اختر وكيلاً من لوحة اللاعب أو أكمل الربط.</p>
        <Link href="/player/select-agent" className="mt-3 inline-block text-sm text-cyan-300 underline-offset-2 hover:underline">
          اختيار وكيل
        </Link>
      </GlassCard>
    );
  }

  const a = data.agent;
  const methods = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
  const lastSeenLabel =
    a.isOnline || !a.lastSeen
      ? null
      : (() => {
          try {
            return formatDistanceToNow(new Date(a.lastSeen), { addSuffix: true, locale: ar });
          } catch {
            return null;
          }
        })();

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-white/10 bg-black/30 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">وكيلك</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{a.name}</h3>
            <p className="text-sm text-white/55">@{a.username}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5">
              <span
                className={`relative flex h-2.5 w-2.5 shrink-0 rounded-full ${a.isOnline ? "bg-emerald-400" : "bg-white/35"}`}
                aria-hidden
              >
                {a.isOnline ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                ) : null}
              </span>
              <span className="text-xs font-medium text-white/85">{a.isOnline ? "متصل الآن" : "غير متصل"}</span>
            </div>
            {!a.isOnline && lastSeenLabel ? (
              <p className="max-w-[14rem] text-end text-[11px] text-white/45">آخر ظهور: {lastSeenLabel}</p>
            ) : null}
          </div>
        </div>
      </div>

      {methods.length > 0 ? (
        <div className="space-y-2 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">وسائل الدفع النشطة</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {methods.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm"
              >
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/90" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold text-white">{m.methodName}</p>
                  <p className="text-[11px] text-white/45">
                    {m.type} · {m.currency}
                    {m.feePercent > 0 ? ` · عمولة ${m.feePercent}%` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-3 text-xs text-white/45">لا توجد وسائل دفع مفعّلة لدى الوكيل حالياً.</div>
      )}

      <div className="border-t border-white/10 px-5 py-4">
        <PrimaryButton
          type="button"
          className="inline-flex w-full items-center justify-center gap-2"
          onClick={() => router.push(data.chatHref || `/player/chat?agentId=${encodeURIComponent(a.id)}`)}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          تواصل الآن
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}
