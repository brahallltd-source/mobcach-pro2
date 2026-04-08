"use client";

import Image from "next/image";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, SidebarShell, StatusBadge, TextArea } from "@/components/ui";

type Message = { senderRole: string; message: string; createdAt: string };
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

type FeedbackSummary = { positiveRate: number; totalCount: number };

export default function PlayerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackPreset, setFeedbackPreset] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSentiment, setFeedbackSentiment] = useState<"positive" | "negative">("positive");
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);

  const presets = {
    positive: ["Fast payment confirmation", "Helpful and professional agent", "Smooth recharge process", "Clear payment instructions"],
    negative: ["Slow response time", "Payment instructions were unclear", "Needed repeated follow-up", "Experience needs improvement"],
  };

  const loadOrder = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);

    const res = await fetch(`/api/player/orders?email=${encodeURIComponent(user.email)}&orderId=${encodeURIComponent(String(params.orderId || ""))}`, { cache: "no-store" });
    const data = await res.json();
    setOrder(data.order || null);
    return user;
  };

  const loadFeedback = async (agentId?: string) => {
    if (!agentId) return;
    const res = await fetch(`/api/player/order-feedback?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
    const data = await res.json();
    setFeedbackSummary(data.summary || null);
  };

  useEffect(() => {
    loadOrder()
      .then((user) => loadFeedback(order?.agentId || user?.assigned_agent_id))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (order?.agentId) void loadFeedback(order.agentId);
  }, [order?.agentId]);

  const createMessage = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/order-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: params.orderId, senderRole: "player", message: note }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "Failed to send message");
      setNote("");
      await loadOrder();
    } catch {
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
      if (!res.ok) return alert(data.message || "Failed to confirm order");
      alert(data.message || "Order confirmed");
      await loadOrder();
    } catch {
      alert("Network error");
    }
    setBusy(false);
  };

  const submitFeedback = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved || !order) return;
    const user = JSON.parse(saved);
    setFeedbackBusy(true);
    try {
      const res = await fetch("/api/player/order-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          playerEmail: user.email,
          sentiment: feedbackSentiment,
          presetComment: feedbackPreset,
          comment: feedbackComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "Failed to submit feedback");
      alert(data.message || "Feedback submitted");
      setFeedbackPreset("");
      setFeedbackComment("");
      await loadFeedback(order.agentId);
    } catch {
      alert("Network error");
    }
    setFeedbackBusy(false);
  };

  if (loading) return <SidebarShell role="player"><div className="mx-auto max-w-6xl"><GlassCard className="p-12 text-center">Loading order...</GlassCard></div></SidebarShell>;
  if (!order) return <SidebarShell role="player"><div className="mx-auto max-w-6xl"><GlassCard className="p-12 text-center">Order not found.</GlassCard></div></SidebarShell>;

  const timeline = [
    { label: "Order created", active: true, time: order.createdAt },
    { label: "Proof uploaded", active: Boolean(order.proofUploaded), time: order.proofUploadedAt || "" },
    { label: "Agent approved", active: Boolean(order.agentApproved), time: order.agentApprovedAt || "" },
    { label: "Player confirmed", active: Boolean(order.playerApproved), time: order.playerApproved ? order.updatedAt : "" },
    { label: "Feedback", active: Boolean(feedbackSummary?.totalCount), time: Boolean(feedbackSummary?.totalCount) ? order.updatedAt : "" },
  ];

  return (
    <SidebarShell role="player">
      <PageHeader title={`Order ${order.id}`} subtitle="Full lifecycle view with timeline, payment method, proof image, completion confirmation and Binance-style feedback." action={<StatusBadge status={order.status} />} />

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="p-6">
          <h2 className="text-2xl font-semibold">Timeline</h2>
          <div className="mt-6 space-y-4">
            {timeline.map((step, index) => (
              <div key={step.label} className="flex gap-4">
                <div className="flex flex-col items-center"><div className={`h-4 w-4 rounded-full ${step.active ? "bg-cyan-300" : "bg-white/20"}`} />{index !== timeline.length - 1 ? <div className="h-full w-px bg-white/10" /> : null}</div>
                <div className="pb-4"><p className="font-medium">{step.label}</p><p className="text-sm text-white/50">{step.time ? new Date(step.time).toLocaleString() : "Pending"}</p></div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
            <p><span className="text-white/45">Method:</span> {order.paymentMethodName || "—"}</p>
            <p className="mt-2"><span className="text-white/45">Amount:</span> {order.amount} DH</p>
            <p className="mt-2"><span className="text-white/45">GoSport:</span> {order.gosportUsername}</p>
          </div>

          {order.suspiciousFlags?.length ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">Suspicious flags: {order.suspiciousFlags.join(", ")}</div> : null}
          {order.status === "agent_approved_waiting_player" ? <PrimaryButton onClick={confirmOrder} disabled={busy} className="mt-6 w-full">{busy ? "Processing..." : "Confirm recharge received"}</PrimaryButton> : null}

          {order.status === "completed" ? (
            <div className="mt-6 rounded-[26px] border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Rate this order</h3>
                  <p className="mt-1 text-sm text-white/50">Share quick feedback with a preset comment and optional manual note.</p>
                </div>
                {feedbackSummary ? <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{feedbackSummary.positiveRate}% positive • {feedbackSummary.totalCount} total</div> : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setFeedbackSentiment("positive")} className={`rounded-2xl border px-4 py-3 text-left ${feedbackSentiment === "positive" ? "border-emerald-300/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}><div className="flex items-center gap-2 font-semibold"><ThumbsUp size={16} /> Positive</div></button>
                <button onClick={() => setFeedbackSentiment("negative")} className={`rounded-2xl border px-4 py-3 text-left ${feedbackSentiment === "negative" ? "border-rose-300/30 bg-rose-500/10" : "border-white/10 bg-white/5"}`}><div className="flex items-center gap-2 font-semibold"><ThumbsDown size={16} /> Negative</div></button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {presets[feedbackSentiment].map((preset) => (
                  <button key={preset} onClick={() => setFeedbackPreset(preset)} className={`rounded-full border px-3 py-1 text-xs ${feedbackPreset === preset ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-white/70"}`}>{preset}</button>
                ))}
              </div>
              <div className="mt-4"><TextArea rows={4} placeholder="Optional manual comment" value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} /></div>
              <PrimaryButton onClick={submitFeedback} disabled={feedbackBusy} className="mt-4 w-full">{feedbackBusy ? "Submitting..." : "Submit feedback"}</PrimaryButton>
            </div>
          ) : null}
        </GlassCard>

        <GlassCard className="p-6">
          {order.proofUrl ? <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20"><Image src={order.proofUrl} alt="Proof" width={1200} height={800} className="h-auto w-full object-cover" /></div> : null}
          <h2 className="mt-6 text-2xl font-semibold">Conversation</h2>
          <div className="mt-5 space-y-3">
            {order.messages?.length ? order.messages.map((msg, index) => (
              <div key={index} className={`rounded-2xl p-4 ${msg.senderRole === "player" ? "bg-cyan-500/10" : msg.senderRole === "agent" ? "bg-violet-500/10" : "bg-white/5"}`}>
                <div className="flex items-center justify-between gap-3"><p className="font-semibold capitalize">{msg.senderRole}</p><p className="text-xs text-white/35">{new Date(msg.createdAt).toLocaleString()}</p></div>
                <p className="mt-2 text-sm text-white/70">{msg.message}</p>
              </div>
            )) : <p className="text-white/50">No messages yet.</p>}
          </div>
          <div className="mt-5 space-y-3">
            <TextArea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a message to your agent" />
            <PrimaryButton onClick={createMessage} disabled={busy || !note.trim()} className="w-full">{busy ? "Sending..." : "Send message"}</PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
