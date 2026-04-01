"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  EmptyState,
  GlassCard,
  LoadingCard,
  PageHeader,
  SidebarShell,
  StatCard,
  StatusBadge,
  TextField,
} from "@/components/ui";

type Order = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  playerEmail: string;
  gosportUsername?: string;
  paymentMethodName?: string;
};

type FilterType = "all" | "new" | "waiting" | "completed";

export default function AgentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");

  const load = (email: string) =>
    fetch(`/api/agent/orders?email=${encodeURIComponent(email)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []));

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    if (user.role !== "agent") return void (window.location.href = "/login");
    load(user.email).finally(() => setLoading(false));
  }, []);

  const newOrders = useMemo(
    () => orders.filter((item) => ["proof_uploaded", "pending_payment"].includes(item.status)).length,
    [orders]
  );

  const waitingPlayer = useMemo(
    () => orders.filter((item) => item.status === "agent_approved_waiting_player").length,
    [orders]
  );

  const completed = useMemo(
    () => orders.filter((item) => item.status === "completed").length,
    [orders]
  );

  const filteredOrders = useMemo(() => {
    let base = orders;

    if (filter === "new") {
      base = orders.filter((item) => ["proof_uploaded", "pending_payment"].includes(item.status));
    }

    if (filter === "waiting") {
      base = orders.filter((item) => item.status === "agent_approved_waiting_player");
    }

    if (filter === "completed") {
      base = orders.filter((item) => item.status === "completed");
    }

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((item) =>
      item.playerEmail.toLowerCase().includes(q) ||
      String(item.gosportUsername || "").toLowerCase().includes(q) ||
      String(item.paymentMethodName || "").toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  }, [orders, filter, query]);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="Loading orders..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Orders"
        subtitle="Search quickly, switch between smart order states and keep the workspace focused on the orders that need action now."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="All orders" value={String(orders.length)} hint="Complete order history" />
        <StatCard label="New orders" value={String(newOrders)} hint="Fresh orders needing action" />
        <StatCard label="Waiting orders" value={String(waitingPlayer)} hint="Approved by you, waiting final player approval" />
        <StatCard label="Completed" value={String(completed)} hint="Finished successfully" />
      </div>

      <GlassCard className="p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
              size={16}
            />
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player email, username, method or order id"
              className="pl-11"
            />
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            {[
              { key: "all", label: `All Orders (${orders.length})` },
              { key: "new", label: `New Orders (${newOrders})` },
              { key: "waiting", label: `Waiting Orders (${waitingPlayer})` },
              { key: "completed", label: `Completed (${completed})` },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key as FilterType)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  filter === item.key
                    ? "bg-white text-slate-950"
                    : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Link key={order.id} href={`/agent/chat/${order.id}`}>
            <GlassCard className="p-5 transition hover:bg-white/[0.08]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold">{order.playerEmail}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-2 text-sm text-white/55">
                    {order.paymentMethodName || "Method pending"} • {order.gosportUsername || "Username pending"}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-2xl font-semibold">{order.amount} DH</p>
              </div>
            </GlassCard>
          </Link>
        ))}

        {!filteredOrders.length ? (
          <EmptyState
            title="No orders match this view"
            subtitle="Try another tab or refine the search to find the order you need."
          />
        ) : null}
      </div>
    </SidebarShell>
  );
}