"use client";

import { useEffect, useMemo, useState } from "react";
import { DangerButton, GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";

type Withdrawal = { id: string; playerEmail: string; amount: number; method: string; status: string; created_at: string; cashProvider?: string; city?: string; fullName?: string; rib?: string; swift?: string };

export default function AgentWithdrawalsPage() {
  const [agentId, setAgentId] = useState("");
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (id: string) => {
    const res = await fetch(`/api/agent/withdrawals?agentId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.withdrawals || []);
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    if (user.role !== "agent") return void (window.location.href = "/login");
    setAgentId(user.agentId || "");
    if (user.agentId) load(user.agentId).finally(() => setLoading(false)); else setLoading(false);
  }, []);

  const review = async (withdrawalId: string, action: "approve" | "reject") => {
    setBusyId(withdrawalId);
    const res = await fetch("/api/agent/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawalId, action }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.message || "Review failed");
    await load(agentId);
    setBusyId(null);
  };

  const pending = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);
  const approved = useMemo(() => items.filter((item) => item.status === "agent_approved").length, [items]);

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading withdrawals..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Winner payouts" subtitle="Winning players send their payout details here first. Review each request carefully before admin sends the funds." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending review" value={String(pending)} hint="Needs your decision" />
        <StatCard label="Approved by you" value={String(approved)} hint="Waiting for admin transfer" />
        <StatCard label="History" value={String(items.length)} hint="Complete payout activity" />
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <GlassCard key={item.id} className="p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{item.playerEmail}</h3>
                <p className="mt-2 text-sm text-white/55">{item.amount} DH • {item.method === "bank" ? "Bank transfer" : item.cashProvider || "Cash transfer"}</p>
                <p className="mt-2 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                <div className="mt-4 grid gap-2 text-sm text-white/60">
                  {item.method === "bank" ? (
                    <>
                      <p>RIB: {item.rib || "—"}</p>
                      <p>SWIFT: {item.swift || "—"}</p>
                    </>
                  ) : (
                    <>
                      <p>Receiver: {item.fullName || "—"}</p>
                      <p>City: {item.city || "—"}</p>
                      <p>Provider: {item.cashProvider || "Cash"}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/75">{item.status.replaceAll("_", " ")}</span>
                {item.status === "pending" ? (
                  <>
                    <PrimaryButton onClick={() => review(item.id, "approve")} disabled={busyId === item.id}>{busyId === item.id ? "Processing..." : "Approve"}</PrimaryButton>
                    <DangerButton onClick={() => review(item.id, "reject")} disabled={busyId === item.id}>{busyId === item.id ? "Processing..." : "Reject"}</DangerButton>
                  </>
                ) : null}
              </div>
            </div>
          </GlassCard>
        ))}
        {!items.length ? <GlassCard className="p-10 text-center">No winner payout requests yet.</GlassCard> : null}
      </div>
    </SidebarShell>
  );
}
