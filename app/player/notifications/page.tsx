"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { usePlayerTx } from "@/hooks/usePlayerTx";
import { GS365_GLOW } from "@/lib/ui/gs365-glow";

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function PlayerNotificationsPage() {
  const tp = usePlayerTx();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");

    fetch("/api/notifications?for=me&limit=50", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => setItems(data.notifications || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text={tp("notifications.loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader title={tp("notifications.title")} subtitle={tp("notifications.subtitle")} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <GlassCard
            key={item.id}
            className={`${GS365_GLOW.cardShell} ${GS365_GLOW.cardShellInteractive}`}
          >
            <div className={`${GS365_GLOW.cardInner} h-full`}>
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-2xl p-3 ${
                    !item.read
                      ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      : "bg-cyan-400/10 text-cyan-100"
                  }`}
                >
                  <BellRing size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3
                      className={`min-w-0 text-balance text-lg ${
                        !item.read ? "font-bold text-white" : "font-semibold text-white/85"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <span className="shrink-0 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : tp("notifications.dateUnavailable")}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${!item.read ? "text-white/80" : "text-slate-400"}`}>
                    {item.message}
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
        {!items.length ? (
          <GlassCard className="p-10 text-center text-white/40">
            <BellRing size={48} className="mx-auto mb-4 opacity-20" />
            {tp("notifications.empty")}
          </GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}
