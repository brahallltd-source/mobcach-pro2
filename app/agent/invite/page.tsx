"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown, Copy, Gift, Info, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
} from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { MILESTONE_RECHARGE_DH } from "@/lib/agent-milestone-bonus";
import {
  SUB_AGENT_REFERRER_BONUS_DH,
  SUB_AGENT_SALES_MILESTONE_DH,
  SUB_AGENTS_PER_BONUS_BLOCK,
} from "@/lib/agent-subagent-bonus";

type PlayerRow = {
  id: string;
  playerId: string;
  displayName: string;
  username: string;
  totalRecharged: number;
  status: string;
  playerCreatedAt?: string;
};

type SubAgentRow = {
  id: string;
  username: string;
  displayName: string;
  totalSales: number;
};

type InvitePayload = {
  inviteCode: string;
  eligiblePlayersCount: number;
  bonusesClaimed: number;
  totalEarnedBonuses: number;
  progressTowardNextBonus: number;
  playersRemainingForBonus: number;
  milestoneDh: number;
  bonusBlockDh: number;
  playersPerBlock: number;
  players: PlayerRow[];
  qualifiedSubAgentsCount: number;
  agentBonusesPaid: number;
  totalEarnedSubAgentBlocks: number;
  progressTowardNextSubAgentBlock: number;
  subAgentsRemainingForBonus: number;
  subAgentMilestoneDh: number;
  subAgentBonusBlockDh: number;
  subAgentsPerBonusBlock: number;
  subAgents: SubAgentRow[];
};

const BONUS_RULES_HIDE_KEY = "mobcash_agent_bonus_rules_hidden";

function DhHighlight({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-emerald-300">{children}</strong>;
}

function DhGold({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-amber-300">{children}</strong>;
}

function BonusRulesExplainer() {
  const [permaHidden, setPermaHidden] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(BONUS_RULES_HIDE_KEY) === "1") {
        setPermaHidden(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const hideForever = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      window.localStorage.setItem(BONUS_RULES_HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    setPermaHidden(true);
  };

  if (permaHidden) return null;

  return (
    <GlassCard className="overflow-hidden border border-amber-400/30 bg-gradient-to-br from-amber-950/35 via-black/20 to-emerald-950/20 p-0 shadow-lg shadow-amber-900/10">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/15 text-amber-200">
              <Info className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-white sm:text-lg">كيف يعمل نظام المكافآت؟</h2>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-white/50 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-white/10 px-5 pb-5 pt-2 text-sm leading-relaxed text-white/85">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="font-semibold text-amber-100/95">القاعدة 1 (مكافأة الاستحواذ)</p>
            <p className="mt-2">
              اربح <DhHighlight>1000 درهم</DhHighlight> عند دعوتك لـ <DhGold>10</DhGold> لاعبين جدد، بشرط أن يصل إجمالي شحن كل لاعب منهم إلى{" "}
              <DhHighlight>5000 درهم</DhHighlight>.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="font-semibold text-amber-100/95">القاعدة 2 (مكافأة الولاء)</p>
            <p className="mt-2">
              اربح <DhHighlight>500 درهم</DhHighlight> إضافية عن كل <DhGold>10</DhGold> مرات يقوم فيها لاعبوك القدامى بتجديد شحن{" "}
              <DhHighlight>5000 درهم</DhHighlight> (بعد تجاوزهم لهدفهم الأول).
            </p>
          </div>
          <p className="rounded-lg border-r-4 border-emerald-500/60 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-100/90">
            <span className="font-semibold text-emerald-200">ملاحظة هامة: </span>
            النظام يحسب الأهداف لكل لاعب على حدة، ولا يعتمد على المجموع العام العشوائي.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/5 pt-3">
            <button
              type="button"
              className="text-xs text-white/45 underline-offset-2 transition hover:text-white hover:underline"
              onClick={hideForever}
            >
              إخفاء هذا الدليل نهائياً
            </button>
          </div>
        </div>
      </details>
    </GlassCard>
  );
}

function playerInviteUrl(inviteCode: string) {
  if (typeof window === "undefined") {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
    return `${base}/register?ref=${encodeURIComponent(inviteCode)}`;
  }
  return `${window.location.origin}/register?ref=${encodeURIComponent(inviteCode)}`;
}

function agentInviteUrl(inviteCode: string) {
  if (typeof window === "undefined") {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
    return `${base}/agent-register?ref=${encodeURIComponent(inviteCode)}`;
  }
  return `${window.location.origin}/agent-register?ref=${encodeURIComponent(inviteCode)}`;
}

type TabId = "players" | "agents";

export default function AgentInviteRewardsPage() {
  const [data, setData] = useState<InvitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("players");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/agent/invite", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "تعذّر التحميل");
      setData(j as InvitePayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      await load();
    })();
  }, [load]);

  const playerUrl = useMemo(() => (data?.inviteCode ? playerInviteUrl(data.inviteCode) : ""), [data?.inviteCode]);
  const agentUrl = useMemo(() => (data?.inviteCode ? agentInviteUrl(data.inviteCode) : ""), [data?.inviteCode]);

  const playerProgressPct = useMemo(() => {
    if (!data) return 0;
    return Math.round((data.progressTowardNextBonus / data.playersPerBlock) * 100);
  }, [data]);

  const subAgentProgressPct = useMemo(() => {
    if (!data) return 0;
    return Math.round((data.progressTowardNextSubAgentBlock / data.subAgentsPerBonusBlock) * 100);
  }, [data]);

  const copyText = async (text: string, okMsg: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري التحميل..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="نظام الدعوات والمكافآت"
        subtitle="دعوة اللاعبين أو الوكلاء الفرعيين، تتبّع الأهداف، والمكافآت التلقائية."
        action={
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-2 text-amber-100">
            <Gift className="h-6 w-6" aria-hidden />
          </div>
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {error ? (
          <GlassCard className="border border-rose-500/25 p-4 text-sm text-rose-200">{error}</GlassCard>
        ) : null}

        {data ? (
          <>
            <div
              role="tablist"
              aria-label="نوع الدعوة"
              className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "players"}
                className={`min-w-[8rem] flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  tab === "players"
                    ? "bg-cyan-600/90 text-white shadow"
                    : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => setTab("players")}
              >
                دعوة اللاعبين
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "agents"}
                className={`min-w-[8rem] flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  tab === "agents"
                    ? "bg-violet-600/90 text-white shadow"
                    : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => setTab("agents")}
              >
                دعوة الوكلاء
              </button>
            </div>

            {tab === "players" ? (
              <>
                <GlassCard className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-white">رابط دعوة اللاعبين</h2>
                  <p className="mt-1 text-sm text-white/50">
                    يسجّل اللاعب عبر الرابط أدناه (يُوجّه إلى صفحة التسجيل مع الكود).
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div
                      className="min-w-0 flex-1 break-all rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-cyan-100/95"
                      dir="ltr"
                    >
                      {playerUrl}
                    </div>
                    <PrimaryButton
                      type="button"
                      className="shrink-0 gap-2 px-5"
                      onClick={() => void copyText(playerUrl, "تم نسخ رابط اللاعبين")}
                    >
                      <Copy className="h-4 w-4" />
                      نسخ
                    </PrimaryButton>
                  </div>
                  <p className="mt-3 text-xs text-white/40">كود الدعوة: {data.inviteCode}</p>
                  <p className="mt-3 text-xs text-white/35">
                    لإضافة لاعب يدوياً (بدون رابط دعوة)،{" "}
                    <Link
                      href="/agent/add-player"
                      className="text-cyan-300/90 underline-offset-2 hover:text-cyan-200 hover:underline"
                    >
                      صفحة الإضافة اليدوية
                    </Link>
                    .
                  </p>
                </GlassCard>

                <BonusRulesExplainer />

                <GlassCard className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-white">تقدم لاعبيك الحاليين</h2>
                  <p className="mt-1 text-sm text-white/50">
                    تتبّع كل لاعب نحو هدف {MILESTONE_RECHARGE_DH.toLocaleString("fr-FR")} درهم lifetime عبرك.
                  </p>
                  <ul className="mt-5 space-y-4">
                    {data.players.length === 0 ? (
                      <li className="text-center text-sm text-white/45">لا يوجد لاعبون في قائمتك بعد.</li>
                    ) : (
                      data.players.map((p) => {
                        const tr = Number(p.totalRecharged) || 0;
                        const barPct = Math.min(100, (tr / MILESTONE_RECHARGE_DH) * 100);
                        const qualified = tr >= MILESTONE_RECHARGE_DH;
                        return (
                          <li key={p.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-white">{p.displayName}</p>
                              {qualified ? (
                                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-300">
                                  <span aria-hidden>✅</span> مؤهل
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-white/40" dir="ltr">
                              @{p.username}
                            </p>
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-l from-cyan-500 to-emerald-400 transition-all duration-500"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <p className="mt-2 text-sm tabular-nums text-cyan-100/95">
                              {Math.round(tr)} / {MILESTONE_RECHARGE_DH.toLocaleString("fr-FR")} درهم
                            </p>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </GlassCard>

                <GlassCard className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-white">تقدّم مكافأة اللاعبين</h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/75">
                    لقد أوصلت <span className="font-bold text-cyan-200">{data.progressTowardNextBonus}</span> من أصل{" "}
                    <span className="font-bold">{data.playersPerBlock}</span> لاعبين للهدف. تبقّى لك{" "}
                    <span className="font-bold text-amber-200">{data.playersRemainingForBonus}</span> لاعبين للحصول
                    على مكافأة {data.bonusBlockDh} درهم!
                  </p>
                  <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-cyan-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${playerProgressPct}%` }}
                    />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <dt className="text-xs text-white/45">لاعبون ≥ {data.milestoneDh} DH</dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums text-white">{data.eligiblePlayersCount}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <dt className="text-xs text-white/45">كتل مكتسبة (نظرياً)</dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums text-white">{data.totalEarnedBonuses}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <dt className="text-xs text-white/45">كتل تم صرفها</dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums text-emerald-200">{data.bonusesClaimed}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs text-white/45">
                    يُحدَّث رصيدك تلقائياً عند الموافقة على شحن لاعب مرتبط بك، عند استيفاء كل {data.playersPerBlock}{" "}
                    لاعبين تجاوزوا {data.milestoneDh} DH إجمالاً عبرك.
                  </p>
                </GlassCard>
              </>
            ) : (
              <>
                <GlassCard className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-white">رابط دعوة الوكلاء</h2>
                  <p className="mt-1 text-sm text-white/50">
                    يرسل الطلب كوكيل فرعي مرتبط بحسابك عند قبول الإدارة للطلب.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div
                      className="min-w-0 flex-1 break-all rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-violet-100/95"
                      dir="ltr"
                    >
                      {agentUrl}
                    </div>
                    <PrimaryButton
                      type="button"
                      className="shrink-0 gap-2 px-5"
                      onClick={() => void copyText(agentUrl, "تم نسخ رابط الوكلاء")}
                    >
                      <Copy className="h-4 w-4" />
                      نسخ
                    </PrimaryButton>
                  </div>
                  <p className="mt-3 text-xs text-white/40">نفس كود الدعوة: {data.inviteCode}</p>
                </GlassCard>

                <GlassCard className="border border-violet-400/25 bg-gradient-to-br from-violet-950/40 to-black/20 p-6 md:p-8">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                    <div>
                      <h3 className="font-semibold text-white">القاعدة: مكافأة دعوة الوكلاء</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/80">
                        اربح <strong className="text-emerald-300">{SUB_AGENT_REFERRER_BONUS_DH} درهم</strong> عند دعوتك
                        لـ <strong className="text-amber-300">{SUB_AGENTS_PER_BONUS_BLOCK}</strong> وكلاء فرعيين، بشرط
                        أن يحقق كل وكيل مبيعات بقيمة{" "}
                        <strong className="text-emerald-300">{SUB_AGENT_SALES_MILESTONE_DH.toLocaleString("fr-FR")} درهم</strong>{" "}
                        (يُحدَّث المبلغ عند موافقتك على شحنات لاعبيك).
                      </p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-white">تقدّم مكافأة الوكلاء الفرعيين</h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/75">
                    وكلاء حققوا الهدف:{" "}
                    <span className="font-bold text-violet-200">{data.progressTowardNextSubAgentBlock}</span> /{" "}
                    {data.subAgentsPerBonusBlock} — تبقّى{" "}
                    <span className="font-bold text-amber-200">{data.subAgentsRemainingForBonus}</span> وكيلاً للمكافأة
                    التالية ({data.subAgentBonusBlockDh} درهم).
                  </p>
                  <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-violet-500 to-fuchsia-500 transition-all duration-500"
                      style={{ width: `${subAgentProgressPct}%` }}
                    />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <dt className="text-xs text-white/45">وكلاء ≥ {data.subAgentMilestoneDh} DH مبيعات</dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums text-white">{data.qualifiedSubAgentsCount}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <dt className="text-xs text-white/45">كتل مكتسبة</dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums text-white">{data.totalEarnedSubAgentBlocks}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <dt className="text-xs text-white/45">كتل تم صرفها</dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums text-emerald-200">{data.agentBonusesPaid}</dd>
                    </div>
                  </dl>
                </GlassCard>

                <GlassCard className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-white">الوكلاء الفرعيون</h2>
                  <p className="mt-1 text-sm text-white/50">
                    تقدّم كل وكيل فرعي نحو {SUB_AGENT_SALES_MILESTONE_DH.toLocaleString("fr-FR")} DH مبيعات معتمدة.
                  </p>
                  <ul className="mt-5 space-y-4">
                    {data.subAgents.length === 0 ? (
                      <li className="text-center text-sm text-white/45">لا يوجد وكلاء فرعيون بعد.</li>
                    ) : (
                      data.subAgents.map((s) => {
                        const pct = Math.min(
                          100,
                          Math.round((s.totalSales / SUB_AGENT_SALES_MILESTONE_DH) * 100)
                        );
                        return (
                          <li key={s.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-white">الوكيل {s.displayName}</p>
                              <p className="text-xs text-white/45" dir="ltr">
                                @{s.username}
                              </p>
                            </div>
                            <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                              <span className="tabular-nums text-violet-200">
                                {Math.round(s.totalSales)} / {SUB_AGENT_SALES_MILESTONE_DH} DH
                              </span>
                              <span className="text-white/40">{pct}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </GlassCard>
              </>
            )}
          </>
        ) : null}
      </div>
    </SidebarShell>
  );
}
