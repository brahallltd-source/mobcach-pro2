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
  amount: number;
  status: string;
  payment_method_name?: string;
  gosport365_username?: string;
  proof_url?: string | null;
  review_reason?: string | null;
  messages?: Msg[];
};

export default function PlayerChatThreadPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(
      `/api/order-messages?orderId=${encodeURIComponent(String(params.orderId))}`,
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
          senderRole: "player",
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

  const finalApprove = async () => {
    try {
      setBusy(true);

      const res = await fetch("/api/player/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: String(params.orderId) }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to confirm");
        return;
      }

      await load();
      alert(data.message || "Order completed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="Loading order chat..." />
      </SidebarShell>
    );
  }

  if (!order) {
    return (
      <SidebarShell role="player">
        <GlassCard className="p-10 text-center">Order not found.</GlassCard>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <PageHeader
        title={`Order ${order.id}`}
        subtitle="Review your submitted proof, keep chatting with your agent and complete the final approval after the agent validates your recharge."
      />

      <div className="space-y-6">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Order proof</h2>

          <div className="mt-5 grid gap-3 text-sm text-white/65">
            <p>
              Amount:{" "}
              <span className="font-semibold text-white">{order.amount} DH</span>
            </p>
            <p>
              Status:{" "}
              <span className="font-semibold text-white">{order.status}</span>
            </p>
            <p>
              Payment method:{" "}
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

          {order.proof_url ? (
            <div className="mt-6 space-y-4">
              <img
                src={order.proof_url}
                alt="Proof"
                className="max-h-[520px] w-full rounded-3xl border border-white/10 object-contain"
              />

              <div className="flex flex-wrap gap-3">
                <a
                  href={order.proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
                >
                  Open proof
                </a>

                {order.status === "agent_approved_waiting_player" ? (
                  <PrimaryButton onClick={finalApprove} disabled={busy}>
                    {busy ? "Processing..." : "Final approve"}
                  </PrimaryButton>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/55">
              No proof uploaded yet.
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Chat with agent</h2>

          <div className="mt-5 space-y-3">
            {(order.messages || []).map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm ${
                  msg.senderRole === "player"
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
              placeholder="Write your message to the agent..."
            />

            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={send} disabled={busy}>
                {busy ? "Sending..." : "Send message"}
              </PrimaryButton>

              {order.status === "agent_approved_waiting_player" ? (
                <PrimaryButton onClick={finalApprove} disabled={busy}>
                  {busy ? "Processing..." : "Final approve"}
                </PrimaryButton>
              ) : null}
            </div>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}