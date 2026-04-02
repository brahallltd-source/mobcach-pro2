"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
} from "@/components/ui";

type Msg = {
  id?: string;
  senderRole: string;
  message: string;
  created_at?: string;
  createdAt?: string;
};

type OrderShape = {
  id: string;
  playerEmail: string;
  amount: number;
  status: string;
  payment_method_name?: string;
  gosport365_username?: string;
  proof_url?: string | null;
  review_reason?: string | null;
  agent_approved?: boolean;
  player_approved?: boolean;
  messages?: Msg[];
};

export default function AgentChatThreadPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return;

    const user = JSON.parse(saved);
    const email = String(user.email || "").trim();

    const res = await fetch(
      `/api/agent/orders?email=${encodeURIComponent(email)}&orderId=${encodeURIComponent(String(params.orderId))}`,
      { cache: "no-store" }
    );

    const data = await res.json();
    setOrder(data.order || null);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    const timer = setInterval(() => load(), 4000);
    return () => clearInterval(timer);
  }, [params.orderId]);

  const send = async () => {
    if (!message.trim()) return;

    try {
      setBusy(true);

      const res = await fetch("/api/order-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: String(params.orderId),
          senderRole: "agent",
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to send");
        return;
      }

      setMessage("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const updateOrderStatus = async (action: "approve" | "reject") => {
    try {
      setActionBusy(true);

      const saved = localStorage.getItem("mobcash_user");
      if (!saved) {
        alert("Login required");
        return;
      }

      const user = JSON.parse(saved);
      const email = String(user.email || "").trim();

      const reason =
        action === "reject"
          ? window.prompt("Reject reason") || "Rejected by agent"
          : "";

      const res = await fetch("/api/agent/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          orderId: String(params.orderId),
          action,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to update order");
        return;
      }

      await load();
      alert(data.message || "Order updated");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="Loading order chat..." />
      </SidebarShell>
    );
  }

  if (!order) {
    return (
      <SidebarShell role="agent">
        <GlassCard className="p-10 text-center">Order not found.</GlassCard>
      </SidebarShell>
    );
  }

  const canReview =
    order.status === "flagged_for_review" || order.status === "proof_uploaded";

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`Order ${order.id}`}
        subtitle="Keep the chat open, answer the player directly and continue the recharge conversation without leaving the order thread."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6 md:p-8">
          <div className="space-y-3">
            {(order.messages || []).map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm ${
                  msg.senderRole === "agent"
                    ? "ml-auto bg-cyan-400/15 text-white"
                    : "bg-white/5 text-white/80"
                }`}
              >
                <p className="font-semibold capitalize text-white/90">
                  {msg.senderRole}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{msg.message}</p>
                <p className="mt-2 text-[11px] text-white/40">
                  {new Date(msg.created_at || msg.createdAt || "").toLocaleString()}
                </p>
              </div>
            ))}
            {!order.messages?.length ? (
              <div className="text-white/55">No messages yet.</div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            <TextArea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message to the player..."
            />
            <PrimaryButton onClick={send} disabled={busy}>
              {busy ? "Sending..." : "Send message"}
            </PrimaryButton>
          </div>

          {canReview ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryButton
                onClick={() => updateOrderStatus("approve")}
                disabled={actionBusy}
              >
                {actionBusy ? "Processing..." : "Approve order"}
              </PrimaryButton>

              <button
                onClick={() => updateOrderStatus("reject")}
                disabled={actionBusy}
                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {actionBusy ? "Processing..." : "Reject order"}
              </button>
            </div>
          ) : null}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Order summary</h2>
            <div className="mt-5 grid gap-3 text-sm text-white/65">
              <p>
                Player:{" "}
                <span className="font-semibold text-white">{order.playerEmail}</span>
              </p>
              <p>
                Amount:{" "}
                <span className="font-semibold text-white">{order.amount} DH</span>
              </p>
              <p>
                Status:{" "}
                <span className="font-semibold text-white">{order.status}</span>
              </p>
              <p>
                Method:{" "}
                <span className="font-semibold text-white">
                  {order.payment_method_name || "—"}
                </span>
              </p>
              <p>
                Username:{" "}
                <span className="font-semibold text-white">
                  {order.gosport365_username || "—"}
                </span>
              </p>
              {order.review_reason ? (
                <p>
                  Review reason:{" "}
                  <span className="font-semibold text-white">
                    {order.review_reason}
                  </span>
                </p>
              ) : null}
            </div>
          </GlassCard>

          {order.proof_url ? (
            <GlassCard className="p-6 md:p-8">
              <h2 className="text-2xl font-semibold">Proof</h2>
              <div className="mt-5 space-y-4">
                <a
                  href={order.proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
                >
                  Open proof
                </a>

                <img
                  src={order.proof_url}
                  alt="Proof"
                  className="max-h-[460px] w-full rounded-3xl border border-white/10 object-contain"
                />
              </div>
            </GlassCard>
          ) : null}
        </div>
      </div>
    </SidebarShell>
  );
}