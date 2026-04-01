"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
} from "@/components/ui";

type Order = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  paymentMethodName?: string;
  gosportUsername?: string;
  playerApproved?: boolean;
};

const filters = [
  "all",
  "proof_uploaded",
  "agent_approved_waiting_player",
  "completed",
  "flagged_for_review",
];

export default function PlayerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    if (user.role !== "player") return void (window.location.href = "/login");

    fetch(`/api/player/orders?email=${encodeURIComponent(user.email)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter]
  );

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading player orders..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title="My orders"
        subtitle="Orders are separated from the new order flow. Open the chat or confirm the final approval after your agent approves the recharge."
        action={
          <Link href="/player/achat">
            <PrimaryButton>Create new order</PrimaryButton>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        {filters.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
              filter === item
                ? "bg-white text-black"
                : "border border-white/10 bg-white/5 text-white"
            }`}
          >
            {item.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No orders in this filter"
          subtitle="Start from the new order page, choose a method and upload your proof."
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/player/chat/${order.id}`}
              className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.08]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/35">
                    {order.id}
                  </p>
                  <p className="mt-3 text-2xl font-semibold">{order.amount} DH</p>
                  <p className="mt-2 text-sm text-white/55">
                    {order.paymentMethodName || "Method pending"} •{" "}
                    {order.gosportUsername || "Username pending"}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Created: {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Updated: {new Date(order.updatedAt || order.createdAt).toLocaleString()}
                  </p>
                  {order.status === "agent_approved_waiting_player" ? (
                    <p className="mt-2 text-sm text-emerald-200">
                      Open chat and confirm the final approval to complete this order.
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={order.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </SidebarShell>
  );
}