"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  GlassCard,
  LoadingCard,
  SidebarShell,
  StatusBadge,
  PrimaryButton,
} from "@/components/ui";

type Order = {
  id: string;
  amount: number;
  status: string;
  paymentMethodName?: string;
  gosportUsername?: string;
  createdAt: string;
};

export default function PlayerOrderDetailPage() {
  const params = useParams();
  const orderId = String(params?.orderId || "");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");

    if (!saved) {
      window.location.href = "/login";
      return;
    }

    const user = JSON.parse(saved);

    const loadOrder = async () => {
      try {
        const res = await fetch(
          `/api/player/orders?email=${encodeURIComponent(user.email)}&orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setOrder(data.order || null);
      } catch (error) {
        console.error("LOAD ORDER ERROR:", error);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      void loadOrder();
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const confirmOrder = async () => {
    if (!order) return;

    try {
      setConfirming(true);

      const res = await fetch("/api/player/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to confirm order");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("CONFIRM ORDER ERROR:", error);
      alert("Network error");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading order..." />
      </SidebarShell>
    );
  }

  if (!order) {
    return (
      <SidebarShell role="player">
        <GlassCard className="p-10 text-center">
          Order not found.
        </GlassCard>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <div className="mx-auto max-w-4xl space-y-6">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/40">Order ID</p>
              <p className="text-lg font-semibold">{order.id}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <p className="mt-4 text-3xl font-semibold">{order.amount} DH</p>

          <p className="mt-2 text-white/60">
            {order.paymentMethodName || "Method pending"} •{" "}
            {order.gosportUsername || "Username pending"}
          </p>
        </GlassCard>

        {order.status === "proof_uploaded" && (
          <GlassCard className="p-6">
            <p className="font-semibold text-amber-200">
              Waiting for agent review
            </p>
            <p className="mt-2 text-sm text-white/60">
              You already sent payment proof. The agent will verify it.
            </p>
          </GlassCard>
        )}

        {order.status === "agent_approved_waiting_player" && (
          <GlassCard className="p-6">
            <p className="font-semibold text-emerald-200">
              Agent confirmed your payment
            </p>
            <p className="mt-2 text-sm text-white/60">
              Please confirm that you received your recharge.
            </p>

            <PrimaryButton
              onClick={confirmOrder}
              disabled={confirming}
              className="mt-5 w-full"
            >
              {confirming ? "Processing..." : "Confirm recharge received"}
            </PrimaryButton>
          </GlassCard>
        )}

        {order.status === "completed" && (
          <GlassCard className="p-6">
            <p className="font-semibold text-green-300">
              Recharge completed successfully ✅
            </p>
          </GlassCard>
        )}

        {order.status === "cancelled" && (
          <GlassCard className="p-6">
            <p className="font-semibold text-red-300">
              This order was cancelled
            </p>
          </GlassCard>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <button
            onClick={() => {
              window.location.href = `/player/chat/${order.id}`;
            }}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold"
          >
            Open Chat
          </button>

          <button
            onClick={() => alert("Flag sent to admin")}
            className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200"
          >
            Flag / Report
          </button>

          <button
            onClick={() => alert("Message sent to admin")}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold"
          >
            Contact Admin
          </button>
        </div>
      </div>
    </SidebarShell>
  );
}