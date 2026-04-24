"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Banknote, Gift, RefreshCw, Wallet } from "lucide-react";
import { RevenueAreaChart } from "@/components/charts";
import { AnimatedStatCard } from "@/components/admin/AnimatedStatCard";
import { LedgerActivityFeed, type LedgerFeedEntry } from "@/components/admin/LedgerActivityFeed";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";
import { isSuperAdminRole } from "@/lib/admin-permissions";
import { useTranslation } from "@/lib/i18n";
import { formatCurrencyDhEn } from "@/lib/format-dh";

async function safeFetchJson<T>(url: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
      console.error(`Error fetching ${url}:`, res.status, res.statusText);
      return fallback;
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      console.error(`Non-JSON response ${url}:`, ct);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return fallback;
  }
}

const ADMIN_FETCH: RequestInit = { credentials: "include" };

type BonusTracking = {
  approvedRechargeRequests: number;
  totalRealDepositsDh: number;
  totalBonusGiftedDh: number;
  activeAgents: number;
  totalAgentWalletBalancesDh: number;
};

type DashboardStats = {
  realSalesTodayDh: number;
  totalBonusTodayDh: number;
  agentLiquidityDh: number;
  pendingRechargeCount: number;
  ledgerFeed: LedgerFeedEntry[];
  metricsDayUtc?: { start: string; end: string };
};

function getDefaultExportRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: ymd(start), endDate: ymd(today) };
}

function parseDashboardStats(raw: unknown): DashboardStats | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.message === "string" && o.message) return null;

  const ledgerRaw = o.ledgerFeed;
  const ledgerFeed: LedgerFeedEntry[] = Array.isArray(ledgerRaw)
    ? ledgerRaw
        .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
        .map((row) => ({
          id: String(row.id ?? ""),
          type: String(row.type ?? ""),
          amount: Number(row.amount) || 0,
          reason: String(row.reason ?? ""),
          createdAt: String(row.createdAt ?? ""),
          agentId: String(row.agentId ?? ""),
          agentLabel: String(row.agentLabel ?? ""),
        }))
        .filter((e) => e.id)
    : [];

  const md = o.metricsDayUtc;
  let metricsDayUtc: DashboardStats["metricsDayUtc"];
  if (md && typeof md === "object") {
    const m = md as Record<string, unknown>;
    if (typeof m.start === "string" && typeof m.end === "string") {
      metricsDayUtc = { start: m.start, end: m.end };
    }
  }

  return {
    realSalesTodayDh: Number(o.realSalesTodayDh) || 0,
    totalBonusTodayDh: Number(o.totalBonusTodayDh) || 0,
    agentLiquidityDh: Number(o.agentLiquidityDh) || 0,
    pendingRechargeCount: Number(o.pendingRechargeCount) || 0,
    ledgerFeed,
    metricsDayUtc,
  };
}

export default function AdminDashboardPage() {
  const { tx } = useTranslation();
  const [counts, setCounts] = useState({
    orders: 0,
    complaints: 0,
    pendingAgents: 0,
    disputes: 0,
    withdrawals: 0,
    notifications: 0,
  });
  const [bonusTracking, setBonusTracking] = useState<BonusTracking | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Date | null>(null);

  const [exportStart, setExportStart] = useState(() => getDefaultExportRange().startDate);
  const [exportEnd, setExportEnd] = useState(() => getDefaultExportRange().endDate);
  const [exportingLedger, setExportingLedger] = useState(false);
  const [permsReady, setPermsReady] = useState(false);
  const [canViewFinancials, setCanViewFinancials] = useState(false);

  const exportRangeInvalid = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exportStart) || !/^\d{4}-\d{2}-\d{2}$/.test(exportEnd)) return true;
    return exportStart > exportEnd;
  }, [exportStart, exportEnd]);

  const resetExportDates = useCallback(() => {
    const d = getDefaultExportRange();
    setExportStart(d.startDate);
    setExportEnd(d.endDate);
  }, []);

  const downloadLedgerExport = useCallback(async () => {
    if (exportRangeInvalid) return;
    setExportingLedger(true);
    try {
      const url = `/api/admin/export/ledger?startDate=${encodeURIComponent(exportStart)}&endDate=${encodeURIComponent(exportEnd)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let msg = res.statusText;
        if (ct.includes("application/json")) {
          try {
            const j = (await res.json()) as { message?: string };
            if (j.message) msg = j.message;
          } catch {
            /* ignore */
          }
        }
        console.error("Ledger export failed:", msg);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ledger-${exportStart}_${exportEnd}.csv`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("Ledger export:", e);
    } finally {
      setExportingLedger(false);
    }
  }, [exportStart, exportEnd, exportRangeInvalid]);

  const fetchDashboardStats = useCallback(async () => {
    setStatsRefreshing(true);
    try {
      const j = await safeFetchJson<unknown>(
        "/api/admin/dashboard-stats",
        null,
        ADMIN_FETCH
      );
      const parsed = parseDashboardStats(j);
      if (parsed) {
        setDashStats(parsed);
        setStatsUpdatedAt(new Date());
      }
    } catch {
      // keep previous stats on transient errors
    } finally {
      setStatsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
        const j = (await res.json()) as {
          success?: boolean;
          user?: { role?: string; adminPermissions?: string[] };
        };
        if (cancelled) return;
        if (!j.success || !j.user) {
          setCanViewFinancials(false);
        } else if (isSuperAdminRole(j.user.role)) {
          setCanViewFinancials(true);
        } else {
          setCanViewFinancials(
            Array.isArray(j.user.adminPermissions) && j.user.adminPermissions.includes("VIEW_FINANCIALS")
          );
        }
      } catch {
        if (!cancelled) setCanViewFinancials(false);
      } finally {
        if (!cancelled) setPermsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [
          orders,
          complaints,
          apps,
          disputes,
          fraud,
          withdrawals,
          notifications,
          analytics,
        ] = await Promise.all([
          safeFetchJson<{ orders?: unknown[] }>("/api/admin/orders", { orders: [] }, ADMIN_FETCH),
          safeFetchJson<{ complaints?: unknown[] }>(
            "/api/admin/complaints",
            { complaints: [] },
            ADMIN_FETCH
          ),
          safeFetchJson<{ data?: unknown[]; applications?: unknown[] }>(
            "/api/admin/agent-applications",
            { data: [], applications: [] },
            ADMIN_FETCH
          ),
          safeFetchJson<{ disputes?: unknown[] }>("/api/admin/disputes", { disputes: [] }, ADMIN_FETCH),
          safeFetchJson<{
            items?: unknown[];
            summary?: {
              pendingFlags?: number;
              suspiciousOrders?: number;
              highRisk?: number;
            } | null;
          }>(
            "/api/admin/fraud",
            { items: [], summary: { pendingFlags: 0, suspiciousOrders: 0, highRisk: 0 } },
            ADMIN_FETCH
          ),
          safeFetchJson<{ withdrawals?: unknown[] }>(
            "/api/admin/withdrawals",
            { withdrawals: [] },
            ADMIN_FETCH
          ),
          safeFetchJson<{ notifications?: { read?: boolean }[] }>(
            "/api/notifications?targetRole=admin&targetId=admin-1",
            { notifications: [] },
            ADMIN_FETCH
          ),
          safeFetchJson<{ bonusTracking?: unknown }>("/api/admin/analytics", {}, ADMIN_FETCH),
        ]);
        if (cancelled) return;

        const appRows = apps.data || apps.applications || [];
        setCounts({
          orders: (orders.orders || []).length,
          complaints: (complaints.complaints || []).length,
          pendingAgents: appRows.filter((item: { status?: string }) => item.status === "pending_agent_review")
            .length,
          disputes: (disputes.disputes || []).length + (fraud.summary?.pendingFlags || 0),
          withdrawals: (withdrawals.withdrawals || []).filter(
            (item: { status?: string }) => item.status === "agent_approved"
          ).length,
          notifications: (notifications.notifications || []).filter((item: { read?: boolean }) => !item.read)
            .length,
        });

        const bt = analytics?.bonusTracking;
        if (bt && typeof bt === "object") {
          const b = bt as Record<string, unknown>;
          setBonusTracking({
            approvedRechargeRequests: Number(b.approvedRechargeRequests) || 0,
            totalRealDepositsDh: Number(b.totalRealDepositsDh) || 0,
            totalBonusGiftedDh: Number(b.totalBonusGiftedDh) || 0,
            activeAgents: Number(b.activeAgents) || 0,
            totalAgentWalletBalancesDh: Number(b.totalAgentWalletBalancesDh) || 0,
          });
        } else {
          setBonusTracking({
            approvedRechargeRequests: 0,
            totalRealDepositsDh: 0,
            totalBonusGiftedDh: 0,
            activeAgents: 0,
            totalAgentWalletBalancesDh: 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchDashboardStats();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [fetchDashboardStats]);

  const chartData = useMemo(
    () => [
      { name: "Orders", value: counts.orders },
      { name: "Complaints", value: counts.complaints },
      { name: "Agents", value: counts.pendingAgents },
      { name: "Disputes", value: counts.disputes },
      { name: "Payouts", value: counts.withdrawals },
    ],
    [counts]
  );

  const metricsDayHint = useMemo(() => {
    if (dashStats?.metricsDayUtc != null) {
      return tx("dashboard.metricsUtcHint", {
        date: dashStats.metricsDayUtc.start.slice(0, 10),
      });
    }
    return tx("dashboard.metricsUtcHintFallback");
  }, [dashStats?.metricsDayUtc, tx]);

  return (
    <SidebarShell role="admin">
      {loading || !permsReady ? (
        <LoadingCard text={tx("dashboard.loadingAdminDashboard")} />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PageHeader
              title={tx("dashboard.monitoringTitle")}
              subtitle={tx("dashboard.monitoringSubtitle")}
            />
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => void fetchDashboardStats()}
                disabled={statsRefreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${statsRefreshing ? "animate-spin" : ""}`} aria-hidden />
                {tx("dashboard.refreshMetrics")}
              </button>
              {statsUpdatedAt ? (
                <p className="text-center text-[11px] text-white/40 sm:text-end" dir="ltr">
                  Last metrics fetch: {statsUpdatedAt.toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>

          {canViewFinancials ? (
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AnimatedStatCard
                label={tx("dashboard.totalSalesToday")}
                value={formatCurrencyDhEn(dashStats?.realSalesTodayDh ?? 0)}
                hint={metricsDayHint}
                variant="cyan"
                delayMs={0}
                icon={Banknote}
              />
              <AnimatedStatCard
                label={tx("dashboard.bonusDistributed")}
                value={formatCurrencyDhEn(dashStats?.totalBonusTodayDh ?? 0)}
                hint={tx("dashboard.bonusDistributedHint")}
                variant="violet"
                delayMs={80}
                icon={Gift}
              />
              <AnimatedStatCard
                label={tx("dashboard.agentLiquidity")}
                value={formatCurrencyDhEn(dashStats?.agentLiquidityDh ?? bonusTracking?.totalAgentWalletBalancesDh ?? 0)}
                hint={tx("dashboard.agentLiquidityHint")}
                variant="emerald"
                delayMs={160}
                icon={Wallet}
              />
              <AnimatedStatCard
                label={tx("dashboard.pendingRechargeReviews")}
                value={String(dashStats?.pendingRechargeCount ?? 0)}
                hint={tx("dashboard.pendingRechargeHint")}
                variant="rose"
                delayMs={240}
                icon={AlertCircle}
              />
            </div>
          ) : (
            <GlassCard className="mb-8 p-5 text-sm text-white/70">{tx("dashboard.noFinancialPermission")}</GlassCard>
          )}

          {canViewFinancials ? (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-black/40 p-6 shadow-lg ring-1 ring-white/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                {tx("dashboard.approvedDepositsLifetime")}
              </p>
              <h3 className="mt-2 text-3xl font-bold tabular-nums text-white" dir="ltr">
                {formatCurrencyDhEn(bonusTracking?.totalRealDepositsDh ?? 0)}
              </h3>
              <p className="mt-2 text-xs text-white/50">
                {tx("dashboard.approvedRechargeCountLabel")}{" "}
                <span className="font-semibold text-white/70 tabular-nums" dir="ltr">
                  {bonusTracking?.approvedRechargeRequests ?? 0}
                </span>
              </p>
            </div>

            <div className="rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-950/50 via-slate-950/80 to-amber-950/30 p-6 shadow-lg ring-1 ring-violet-400/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/80">
                {tx("dashboard.bonusGiftedLifetime")}
              </p>
              <h3
                className="mt-2 bg-gradient-to-r from-violet-300 via-fuchsia-200 to-amber-200 bg-clip-text text-3xl font-bold tabular-nums text-transparent"
                dir="ltr"
              >
                {formatCurrencyDhEn(bonusTracking?.totalBonusGiftedDh ?? 0)}
              </h3>
              <p className="mt-2 text-xs text-violet-200/55">{tx("dashboard.bonusGiftedLifetimeSub")}</p>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/35 to-black/40 p-6 shadow-lg ring-1 ring-white/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{tx("dashboard.activeAgents")}</p>
              <h3 className="mt-2 text-3xl font-bold tabular-nums text-emerald-200" dir="ltr">
                {bonusTracking?.activeAgents ?? 0}
              </h3>
              <p className="mt-2 text-xs text-white/50">{tx("dashboard.activeAgentsSub")}</p>
            </div>
          </div>
          ) : null}

          {canViewFinancials ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Orders today" value={String(counts.orders)} hint="Across all statuses" />
            <StatCard label="Complaints" value={String(counts.complaints)} hint="Player support queue" />
            <StatCard label="Pending agents" value={String(counts.pendingAgents)} hint="Applications awaiting decision" />
            <StatCard label="Fraud alerts" value={String(counts.disputes)} hint="Review queue requiring resolution" />
            <StatCard label="Payouts pending" value={String(counts.withdrawals)} hint="Waiting for admin transfer" />
            <StatCard label="Unread notifications" value={String(counts.notifications)} hint="Latest admin alerts" />
          </div>
          ) : null}

          {canViewFinancials ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <GlassCard className="p-6 md:p-8">
              <RevenueAreaChart title="Operational overview" data={chartData} />
            </GlassCard>

            <div className="space-y-6">
              <GlassCard className="p-6 md:p-8">
                <h2 className="text-xl font-semibold text-white">{tx("dashboard.liveLedgerTitle")}</h2>
                <p className="mt-1 text-xs text-white/45">{tx("dashboard.liveLedgerSub")}</p>
                <div className="mt-4">
                  <LedgerActivityFeed entries={dashStats?.ledgerFeed ?? []} />
                </div>
              </GlassCard>

              <GlassCard className="p-6 md:p-8">
                <h2 className="text-xl font-semibold text-white">{tx("dashboard.exportLedgerTitle")}</h2>
                <p className="mt-1 text-xs text-white/45">{tx("dashboard.exportLedgerSub")}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55" htmlFor="ledger-export-start">
                      Start Date
                    </label>
                    <input
                      id="ledger-export-start"
                      type="date"
                      value={exportStart}
                      onChange={(e) => setExportStart(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/30 focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55" htmlFor="ledger-export-end">
                      End Date
                    </label>
                    <input
                      id="ledger-export-end"
                      type="date"
                      value={exportEnd}
                      onChange={(e) => setExportEnd(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/30 focus:ring-2"
                    />
                  </div>
                </div>
                {exportRangeInvalid ? (
                  <p className="mt-2 text-xs text-rose-300/90">{tx("dashboard.dateRangeInvalid")}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton
                    type="button"
                    disabled={exportRangeInvalid || exportingLedger}
                    onClick={() => void downloadLedgerExport()}
                  >
                    {exportingLedger ? tx("dashboard.exporting") : tx("dashboard.exportButton")}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={resetExportDates}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    Clear Filters
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-white/35">{tx("dashboard.exportFooterHint")}</p>
              </GlassCard>

              <GlassCard className="p-6 md:p-8">
                <h2 className="text-2xl font-semibold">Quick launch checkpoints</h2>
                <div className="mt-5 grid gap-3 text-sm text-white/65">
                  <p>• Review pending agents and send official onboarding messages</p>
                  <p>• Monitor winner payout queue before official launch</p>
                  <p>• Keep branding, homepage and promotions aligned</p>
                </div>
              </GlassCard>

              <GlassCard className="p-6 md:p-8">
                <div className="grid gap-3 text-sm">
                  <Link
                    href="/admin/agents"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10"
                  >
                    Open agent applications
                  </Link>
                  <Link
                    href="/admin/support"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10"
                  >
                    Support inbox
                  </Link>
                  <Link
                    href="/admin/branding"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10"
                  >
                    Open branding panel
                  </Link>
                  <Link
                    href="/admin/withdrawals"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10"
                  >
                    Open payout control
                  </Link>
                </div>
              </GlassCard>
            </div>
          </div>
          ) : null}
        </>
      )}
    </SidebarShell>
  );
}
