"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
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
  paymentMethodName?: string;
  gosportUsername?: string;
};

export default function PlayerChatPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (email: string) =>
    fetch(`/api/player/orders?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
    })
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

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading chat..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title="Chat with your agent"
        subtitle="Open any order thread, keep the conversation alive and complete the final approval from the same workspace after the agent approves your recharge."
      />

      <div className="space-y-4">
        {orders.map((order) => (
          <GlassCard key={order.id} className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">Order {order.id}</h3>
                <p className="mt-2 text-sm text-white/55">
                  {order.paymentMethodName || "Method pending"} •{" "}
                  {order.gosportUsername || "Username pending"}
                </p>
                <p className="mt-1 text-sm text-white/45">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={order.status} />
                <Link href={`/player/chat/${order.id}`}>
                  <PrimaryButton>Open chat</PrimaryButton>
                </Link>
              </div>
            </div>
          </GlassCard>
        ))}

        {!orders.length ? (
          <GlassCard className="p-10 text-center">
            No conversations yet. Create an order first.
          </GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}