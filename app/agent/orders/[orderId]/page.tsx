"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, ShieldCheck, ExternalLink, Info, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
  LoadingCard,
} from "@/components/ui";

export default function AgentOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [agentData, setAgentData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return;
    const user = JSON.parse(saved);

    try {
      const [orderRes, profileRes] = await Promise.all([
        fetch(`/api/agent/orders?email=${encodeURIComponent(user.email)}&orderId=${params.orderId}`),
        fetch(`/api/agent/profile?email=${encodeURIComponent(user.email)}`)
      ]);
      
      const oData = await orderRes.json();
      const pData = await profileRes.json();
      
      setOrder(oData.order || null);
      setAgentData(pData.profile || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000); // تحديث تلقائي للمحادثة كل 5 ثوانٍ
    return () => clearInterval(timer);
  }, [params.orderId]);

  const postAction = async (url: string, body: any) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { await load(); setMessage(""); }
    } finally { setBusy(false); }
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading..." /></SidebarShell>;
  if (!order) return <SidebarShell role="agent"><GlassCard className="p-10">Order not found.</GlassCard></SidebarShell>;

  // منطق التحقق من الرصيد
  const hasEnoughBalance = (agentData?.available_balance || 0) >= order.amount;
  const adminWhatsApp = "212600000000"; // ضع رقم واتساب الإدارة هنا

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`Review Order • ${order.id.split('-')[0]}`}
        subtitle="Verify receipt and release funds."
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="p-6 space-y-5">
          
          {/* تنبيه نقص الرصيد */}
          {!hasEnoughBalance && order.status === "proof_uploaded" && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-center gap-3 text-red-200 mb-3">
                <AlertTriangle size={20} />
                <p className="text-sm font-bold">عذراً! رصيدك الحالي ({agentData?.available_balance} DH) لا يكفي.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/agent/recharge" className="flex-1">
                  <PrimaryButton className="w-full bg-amber-500 text-black py-2">شحن رصيدي</PrimaryButton>
                </Link>
                <a href={`https://wa.me/${adminWhatsApp}`} target="_blank" className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold transition hover:bg-green-500">
                  <Phone size={14} /> دعم واتساب
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-xs opacity-50">PLAYER</p>
              <p className="font-bold text-cyan-400">{order.gosportUsername}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-xs opacity-50">AMOUNT</p>
              <p className="text-xl font-bold">{order.amount} DH</p>
            </div>
          </div>

          {order.proofUrl && (
            <div className="rounded-3xl border border-white/10 overflow-hidden">
              <img src={order.proofUrl} alt="Proof" className="w-full object-contain max-h-[400px]" />
            </div>
          )}

          <div className="flex gap-3">
            {order.status === "proof_uploaded" && (
              <PrimaryButton 
                disabled={!hasEnoughBalance || busy} 
                onClick={() => postAction("/api/agent/approve-order", { orderId: order.id })}
                className={`flex-1 py-4 ${!hasEnoughBalance ? "opacity-30" : "bg-emerald-500"}`}
              >
                {hasEnoughBalance ? "Approve Order" : "Insufficient Balance"}
              </PrimaryButton>
            )}
          </div>
        </GlassCard>

        {/* الدردشة المباشرة */}
        <GlassCard className="p-6 flex flex-col">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MessageCircle size={20} className="text-cyan-400" /> Chat with Player
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-2">
            {order.messages?.map((m: any, i: number) => (
              <div key={i} className={`p-3 rounded-2xl text-sm max-w-[80%] ${m.senderRole === 'agent' ? 'ml-auto bg-cyan-500/20' : 'bg-white/5'}`}>
                <p className="text-[10px] opacity-30 mb-1">{m.senderRole.toUpperCase()}</p>
                <p>{m.message}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <TextArea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type here..." className="py-2" />
            <PrimaryButton onClick={() => postAction("/api/order-messages", { orderId: order.id, senderRole: "agent", message })} disabled={busy || !message.trim()}>Send</PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}