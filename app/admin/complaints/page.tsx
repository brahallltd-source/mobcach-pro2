"use client";

import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, Shell, StatusBadge, TextArea } from "@/components/ui";

type Complaint = { id: string; playerEmail: string; subject: string; message: string; status: string; admin_reply?: string; created_at: string };

export default function AdminComplaintsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [replyById, setReplyById] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch("/api/admin/complaints", { cache: "no-store" });
    const data = await res.json();
    setItems(data.complaints || []);
  };

  useEffect(() => { load(); }, []);

  const respond = async (id: string) => {
    const reply = replyById[id];
    const res = await fetch("/api/admin/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ complaintId: id, admin_reply: reply }) });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "Reply failed");
    await load();
  };

  return (
    <Shell><div className="mx-auto max-w-7xl space-y-6"><PageHeader title="Complaints desk" subtitle="Reply to player complaints and maintain a support history inside the admin workspace." />
      <div className="space-y-4">{items.map((item) => <GlassCard key={item.id} className="p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-white/40">{item.playerEmail}</p><h3 className="mt-1 text-xl font-semibold">{item.subject}</h3></div><StatusBadge status={item.status} /></div><p className="mt-4 text-white/65">{item.message}</p>{item.admin_reply ? <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/75"><span className="font-semibold text-white">Reply:</span> {item.admin_reply}</div> : null}<div className="mt-4 space-y-3"><TextArea rows={4} placeholder="Write a reply..." value={replyById[item.id] || ""} onChange={(e) => setReplyById((prev) => ({ ...prev, [item.id]: e.target.value }))} /><PrimaryButton onClick={() => respond(item.id)}>Send reply</PrimaryButton></div></GlassCard>)}</div></div></Shell>
  );
}
