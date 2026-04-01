"use client";

import { useEffect, useMemo, useState } from "react";
import { DangerButton, GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatusBadge } from "@/components/ui";

type Claim = { id: string; agentId: string; track: "players" | "agents"; level: number; reward: number; status: string; created_at: string; reviewed_at?: string };

export default function AdminBonusPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const load = async () => {
    const res = await fetch("/api/admin/bonus", { cache: "no-store" });
    const data = await res.json();
    setClaims(data.claims || []);
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const review = async (claimId: string, action: "approve" | "reject") => {
    setBusyId(claimId);
    const res = await fetch("/api/admin/bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, action }) });
    const data = await res.json();
    if (!res.ok) alert(data.message || "Review failed");
    await load();
    setBusyId(null);
  };

  const items = useMemo(() => {
    if (filter === "pending") return claims.filter((item) => item.status === "pending_admin");
    if (filter === "approved") return claims.filter((item) => item.status === "approved");
    if (filter === "rejected") return claims.filter((item) => item.status === "rejected");
    return claims;
  }, [claims, filter]);

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading bonus claims..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Bonus claims" subtitle="Detect winning bonus claims from agents, review them manually and release rewards only after approval." />
      <div className="flex flex-wrap gap-3">
        {(["all","pending","approved","rejected"] as const).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${filter === item ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"}`}>{item}</button>
        ))}
      </div>
      <div className="space-y-4">
        {items.map((claim) => (
          <GlassCard key={claim.id} className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{claim.track === "players" ? "Player growth bonus" : "Agent referral bonus"}</h3>
                <p className="mt-2 text-sm text-white/55">Agent ID: {claim.agentId} • Level {claim.level} • Reward {claim.reward} DH</p>
                <p className="mt-2 text-sm text-white/45">Created: {new Date(claim.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={claim.status} />
                {claim.status === "pending_admin" ? <>
                  <PrimaryButton onClick={() => review(claim.id, "approve")} disabled={busyId === claim.id}>{busyId === claim.id ? "Processing..." : "Approve"}</PrimaryButton>
                  <DangerButton onClick={() => review(claim.id, "reject")} disabled={busyId === claim.id}>{busyId === claim.id ? "Processing..." : "Reject"}</DangerButton>
                </> : null}
              </div>
            </div>
          </GlassCard>
        ))}
        {!items.length ? <GlassCard className="p-10 text-center">No bonus claims found.</GlassCard> : null}
      </div>
    </SidebarShell>
  );
}
