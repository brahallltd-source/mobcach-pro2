
"use client";

import { useEffect, useMemo, useState } from "react";
import { RevenueAreaChart } from "@/components/charts";
import { GlassCard, LoadingCard, PageHeader, SidebarShell, StatCard } from "@/components/ui";

type Analytics = {
  growth: { users: number; players: number; agents: number; pendingAgents: number; referrals: number };
  finance: { orders: number; orderVolume: number; completedOrderVolume: number; withdrawalsPending: number; topupsPending: number };
  trust: { complaints: number; duplicateProofs: number; flaggedOrders: number; completedOrders: number };
  orderStatusChart: { name: string; value: number }[];
  bonusTracking?: {
    approvedRechargeRequests: number;
    totalRealDepositsDh: number;
    totalBonusGiftedDh: number;
    activeAgents: number;
    totalAgentWalletBalancesDh: number;
  };
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  const growthCards = useMemo(() => ([
    { label: "Users", value: String(data?.growth.users || 0), hint: "Total users across roles" },
    { label: "Players", value: String(data?.growth.players || 0), hint: "Registered player accounts" },
    { label: "Agents", value: String(data?.growth.agents || 0), hint: "Approved active agents" },
    { label: "Referrals", value: String(data?.growth.referrals || 0), hint: "Tracked referral rows" },
  ]), [data]);

  if (loading || !data) return <SidebarShell role="admin"><LoadingCard text="Loading growth analytics..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Growth analytics" subtitle="Live overview of growth, finance health, trust signals and operational pressure before scaling the official launch." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {growthCards.map((card) => <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Orders & volume</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <StatCard label="Orders" value={String(data.finance.orders)} hint="Total orders tracked" />
            <StatCard label="Order volume" value={`${data.finance.orderVolume} DH`} hint="Gross order volume" />
            <StatCard label="Completed volume" value={`${data.finance.completedOrderVolume} DH`} hint="Volume confirmed as completed" />
            <StatCard label="Pending topups" value={String(data.finance.topupsPending)} hint="Agent recharge requests awaiting admin" />
          </div>
          <div className="mt-6">
            <RevenueAreaChart title="Order lifecycle distribution" data={data.orderStatusChart} />
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Trust health</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <StatCard label="Complaints" value={String(data.trust.complaints)} hint="Support pressure" />
              <StatCard label="Duplicate proofs" value={String(data.trust.duplicateProofs)} hint="Potential fraud attempts" />
              <StatCard label="Flagged orders" value={String(data.trust.flaggedOrders)} hint="Need review" />
              <StatCard label="Completed orders" value={String(data.trust.completedOrders)} hint="Operational success" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Launch note</h2>
            <p className="mt-4 text-sm leading-7 text-white/65">
              Use this analytics page during localhost testing, closed beta and soft launch. It gives a quick business picture before the wider official rollout.
            </p>
          </GlassCard>
        </div>
      </div>
    </SidebarShell>
  );
}
