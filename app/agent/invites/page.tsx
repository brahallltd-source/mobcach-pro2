"use client";

import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, SidebarShell, StatCard } from "@/components/ui";

type Invite = { id: string; agentId: string; playerEmail: string; total_recharge_amount: number; bonus_awarded: boolean; created_at: string };

export default function AgentInvitesPage() {
  const [agentId, setAgentId] = useState("");
  const [items, setItems] = useState<Invite[]>([]);
  const [saving, setSaving] = useState(false);
  const load = async (id: string) => { const res = await fetch(`/api/agent/invites?agentId=${encodeURIComponent(id)}`, { cache: "no-store" }); const data = await res.json(); setItems(data.invites || []); };
  useEffect(() => { const saved = localStorage.getItem("mobcash_user"); if (!saved) return void (window.location.href = "/login"); const user = JSON.parse(saved); setAgentId(user.agentId || ""); if (user.agentId) load(user.agentId); }, []);
  const total = items.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);
  const eligible = total >= 3000 && !items.some((item) => item.bonus_awarded);
  const claim = async () => { setSaving(true); const res = await fetch("/api/agent/award-invite-bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) }); const data = await res.json(); if (!res.ok) { alert(data.message || "Could not claim bonus"); setSaving(false); return; } alert(data.message || "Bonus awarded"); await load(agentId); setSaving(false); };
  return <SidebarShell role="agent"><PageHeader title="Player invites" subtitle="Track players you invited. When their total recharge reaches 3000 DH, you can claim a one-time 200 DH wallet bonus." action={<PrimaryButton onClick={claim} disabled={!eligible || saving}>{saving ? "Processing..." : "Claim 200 DH"}</PrimaryButton>} /><div className="grid gap-4 md:grid-cols-3"><StatCard label="Invite total" value={`${total} DH`} hint="Combined recharge amount from invited players" /><StatCard label="Bonus" value={eligible ? "Ready" : items.some((item) => item.bonus_awarded) ? "Claimed" : "Locked"} hint="200 DH after 3000 DH total" /><StatCard label="Invite count" value={String(items.length)} hint="Tracked player invites for this agent" /></div><GlassCard className="p-6 md:p-8"><h2 className="text-2xl font-semibold">Invite records</h2><div className="mt-5 grid gap-4">{items.map((item) => <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-lg font-semibold">{item.playerEmail}</p><p className="mt-1 text-sm text-white/55">Recharge total: {item.total_recharge_amount} DH</p></div><div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${item.bonus_awarded ? "bg-emerald-400/10 text-emerald-200" : "bg-white/10 text-white/65"}`}>{item.bonus_awarded ? "awarded" : "tracking"}</div></div><p className="mt-3 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p></div>)}{!items.length ? <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">No player invite records yet.</div> : null}</div></GlassCard></SidebarShell>;
}
