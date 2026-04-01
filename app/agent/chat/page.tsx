"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  SidebarShell,
  StatCard,
  StatusBadge,
  TextField,
} from "@/components/ui";

type Msg = {
  senderRole: string;
  message: string;
  createdAt: string;
};

type Order = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  playerEmail: string;
  gosportUsername?: string;
  paymentMethodName?: string;
  messages?: Msg[];
};

export default function AgentChatPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = (email: string) =>
    fetch(`/api/agent/orders?email=${encodeURIComponent(email)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []));

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    load(user.email).finally(() => setLoading(false));
    const timer = setInterval(() => load(user.email), 4000);
    return () => clearInterval(timer);
  }, []);

  const unread = useMemo(
    () =>
      orders.filter((order) => {
        const last = (order.messages || []).slice(-1)[0];
        return last?.senderRole === "player";
      }).length,
    [orders]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter(
      (order) =>
        order.playerEmail.toLowerCase().includes(q) ||
        String(order.gosportUsername || "").toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q)
    );
  }, [orders, query]);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="Loading agent chat..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Agent chat inbox"
        subtitle="Receive player messages, keep each order thread open and answer players without leaving the order context."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Open conversations"
          value={String(orders.length)}
          hint="Orders with an available chat thread"
        />
        <StatCard
          label="Need reply"
          value={String(unread)}
          hint="Last message currently from player"
        />
        <StatCard
          label="Completed chats"
          value={String(orders.filter((order) => order.status === "completed").length)}
          hint="Conversations linked to finished orders"
        />
      </div>

      <GlassCard className="p-4 md:p-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
            size={16}
          />
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by player, username or order id"
            className="pl-11"
          />
        </div>
      </GlassCard>

      <div className="space-y-4">
        {filtered.map((order) => {
          const messages = order.messages || [];
          const lastMessage = messages.slice(-1)[0];
          const waitingReply = lastMessage?.senderRole === "player";

          return (
            <GlassCard key={order.id} className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{order.playerEmail}</p>
                    {waitingReply ? (
                      <span className="rounded-full bg-amber-300/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                        Need reply
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-white/55">
                    {order.paymentMethodName || "Method pending"} •{" "}
                    {order.gosportUsername || "Username pending"}
                  </p>

                  <p className="mt-1 text-sm text-white/45">
                    Order {order.id} • {new Date(order.updatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={order.status} />
                  <Link
                    href={`/agent/chat/${order.id}`}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
                  >
                    Open chat
                  </Link>
                </div>
              </div>
            </GlassCard>
          );
        })}

        {!filtered.length ? (
          <GlassCard className="p-10 text-center">No chat threads found.</GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}