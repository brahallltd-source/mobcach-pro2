
"use client";

import { useEffect, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell, StatusBadge } from "@/components/ui";

export default function AgentWinnerRequestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (agentId: string) => {
    const res = await fetch(`/api/agent/winner-requests?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.requests || []);
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    if (user.role !== "agent") return void (window.location.href = "/login");
    load(user.agentId).finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading winner requests..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Winner confirmation requests" subtitle="Track player winner requests sent to the assigned agent before payout processing starts." />
      <div className="space-y-4">
        {items.map((item) => (
          <GlassCard key={item.id} className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xl font-semibold">{item.playerEmail}</p>
                <p className="mt-2 text-sm text-white/55">{item.amount} DH</p>
                <p className="mt-2 text-sm text-white/45">{item.note || "No note"}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          </GlassCard>
        ))}
        {!items.length ? <GlassCard className="p-10 text-center">No winner requests yet.</GlassCard> : null}
      </div>
    </SidebarShell>
  );
}
