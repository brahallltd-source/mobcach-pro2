
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RevenueAreaChart } from "@/components/charts";
import { GlassCard, LoadingCard, PageHeader, SidebarShell, StatCard } from "@/components/ui";

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({ orders: 0, complaints: 0, pendingAgents: 0, disputes: 0, withdrawals: 0, notifications: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/complaints", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/agent-applications", { cache: "no-store", credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/disputes", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/fraud", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/withdrawals", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/notifications?targetRole=admin&targetId=admin-1", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([orders, complaints, apps, disputes, fraud, withdrawals, notifications]) => {
      const appRows = apps.data || apps.applications || [];
      setCounts({
        orders: (orders.orders || []).length,
        complaints: (complaints.complaints || []).length,
        pendingAgents: appRows.filter((item: any) => item.status === "pending_agent_review").length,
        disputes: (disputes.disputes || []).length + ((fraud.summary?.pendingFlags) || 0),
        withdrawals: (withdrawals.withdrawals || []).filter((item: any) => item.status === "agent_approved").length,
        notifications: (notifications.notifications || []).filter((item: any) => !item.read).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => [
    { name: "Orders", value: counts.orders },
    { name: "Complaints", value: counts.complaints },
    { name: "Agents", value: counts.pendingAgents },
    { name: "Disputes", value: counts.disputes },
    { name: "Payouts", value: counts.withdrawals },
  ], [counts]);

  return (
    <SidebarShell role="admin">
      {loading ? (
        <LoadingCard text="Loading admin dashboard..." />
      ) : (
        <>
          <PageHeader title="Admin monitoring center" subtitle="Watch orders today, fraud alerts, payouts pending and all current operational queues from one clear finance-first command panel." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Orders today" value={String(counts.orders)} hint="Across all statuses" />
            <StatCard label="Complaints" value={String(counts.complaints)} hint="Player support queue" />
            <StatCard label="Pending agents" value={String(counts.pendingAgents)} hint="Applications awaiting decision" />
            <StatCard label="Fraud alerts" value={String(counts.disputes)} hint="Review queue requiring resolution" />
            <StatCard label="Payouts pending" value={String(counts.withdrawals)} hint="Waiting for admin transfer" />
            <StatCard label="Unread notifications" value={String(counts.notifications)} hint="Latest admin alerts" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <GlassCard className="p-6 md:p-8">
              <RevenueAreaChart title="Operational overview" data={chartData} />
            </GlassCard>

            <div className="space-y-6">
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
                  <Link href="/admin/agents" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10">Open agent applications</Link>
                  <Link href="/admin/branding" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10">Open branding panel</Link>
                  <Link href="/admin/withdrawals" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10">Open payout control</Link>
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </SidebarShell>
  );
}
