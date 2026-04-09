"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, ShieldCheck, ExternalLink, Info } from "lucide-react";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
  LoadingCard,
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
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);

    try {
      const res = await fetch(
        `/api/agent/orders?email=${encodeURIComponent(user.email)}&orderId=${encodeURIComponent(
          String(params.orderId || "")
        )}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setOrder(data.order || null);
    } catch (error) {
      console.error("LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
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
        return;
      }

      await load();
      alert(data.message || "Updated");
      setMessage("");
    } catch (error) {
      console.error(error);
      alert("Network error");
    } finally {
      setBusy(false);
    }
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

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Fetching order details..." /></SidebarShell>;

  if (!order) {
    return (
      <SidebarShell role="agent">
        <div className="mx-auto max-w-6xl">
          <GlassCard className="p-12 text-center">Order not found.</GlassCard>
        </div>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`Review Order • ${order.id.split('-')[0]}`}
        subtitle="Verify the payment proof carefully before releasing the balance to the player's GoSport365 account."
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="space-y-5 p-6">
          
          {/* مرحلة انتظار الدفع - تنبيه للوكيل */}
          {(order.status === "pending_payment" || order.status === "created") && (
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 flex items-start gap-3 text-blue-100">
              <Info className="shrink-0 mt-1" size={18} />
              <p className="text-sm">
                <strong>Player hasn't paid yet.</strong> The order is created, but no proof has been uploaded. Do not release any funds until you see the receipt here.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-white/45 mb-1 uppercase tracking-tighter text-xs">Player Email</p>
              <p className="font-semibold text-white/90">{order.playerEmail}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-white/45 mb-1 uppercase tracking-tighter text-xs">Target Username</p>
              <p className="font-semibold text-cyan-300">{order.gosportUsername}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-white/45 mb-1 uppercase tracking-tighter text-xs">Amount to Recharge</p>
              <p className="text-xl font-bold text-white">{order.amount} DH</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-white/45 mb-1 uppercase tracking-tighter text-xs">Payment Method</p>
              <p className="font-semibold text-white/90">{order.paymentMethodName || "—"}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                <ShieldCheck size={14} /> SECURITY STATE
              </div>
              <p className="font-bold text-sm uppercase">{order.antiFraudState || "Standard"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-amber-300 text-xs mb-2">
                <AlertTriangle size={14} /> RISK LEVEL
              </div>
              <p className={`font-bold text-sm ${riskScore >= 70 ? "text-rose-400" : riskScore >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                {riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW"} ({riskScore}/100)
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-cyan-300 text-xs mb-2">
                <Clock3 size={14} /> CREATED AT
              </div>
              <p className="text-xs font-medium text-white/75">
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : "—"}
              </p>
            </div>
          </div>

          {/* عرض الإثبات مع خيار التكبير */}
          {order.proofUrl ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-semibold text-white/80">Payment Receipt</h3>
                <a href={order.proofUrl} target="_blank" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                  <ExternalLink size={12} /> View full image
                </a>
              </div>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 group relative">
                <Image
                  src={order.proofUrl}
                  alt="Proof"
                  width={1200}
                  height={800}
                  className="h-auto w-full object-contain max-h-[500px] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>
          ) : (
             order.status !== "pending_payment" && <div className="p-10 border-2 border-dashed border-white/5 rounded-3xl text-center text-white/30 text-sm">No proof uploaded yet</div>
          )}

          {/* قسم الأزرار */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {order.status === "proof_uploaded" && (
              <PrimaryButton
                onClick={() => postAction("/api/agent/approve-order", { orderId: order.id })}
                disabled={busy}
                className="flex-1 py-4 font-bold text-lg shadow-lg shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-400"
              >
                Approve & Release Funds
              </PrimaryButton>
            )}

            {order.status !== "completed" && order.status !== "cancelled" && (
              <button
                onClick={() => {
                  const reason = prompt("Enter reason for rejection/flag:");
                  if (reason) postAction("/api/agent/flag-order", { orderId: order.id, reason });
                }}
                disabled={busy}
                className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-6 py-4 text-sm font-bold text-rose-300 transition hover:bg-rose-500/20"
              >
                Reject / Flag Proof
              </button>
            )}
          </div>
        </GlassCard>

        {/* قسم المحادثة */}
        <GlassCard className="p-6 flex flex-col h-full">
          <h2 className="text-2xl font-semibold mb-6">Chat with Player</h2>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {order.messages?.map((item, index) => {
              const isSystem = item.senderRole === "system";
              const isAgent = item.senderRole === "agent";
              
              return (
                <div
                  key={index}
                  className={`rounded-2xl p-4 max-w-[90%] ${
                    isSystem ? "bg-white/5 border border-white/10 mx-auto text-center w-full" : 
                    isAgent ? "bg-cyan-500/20 border border-cyan-500/20 ml-auto" : 
                    "bg-black/40 border border-white/5"
                  }`}
                >
                  {!isSystem && (
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <p className={`text-xs font-bold uppercase tracking-widest ${isAgent ? "text-cyan-400" : "text-white/40"}`}>
                        {isAgent ? "You (Agent)" : "Player"}
                      </p>
                      <p className="text-[10px] text-white/20">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                  <p className={`text-sm ${isSystem ? "text-white/40 italic" : "text-white/80"}`}>{item.message}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-3 pt-6 border-t border-white/5">
            <TextArea
              rows={3}
              placeholder="Type your instructions or questions to the player..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-black/40 border-white/10 focus:border-cyan-500/50"
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
              className="w-full py-3"
            >
              {busy ? "Sending..." : "Send Message"}
            </PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}