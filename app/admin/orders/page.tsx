"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard, PageHeader, SidebarShell, StatCard, StatusBadge } from "@/components/ui";

type Order = {
  id: string;
  agentId: string;
  playerEmail: string;
  gosportUsername?: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  fraudCategory?: "FAKE_RECEIPT" | "NON_RECEIPT" | "SUSPICIOUS_ACTIVITY";
  proofUrl?: string | null;
};

const FILTERS = [
  "all",
  "proof_uploaded",
  "agent_approved_waiting_player",
  "completed",
  "flagged_for_review",
  "flagged_requests",
] as const;

function isFlaggedOrder(order: Order) {
  return Boolean(
    order.isFlagged ||
      order.reviewRequired ||
      order.status === "flagged_for_review" ||
      order.status === "UNDER_INVESTIGATION",
  );
}

const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  all: "all",
  proof_uploaded: "proof uploaded",
  agent_approved_waiting_player: "agent approved waiting player",
  completed: "completed",
  flagged_for_review: "flagged for review",
  flagged_requests: "flagged requests",
};

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    fetch("/api/admin/orders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const requested = String(searchParams.get("filter") || "").trim();
    if (requested && FILTERS.includes(requested as (typeof FILTERS)[number])) {
      setFilter(requested as (typeof FILTERS)[number]);
    }
  }, [searchParams]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? orders
        : filter === "flagged_requests"
          ? orders.filter(isFlaggedOrder)
          : orders.filter((order) => order.status === filter),
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
          value={String(orders.filter(isFlaggedOrder).length)}
          hint="Flagged / under investigation"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {FILTERS.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
              filter === item ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white"
            }`}
          >
            {FILTER_LABEL[item]}
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
                  <p className="mt-1 text-sm font-medium text-white">
                    اسم مستخدم GoSport365:{" "}
                    <span className="font-semibold text-white" dir="ltr">
                      {String(order.gosportUsername || "—").trim() || "—"}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Agent {order.agentId} • Created {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Updated {new Date(order.updatedAt).toLocaleString()}
                  </p>
                  {isFlaggedOrder(order) ? (
                    <div className="mt-3 space-y-1 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-200">Flagged Request</p>
                      <p className="text-sm text-white/90">
                        Reason: <span className="text-rose-100">{order.flagReason || order.reviewReason || "—"}</span>
                      </p>
                      <p className="text-xs text-rose-100/80">
                        Category: {String(order.fraudCategory || "SUSPICIOUS_ACTIVITY")}
                      </p>
                      {order.proofUrl ? (
                        <Link
                          href={order.proofUrl}
                          target="_blank"
                          className="inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline"
                        >
                          Open uploaded proof
                        </Link>
                      ) : (
                        <p className="text-xs text-white/55">No proof uploaded</p>
                      )}
                    </div>
                  ) : null}
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