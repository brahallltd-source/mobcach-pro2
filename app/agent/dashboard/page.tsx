
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RevenueAreaChart } from "@/components/charts";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";

type AgentUser = { role: string; email: string; agentId?: string };
type Wallet = { balance: number };
type Order = { id: string; status: string; amount: number };
type PaymentMethod = { id: string };
type BonusProfile = { pendingBonus?: number; volume?: number; energy?: number; completedOrders?: number };

export default function AgentDashboardPage() {
  const [user, setUser] = useState<AgentUser | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [bonus, setBonus] = useState<BonusProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: AgentUser = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);

    Promise.all([
      fetch(`/api/agent/wallet?agentId=${encodeURIComponent(current.agentId || "")}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/agent/orders?email=${encodeURIComponent(current.email)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/agent/payment-methods?agentId=${encodeURIComponent(current.agentId || "")}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/agent/bonus?agentId=${encodeURIComponent(current.agentId || "")}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([walletData, ordersData, methodsData, bonusData]) => {
      setWallet(walletData.wallet || null);
      setOrders(ordersData.orders || []);
      setMethods(methodsData.methods || []);
      setBonus(bonusData.profile || null);
    }).finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    const open = orders.filter((item) => item.status !== "completed").length;
    const completed = orders.filter((item) => item.status === "completed").length;
    const pending = orders.filter((item) => ["pending_payment", "proof_uploaded"].includes(item.status)).length;
    return [
      { name: "Open", value: open },
      { name: "Completed", value: completed },
      { name: "Pending", value: pending },
    ];
  }, [orders]);

  const openOrders = orders.filter((item) => item.status !== "completed").length;
  const flagged = orders.filter((item) => item.status === "flagged_for_review").length;

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading agent dashboard..." /></SidebarShell>;
  if (!user) return null;

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Agent dashboard"
        subtitle="A clearer operations workspace with wallet, orders, bonus progress and payment setup in one cleaner layout."
      />

      <GlassCard className="p-5 md:p-7">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Control center</p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight md:text-4xl">
              Recharge faster, stay visible and keep your wallet ready.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 md:text-base">
              When wallet balance stays empty, new unassigned players will not be routed toward your offer. Keep payment methods configured and recharge your balance to stay competitive.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/agent/settings"><PrimaryButton>Open settings</PrimaryButton></Link>
              <Link href="/agent/recharge" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Recharge credits</Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Wallet balance" value={`${wallet?.balance || 0} DH`} hint="Updated automatically on approved recharge" />
            <StatCard label="Open orders" value={String(openOrders)} hint="Orders currently assigned to you" />
            <StatCard label="Payment methods" value={String(methods.length)} hint="Active methods visible to players" />
            <StatCard label="Flagged" value={String(flagged)} hint="Review these orders carefully" />
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <GlassCard className="p-5 md:p-7">
          <RevenueAreaChart title="Order overview" data={chartData} />
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-5 md:p-7">
            <h3 className="text-xl font-semibold">Bonus progress</h3>
            <div className="mt-4 grid gap-3 text-sm text-white/65">
              <p>Pending bonus: <span className="font-semibold text-white">{bonus?.pendingBonus || 0} DH</span></p>
              <p>Volume: <span className="font-semibold text-white">{bonus?.volume || 0} DH</span></p>
              <p>Energy: <span className="font-semibold text-white">{bonus?.energy || 0}</span></p>
              <p>Completed orders: <span className="font-semibold text-white">{bonus?.completedOrders || 0}</span></p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/agent/bonus" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Open bonus</Link>
              <Link href="/agent/orders" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Open orders</Link>
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-7">
            <h3 className="text-xl font-semibold">Quick actions</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <Link href="/agent/add-player" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10">Add player</Link>
              <Link href="/agent/activations" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10">Player activations</Link>
              <Link href="/agent/recharge" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 hover:bg-white/10">Recharge requests</Link>
            </div>
          </GlassCard>
        </div>
      </div>
    </SidebarShell>
  );
}
