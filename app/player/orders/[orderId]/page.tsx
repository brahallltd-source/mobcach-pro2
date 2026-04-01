"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
} from "@/components/ui";

type Message = {
  senderRole: string;
  message: string;
  createdAt: string;
};

type Order = {
  id: string;
  agentId: string;
  playerEmail: string;
  amount: number;
  gosportUsername: string;
  status: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  proofUploaded?: boolean;
  proofUploadedAt?: string;
  proofUrl?: string;
  paymentMethodName?: string;
  agentApproved?: boolean;
  agentApprovedAt?: string;
  playerApproved?: boolean;
  suspiciousFlags?: string[];
};

export default function PlayerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadOrder = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);

    const res = await fetch(
      `/api/player/orders?email=${encodeURIComponent(user.email)}&orderId=${encodeURIComponent(
        String(params.orderId || "")
      )}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    setOrder(data.order || null);
  };

  useEffect(() => {
    loadOrder().finally(() => setLoading(false));
  }, []);

  const createMessage = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/order-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: params.orderId,
          senderRole: "player",
          message: note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to send message");
        setBusy(false);
        return;
      }
      setNote("");
      await loadOrder();
    } catch (error) {
      console.error(error);
      alert("Network error");
    }
    setBusy(false);
  };

  const confirmOrder = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/player/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: params.orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to confirm order");
        setBusy(false);
        return;
      }
      alert(data.message || "Order confirmed");
      await loadOrder();
    } catch (error) {
      console.error(error);
      alert("Network error");
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <div className="mx-auto max-w-6xl">
          <GlassCard className="p-12 text-center">Loading order...</GlassCard>
        </div>
      </SidebarShell>
    );
  }

  if (!order) {
    return (
      <SidebarShell role="player">
        <div className="mx-auto max-w-6xl">
          <GlassCard className="p-12 text-center">Order not found.</GlassCard>
        </div>
      </SidebarShell>
    );
  }

  const timeline = [
    { label: "Order created", active: true, time: order.createdAt },
    {
      label: "Proof uploaded",
      active: Boolean(order.proofUploaded),
      time: order.proofUploadedAt || "",
    },
    {
      label: "Agent approved",
      active: Boolean(order.agentApproved),
      time: order.agentApprovedAt || "",
    },
    {
      label: "Player confirmed",
      active: Boolean(order.playerApproved),
      time: order.playerApproved ? order.updatedAt : "",
    },
  ];

  return (
    <SidebarShell role="player">
      <PageHeader
        title={`Order ${order.id}`}
        subtitle="Full lifecycle view with timeline, payment method, proof image and completion confirmation."
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="p-6">
          <h2 className="text-2xl font-semibold">Timeline</h2>

          <div className="mt-6 space-y-4">
            {timeline.map((step, index) => (
              <div key={step.label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-4 w-4 rounded-full ${
                      step.active ? "bg-cyan-300" : "bg-white/20"
                    }`}
                  />
                  {index !== timeline.length - 1 ? (
                    <div className="h-full w-px bg-white/10" />
                  ) : null}
                </div>
                <div className="pb-4">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-white/50">
                    {step.time ? new Date(step.time).toLocaleString() : "Pending"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
            <p>
              <span className="text-white/45">Method:</span>{" "}
              {order.paymentMethodName || "—"}
            </p>
            <p className="mt-2">
              <span className="text-white/45">Amount:</span> {order.amount} DH
            </p>
            <p className="mt-2">
              <span className="text-white/45">GoSport:</span> {order.gosportUsername}
            </p>
          </div>

          {order.suspiciousFlags?.length ? (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              Suspicious flags: {order.suspiciousFlags.join(", ")}
            </div>
          ) : null}

          {order.status === "agent_approved_waiting_player" ? (
            <PrimaryButton onClick={confirmOrder} disabled={busy} className="mt-6 w-full">
              {busy ? "Processing..." : "Confirm recharge received"}
            </PrimaryButton>
          ) : null}
        </GlassCard>

        <GlassCard className="p-6">
          {order.proofUrl ? (
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
              <Image
                src={order.proofUrl}
                alt="Proof"
                width={1200}
                height={800}
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}

          <h2 className="mt-6 text-2xl font-semibold">Conversation</h2>

          <div className="mt-5 space-y-3">
            {order.messages?.length ? (
              order.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`rounded-2xl p-4 ${
                    msg.senderRole === "player"
                      ? "bg-cyan-500/10"
                      : msg.senderRole === "agent"
                      ? "bg-violet-500/10"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold capitalize">{msg.senderRole}</p>
                    <p className="text-xs text-white/35">
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-white/70">{msg.message}</p>
                </div>
              ))
            ) : (
              <p className="text-white/50">No messages yet.</p>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <TextArea
              rows={4}
              placeholder="Write a message..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <PrimaryButton onClick={createMessage} disabled={busy} className="w-full">
              {busy ? "Sending..." : "Send message"}
            </PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}