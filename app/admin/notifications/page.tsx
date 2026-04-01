"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";

type Notification = { id: string; title: string; message: string; read: boolean; created_at: string };

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    const target = user.role === "agent" ? (user.agentId || "") : user.id;
    fetch(`/api/notifications?targetRole=${encodeURIComponent(user.role)}&targetId=${encodeURIComponent(target)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(data.notifications || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading notifications..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Notifications" subtitle="Automatic alerts for winners, payout approvals, transfers and support actions." />
      <div className="space-y-4">
        {items.map((item) => (
          <GlassCard key={item.id} className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-100"><BellRing size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-white/35">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/60">{item.message}</p>
              </div>
            </div>
          </GlassCard>
        ))}
        {!items.length ? <GlassCard className="p-10 text-center">No notifications yet.</GlassCard> : null}
      </div>
    </SidebarShell>
  );
}
