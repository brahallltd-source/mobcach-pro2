"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
} from "@/components/ui";

type Msg = {
  senderRole: string;
  message: string;
  createdAt: string;
};

type Order = {
  id: string;
  amount: number;
  playerEmail: string;
  gosportUsername: string;
  status: string;
  messages: Msg[];
  reviewReason?: string;
  proofUrl?: string;
  paymentMethodName?: string;
  suspiciousFlags?: string[];
  proofDuplicateDetected?: boolean;
  antiFraudState?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AgentOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);

    const res = await fetch(
      `/api/agent/orders?email=${encodeURIComponent(user.email)}&orderId=${encodeURIComponent(
        String(params.orderId || "")
      )}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    setOrder(data.order || null);
  };

  useEffect(() => {
    load();
  }, []);

  const postAction = async (url: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Action failed");
        setBusy(false);
        return;
      }

      await load();
      alert(data.message || "Updated");
      setMessage("");
    } catch (error) {
      console.error(error);
      alert("Network error");
    }
    setBusy(false);
  };

  const riskScore = useMemo(() => {
    if (!order) return 0;
    return Math.min(
      100,
      (order.reviewReason ? 30 : 0) +
        ((order.suspiciousFlags || []).length * 20) +
        (order.proofDuplicateDetected ? 25 : 0)
    );
  }, [order]);

  if (!order) {
    return (
      <SidebarShell role="agent">
        <div className="mx-auto max-w-6xl">
          <GlassCard className="p-12 text-center">Loading order...</GlassCard>
        </div>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`Proof review • ${order.id}`}
        subtitle="A smarter review panel: inspect proof quality, risk indicators, payment method and chat with the player before approving."
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/45">Player</p>
              <p className="mt-1 text-lg font-semibold">{order.playerEmail}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/45">Username</p>
              <p className="mt-1 text-lg font-semibold">{order.gosportUsername}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/45">Amount</p>
              <p className="mt-1 text-lg font-semibold">{order.amount} DH</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/45">Method</p>
              <p className="mt-1 text-lg font-semibold">{order.paymentMethodName || "—"}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-white/60">
                <ShieldCheck size={16} /> Anti-fraud state
              </div>
              <p className="mt-2 text-xl font-semibold">
                {order.antiFraudState || "basic_pass"}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle size={16} /> Risk score
              </div>
              <p
                className={`mt-2 text-xl font-semibold ${
                  riskScore >= 70
                    ? "text-rose-300"
                    : riskScore >= 40
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                {riskScore}/100
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <Clock3 size={16} /> Updated
              </div>
              <p className="mt-2 text-sm font-medium text-white/75">
                {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

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

          {(order.suspiciousFlags?.length || order.reviewReason) ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              {order.suspiciousFlags?.length ? (
                <p>Suspicious flags: {order.suspiciousFlags.join(", ")}</p>
              ) : null}
              {order.reviewReason ? (
                <p className="mt-2">Review reason: {order.reviewReason}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {order.status === "proof_uploaded" ? (
              <PrimaryButton
                onClick={() => postAction("/api/agent/approve-order", { orderId: order.id })}
                disabled={busy}
              >
                Approve order
              </PrimaryButton>
            ) : null}

            {order.status !== "completed" ? (
              <button
                onClick={() =>
                  postAction("/api/agent/flag-order", {
                    orderId: order.id,
                    reason: "Manual review requested by agent",
                  })
                }
                className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-rose-400"
              >
                Flag for review
              </button>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-2xl font-semibold">Conversation</h2>

          <div className="mt-5 space-y-3">
            {order.messages?.map((item, index) => (
              <div
                key={index}
                className={`rounded-2xl p-4 ${
                  item.senderRole === "agent" ? "bg-cyan-500/10" : "bg-black/20"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold capitalize">{item.senderRole}</p>
                  <p className="text-xs text-white/35">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-2 text-sm text-white/65">{item.message}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <TextArea
              rows={4}
              placeholder="Write a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <PrimaryButton
              onClick={() =>
                postAction("/api/order-messages", {
                  orderId: order.id,
                  senderRole: "agent",
                  message,
                })
              }
              disabled={busy || !message.trim()}
              className="w-full"
            >
              Send message
            </PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}