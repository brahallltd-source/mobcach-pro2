"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GlobalBanner } from "@/components/GlobalBanner";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
  TextField,
} from "@/components/ui";
import { redirectToLogin, fetchSessionUser, type MobcashUser } from "@/lib/client-session";
import {
  AlertTriangle,
  Clock,
  Link2,
  Search,
  ThumbsDown,
  ThumbsUp,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  AgentLinkRequestApprovalRow,
  type AgentPendingLinkRow,
} from "@/components/agent/AgentLinkRequestApprovalRow";
import { formatShortPlayerId } from "@/lib/format-player-id";
import { useAgentTranslation } from "@/hooks/useTranslation";
import { useTranslation } from "@/lib/i18n";
import { agentT } from "@/lib/i18n/dictionaries/agent";
import { PushEngagementAlert } from "@/components/pwa/PushEngagementAlert";

type AgentUser = MobcashUser & {
  agentId?: string;
  username?: string;
};

type DashboardHome = {
  walletBalance: number;
  stats: { totalPlayers: number; pendingLinkRequests: number; todaySalesDh: number };
  pendingPreview: { id: string; playerId: string; username: string; phone: string }[];
  recentRecharges: { id: string; createdAt: string; amount: number; playerId: string }[];
  marketplacePreview: {
    displayName: string;
    likes: number;
    dislikes: number;
    ratingPercent: number;
    executionTimeLabel: string;
    paymentPills: string[];
  };
};

type CustomerRow = {
  id: string;
  playerId: string;
  username: string;
  gs365Username?: string | null;
  status?: string;
};

function ratingTone(p: number, hasVotes: boolean): string {
  if (!hasVotes) return "border-white/15 bg-white/10 text-white/80";
  if (p > 90) return "border-emerald-400/40 bg-emerald-500/15 text-emerald-50";
  if (p > 70) return "border-amber-400/35 bg-amber-500/15 text-amber-50";
  return "border-rose-400/40 bg-rose-500/15 text-rose-50";
}

export default function AgentDashboardPage() {
  const { lang } = useTranslation();
  const { t, ta } = useAgentTranslation();
  const dateLocale = lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US";
  const [user, setUser] = useState<AgentUser | null>(null);
  const [home, setHome] = useState<DashboardHome | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargePlayerId, setRechargePlayerId] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeBusy, setRechargeBusy] = useState(false);

  const loadCustomers = useCallback(async () => {
    const res = await fetch("/api/agent/agent-customers", { credentials: "include", cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    const list = (data.customers || []) as CustomerRow[];
    setCustomers(list);
  }, []);

  const refreshHome = useCallback(async () => {
    const homeRes = await fetch("/api/agent/dashboard-home", { credentials: "include", cache: "no-store" });
    const h = await homeRes.json();
    if (homeRes.ok && h.success) setHome(h as DashboardHome);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const fresh = (await fetchSessionUser()) as MobcashUser | null;
        if (!fresh || String(fresh.role).toLowerCase() !== "agent") {
          return void redirectToLogin();
        }

        const appSt = String(fresh.applicationStatus ?? "NONE").toUpperCase();
        if (appSt === "PENDING") {
          if (typeof window !== "undefined") window.location.replace("/pending");
          return;
        }

        if (appSt === "REJECTED") {
          setUser({
            ...fresh,
            applicationStatus: fresh.applicationStatus,
            rejectionReason: fresh.rejectionReason,
          } as AgentUser);
          setLoading(false);
          return;
        }

        const current = fresh as AgentUser;
        const idToSearch = current.agentProfile?.id || current.agentId || current.id;
        if (!idToSearch) throw new Error("Missing Agent ID");

        const profileRes = await fetch(
          `/api/agent/profile?agentId=${encodeURIComponent(String(idToSearch))}`,
          { cache: "no-store", credentials: "include" }
        );
        if (!profileRes.ok) {
          if (profileRes.status === 404) throw new Error(agentT(lang, "dashboard_error_profile_missing"));
          const errorData = await profileRes.json().catch(() => ({} as Record<string, unknown>));
          const msg =
            (typeof errorData.error === "string" && errorData.error) ||
            (typeof errorData.message === "string" && errorData.message) ||
            "";
          throw new Error(msg || agentT(lang, "dashboard_error_server"));
        }
        const profileData = await profileRes.json();
        const agentKey = String(profileData.realAgentId || idToSearch);

        const updatedUser: AgentUser = {
          ...current,
          status: profileData.status,
          username: profileData.username || current.username,
          agentId: profileData.realAgentId ? String(profileData.realAgentId) : current.agentId,
          applicationStatus: fresh.applicationStatus,
          hasUsdtAccess: fresh.hasUsdtAccess,
          rejectionReason: fresh.rejectionReason,
        };
        setUser(updatedUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));
        }

        const isStatusActive = profileData.status?.toUpperCase() === "ACTIVE";
        if (isStatusActive) {
          const [homeRes] = await Promise.all([
            fetch("/api/agent/dashboard-home", { credentials: "include", cache: "no-store" }),
            loadCustomers(),
          ]);
          const h = await homeRes.json();
          if (homeRes.ok && h.success) setHome(h as DashboardHome);
        }
      } catch (err: unknown) {
        console.error("Dashboard Error:", err);
        setError(err instanceof Error ? err.message : agentT(lang, "dashboard_error_unexpected"));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [loadCustomers, lang]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshHome();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshHome]);

  const searchHit = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return (
      customers.find(
        (c) =>
          c.playerId.toLowerCase() === q ||
          c.playerId.toLowerCase().includes(q) ||
          (c.username && c.username.toLowerCase().includes(q))
      ) ?? null
    );
  }, [search, customers]);

  const openRecharge = (playerId: string) => {
    setRechargePlayerId(playerId);
    setRechargeAmount("");
    setRechargeOpen(true);
  };

  const submitRecharge = async () => {
    const amt = Number(rechargeAmount);
    if (!rechargePlayerId || !Number.isFinite(amt) || amt <= 0) return;
    setRechargeBusy(true);
    try {
      const res = await fetch("/api/agent/agent-customers/quick-recharge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: rechargePlayerId, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || t("dashboard_alert_recharge_failed"));
        return;
      }
      alert(data.message || t("dashboard_alert_recharge_ok"));
      setRechargeOpen(false);
      const homeRes = await fetch("/api/agent/dashboard-home", { credentials: "include", cache: "no-store" });
      const h = await homeRes.json();
      if (homeRes.ok && h.success) setHome(h as DashboardHome);
      await loadCustomers();
    } finally {
      setRechargeBusy(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text={t("dashboard_loading_refresh")} />
      </SidebarShell>
    );
  }

  if (error) {
    return (
      <SidebarShell role="agent">
        <GlassCard className="mx-auto mt-10 max-w-2xl border-red-500/20 p-10 text-center">
          <AlertTriangle size={64} className="mx-auto mb-6 text-red-500" />
          <h2 className="text-2xl font-bold">{t("dashboard_error_title")}</h2>
          <p className="mt-4 text-white/70">{error}</p>
          <PrimaryButton onClick={() => window.location.reload()} className="mt-6">
            {t("dashboard_error_retry")}
          </PrimaryButton>
        </GlassCard>
      </SidebarShell>
    );
  }

  if (!user) return null;

  const appUpper = String(user.applicationStatus ?? "NONE").toUpperCase();
  if (appUpper === "REJECTED") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="mx-auto mt-10 max-w-2xl border-red-500/30 bg-red-500/5 p-10 text-center">
          <XCircle size={64} className="mx-auto mb-6 text-red-500" />
          <h2 className="text-3xl font-bold text-red-400">{t("dashboard_rejected_title")}</h2>
          <p className="mt-4 text-lg text-white/70">
            {user.rejectionReason?.trim()
              ? user.rejectionReason
              : t("dashboard_rejected_default_reason")}
          </p>
          <Link href="/registre/player" className="mt-8 block">
            <PrimaryButton className="w-full">{t("dashboard_rejected_cta")}</PrimaryButton>
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  const statusUpper = user.status?.toUpperCase();
  if (statusUpper === "PENDING" || statusUpper === "ACCOUNT_CREATED") {
    return (
      <SidebarShell role="agent">
        <GlassCard className="mx-auto mt-10 max-w-2xl border-amber-500/20 p-10 text-center">
          <Clock size={64} className="mx-auto mb-6 animate-pulse text-amber-500" />
          <h2 className="text-3xl font-bold text-amber-400">{t("dashboard_pending_status_title")}</h2>
          <p className="mt-4 text-lg text-white/70">{t("dashboard_pending_status_body")}</p>
        </GlassCard>
      </SidebarShell>
    );
  }

  const mp = home?.marketplacePreview;
  const mpVotes = mp ? mp.likes + mp.dislikes : 0;
  const mpHas = mpVotes > 0;

  return (
    <SidebarShell role="agent">
      <GlobalBanner />
      <PageHeader
        title={ta("dashboard_welcome", {
          name: user.username || t("dashboard_welcome_fallback"),
        })}
        subtitle={t("dashboard_subtitle")}
      />
      <PushEngagementAlert role="agent" />

      <div className="mt-8 space-y-10">
        {/* Section 1 */}
        <div className="grid gap-8 lg:grid-cols-4">
          <GlassCard className="p-6 md:p-8 lg:col-span-1">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-200">
                <Wallet className="h-7 w-7" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                  {t("dashboard_wallet_balance")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white md:text-3xl">
                  {Math.round(home?.walletBalance ?? 0)}{" "}
                  <span className="text-base font-semibold text-white/55">MAD</span>
                </p>
                <Link href="/agent/balance-topup-requests" className="mt-4 block">
                  <PrimaryButton type="button" className="w-full">
                    {t("dashboard_request_balance")}
                  </PrimaryButton>
                </Link>
              </div>
            </div>
          </GlassCard>
          <div className="grid gap-6 sm:grid-cols-3 lg:col-span-3">
            <StatCard
              label={t("dashboard_stat_total_players")}
              value={String(home?.stats.totalPlayers ?? 0)}
              hint={t("dashboard_stat_total_players_hint")}
            />
            <StatCard
              label={t("dashboard_stat_pending_links")}
              value={String(home?.stats.pendingLinkRequests ?? 0)}
              hint={t("dashboard_stat_pending_links_hint")}
            />
            <StatCard
              label={t("dashboard_stat_today_sales")}
              value={`${Math.round(home?.stats.todaySalesDh ?? 0)} MAD`}
              hint={t("dashboard_stat_today_sales_hint")}
            />
          </div>
        </div>

        {/* طلبات ربط جديدة — نفس نموذج الموافقة المنزلق */}
        <GlassCard className="border border-cyan-500/15 p-6 shadow-lg shadow-black/30 md:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                <Link2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t("dashboard_new_links_title")}</h2>
                <p className="mt-1 text-sm text-white/50">{t("dashboard_new_links_body")}</p>
              </div>
            </div>
            <Link
              href="/agent/add-requests"
              className="shrink-0 text-sm font-medium text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              {t("dashboard_all_requests")}
            </Link>
          </div>
          <div className="mt-8 space-y-5">
            {(home?.pendingPreview?.length ? home.pendingPreview : []).map((p) => {
              const row: AgentPendingLinkRow = {
                id: p.id,
                playerId: p.playerId,
                username: p.username,
                phone: p.phone ?? "",
              };
              return (
                <AgentLinkRequestApprovalRow
                  key={p.id}
                  row={row}
                  onResolved={async () => {
                    await refreshHome();
                    await loadCustomers();
                  }}
                />
              );
            })}
            {home?.pendingPreview?.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] py-8 text-center text-sm text-white/45">
                {t("dashboard_no_pending")}
              </p>
            ) : null}
          </div>
        </GlassCard>

        {/* Section 2 */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-lg font-semibold text-cyan-100">{t("dashboard_quick_search_title")}</h2>
          <p className="mt-1 text-sm text-white/50">{t("dashboard_quick_search_body")}</p>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <TextField
              className="pl-10"
              placeholder={t("dashboard_quick_search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {searchHit &&
          ["APPROVED", "CONNECTED"].includes(String(searchHit.status ?? "").toUpperCase()) ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
              <p className="text-xs text-white/50">{t("dashboard_matched_player")}</p>
              <p className="font-mono text-sm text-cyan-200" dir="ltr">
                {formatShortPlayerId(searchHit.playerId)}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {t("dashboard_gs365_label")}{" "}
                <span className="font-medium text-white">
                  {searchHit.gs365Username || t("dashboard_gs365_missing")}
                </span>
              </p>
              <PrimaryButton
                type="button"
                className="mt-3"
                onClick={() => openRecharge(searchHit.playerId)}
                disabled={!searchHit.gs365Username}
              >
                {t("dashboard_recharge")}
              </PrimaryButton>
            </div>
          ) : search.trim() ? (
            <p className="mt-3 text-sm text-amber-200/90">{t("dashboard_no_match")}</p>
          ) : null}
        </GlassCard>

        {/* Marketplace preview */}
        {mp ? (
          <GlassCard className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t("dashboard_marketplace_title")}</h2>
                <p className="mt-1 text-sm text-white/50">{t("dashboard_marketplace_body")}</p>
              </div>
              <Link
                href="/player/select-agent"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
              >
                {t("dashboard_marketplace_open")}
              </Link>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                <span className="text-xl font-bold text-white">{mp.displayName}</span>
                <span
                  className={`rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums ${ratingTone(mp.ratingPercent, mpHas)}`}
                >
                  {mpHas ? `${mp.ratingPercent}%` : "—"}
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-white/70">
                  <ThumbsUp className="h-4 w-4 text-emerald-300" />
                  {mp.likes}
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-white/70">
                  <ThumbsDown className="h-4 w-4 text-rose-300" />
                  {mp.dislikes}
                </span>
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  ⚡ {mp.executionTimeLabel}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 md:gap-4">
                {mp.paymentPills.length === 0 ? (
                  <span className="text-xs text-white/40">{t("dashboard_no_payment_methods")}</span>
                ) : (
                  mp.paymentPills.slice(0, 8).map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/80"
                    >
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>
          </GlassCard>
        ) : null}

        {/* Section 3 — شحن سريع */}
        <GlassCard className="overflow-hidden border border-white/[0.06] p-0 shadow-lg shadow-black/25">
          <div className="border-b border-white/10 px-5 py-4 md:px-6">
            <h2 className="font-semibold text-white">{t("dashboard_recent_recharges_title")}</h2>
            <p className="text-xs text-white/45">{t("dashboard_recent_recharges_subtitle")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/40">
                  <th className="px-4 py-3">{t("table_date")}</th>
                  <th className="px-4 py-3">{t("table_amount")}</th>
                  <th className="px-4 py-3">{t("table_player_id")}</th>
                </tr>
              </thead>
              <tbody>
                {(home?.recentRecharges?.length ? home.recentRecharges : []).map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/75" dir="ltr">
                      {new Date(r.createdAt).toLocaleString(dateLocale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-emerald-200" dir="ltr">
                      {Math.round(r.amount).toLocaleString(dateLocale)} MAD
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-cyan-200/90" dir="ltr">
                      {r.playerId || "—"}
                    </td>
                  </tr>
                ))}
                {home?.recentRecharges?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-white/45">
                      {t("dashboard_no_operations")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {rechargeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <GlassCard className="w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white">{t("dashboard_modal_quick_title")}</h3>
            <p className="mt-1 font-mono text-sm text-cyan-200/90" dir="ltr">
              {rechargePlayerId}
            </p>
            <label className="mt-4 block text-xs text-white/50">{t("dashboard_modal_amount_label")}</label>
            <TextField
              type="number"
              className="mt-1"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
            />
            <div className="mt-8 flex gap-4">
              <PrimaryButton
                type="button"
                className="flex-1"
                disabled={rechargeBusy}
                onClick={() => void submitRecharge()}
              >
                {rechargeBusy ? t("dashboard_modal_busy") : t("dashboard_modal_confirm")}
              </PrimaryButton>
              <button
                type="button"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
                onClick={() => setRechargeOpen(false)}
              >
                {t("dashboard_modal_cancel")}
              </button>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </SidebarShell>
  );
}
