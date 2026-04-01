
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, TextArea } from "@/components/ui";

export default function PlayerChatThreadPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/order-messages?orderId=${encodeURIComponent(String(params.orderId))}`, { cache: "no-store" });
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
    setBusy(true);
    const res = await fetch("/api/order-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: String(params.orderId), senderRole: "player", message }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "Failed to send");
    setMessage("");
    await load();
    setBusy(false);
  };

  const finalApprove = async () => {
    setBusy(true);
    const res = await fetch("/api/player/confirm-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: String(params.orderId) }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to confirm");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
    alert(data.message || "Order completed");
  };

  if (loading) return <SidebarShell role="player"><LoadingCard text="Loading order chat..." /></SidebarShell>;
  if (!order) return <SidebarShell role="player"><GlassCard className="p-10 text-center">Order not found.</GlassCard></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader title={`Order ${order.id}`} subtitle="Keep chatting with your agent and complete the final player approval from this same thread after the agent validates the recharge." />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6 md:p-8">
          <div className="space-y-3">
            {(order.messages || []).map((msg: any, idx: number) => (
              <div key={idx} className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm ${msg.senderRole === "player" ? "ml-auto bg-cyan-400/15 text-white" : "bg-white/5 text-white/80"}`}>
                <p className="font-semibold capitalize text-white/90">{msg.senderRole}</p>
                <p className="mt-1 whitespace-pre-wrap">{msg.message}</p>
                <p className="mt-2 text-[11px] text-white/40">{new Date((msg.created_at || msg.createdAt)).toLocaleString()}</p>
              </div>
            ))}
            {!order.messages?.length ? <div className="text-white/55">No messages yet.</div> : null}
          </div>
          <div className="mt-5 space-y-3">
            <TextArea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message to the agent..." />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={send} disabled={busy}>{busy ? "Sending..." : "Send message"}</PrimaryButton>
              {order.status === "agent_approved_waiting_player" ? <PrimaryButton onClick={finalApprove} disabled={busy}>Final approve</PrimaryButton> : null}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Order summary</h2>
          <div className="mt-5 grid gap-3 text-sm text-white/65">
            <p>Amount: <span className="font-semibold text-white">{order.amount} DH</span></p>
            <p>Status: <span className="font-semibold text-white">{order.status}</span></p>
            <p>Method: <span className="font-semibold text-white">{(order.payment_method_name || order.paymentMethodName) || "—"}</span></p>
            <p>Username: <span className="font-semibold text-white">{order.gosportUsername || "—"}</span></p>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
