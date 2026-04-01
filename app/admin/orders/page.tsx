"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, PageHeader, SidebarShell, StatCard, StatusBadge } from "@/components/ui";

type Order = {
  id: string;
  agentId: string;
  playerEmail: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewRequired?: boolean;
};

const filters = ["all", "proof_uploaded", "agent_approved_waiting_player", "completed", "flagged_for_review"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/orders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter]
  );

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="All orders"
        subtitle="Every player-agent order sorted by date with instant filters for completed, pending, suspended and flagged cases."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={String(orders.length)} hint="All orders in the system" />
        <StatCard
          label="Completed"
          value={String(orders.filter((o) => o.status === "completed").length)}
          hint="Executed successfully"
        />
        <StatCard
          label="Pending"
          value={String(orders.filter((o) => ["proof_uploaded", "agent_approved_waiting_player"].includes(o.status)).length)}
          hint="Still in progress"
        />
        <StatCard
          label="Flags"
          value={String(orders.filter((o) => o.status === "flagged_for_review" || o.reviewRequired).length)}
          hint="Needs attention"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {filters.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
              filter === item ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white"
            }`}
          >
            {item.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <GlassCard className="p-12 text-center">Loading orders...</GlassCard>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <GlassCard key={order.id} className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-white/40">{order.playerEmail}</p>
                  <h3 className="mt-1 text-xl font-semibold">Order {order.id}</h3>
                  <p className="mt-2 text-sm text-white/55">
                    Agent {order.agentId} • Created {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Updated {new Date(order.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-white/40">Amount</p>
                    <p className="text-2xl font-semibold">{order.amount} DH</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </SidebarShell>
  );
}