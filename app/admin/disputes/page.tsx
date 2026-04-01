"use client";

import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, Shell, StatusBadge } from "@/components/ui";

type Dispute = { id: string; orderId: string; playerEmail: string; agentId: string; reason: string; status: string; admin_note?: string; created_at: string };

export default function AdminDisputesPage() {
  const [items, setItems] = useState<Dispute[]>([]);
  const load = async () => {
    const res = await fetch("/api/admin/disputes", { cache: "no-store" });
    const data = await res.json();
    setItems(data.disputes || []);
  };
  useEffect(() => { load(); }, []);
  const resolve = async (disputeId: string) => {
    const res = await fetch("/api/admin/disputes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disputeId, status: "resolved", admin_note: "Resolved by admin" }) });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "Update failed");
    await load();
  };
  return <Shell><div className="mx-auto max-w-7xl space-y-6"><PageHeader title="Disputes & reviews" subtitle="Resolve flagged orders and disputes raised by the trust workflow." />
  <div className="space-y-4">{items.map((item) => <GlassCard key={item.id} className="p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-white/40">Order {item.orderId}</p><h3 className="mt-1 text-xl font-semibold">{item.reason}</h3><p className="mt-2 text-sm text-white/55">{item.playerEmail} · Agent {item.agentId}</p></div><div className="flex items-center gap-3"><StatusBadge status={item.status} />{item.status !== "resolved" ? <PrimaryButton onClick={() => resolve(item.id)}>Mark resolved</PrimaryButton> : null}</div></div></GlassCard>)}</div></div></Shell>;
}
