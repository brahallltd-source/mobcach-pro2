"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, MessageCircle, Phone, XCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
  LoadingCard,
  DangerButton,
} from "@/components/ui";

export default function AgentOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [agentData, setAgentData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return;
    const user = JSON.parse(saved);

    try {
      const [orderRes, profileRes] = await Promise.all([
        fetch(`/api/order-messages?orderId=${params.orderId}`),
        fetch(`/api/agent/wallet?agentId=${user.agentId}`)
      ]);
      
      const oData = await orderRes.json();
      const pData = await profileRes.json();
      
      setOrder(oData.order || null);
      setAgentData(pData.wallet || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000); 
    return () => clearInterval(timer);
  }, [params.orderId]);

  // ✅ تعريف دالة postAction المفقودة
  const postAction = async (url: string, body: any) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { 
        await load(); 
        setMessage(""); 
      } else {
        const err = await res.json();
        alert(err.message || "Action failed");
      }
    } catch (error) {
      alert("Network error");
    } finally { setBusy(false); }
  };

  // ✅ تعريف دالة إرسال الرسائل
  const handleSendMessage = () => {
    if (!message.trim()) return;
    postAction("/api/order-messages", { 
      orderId: order.id, 
      senderRole: "agent", 
      message: message 
    });
  };

  // ✅ دالة الإلغاء
  const handleReject = async () => {
    if (!cancelReason.trim()) return alert("يرجى كتابة سبب الإلغاء");
    setBusy(true);
    try {
      const res = await fetch("/api/agent/reject-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orderId: order.id, 
          reason: cancelReason 
        }),
      });
      if (res.ok) {
        alert("تم إلغاء الطلب وإرسال السبب للاعب.");
        router.push("/agent/orders");
      }
    } finally { setBusy(false); }
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading..." /></SidebarShell>;
  if (!order) return <SidebarShell role="agent"><GlassCard className="p-10 text-center">Order not found.</GlassCard></SidebarShell>;

  const hasEnoughBalance = (agentData?.balance || 0) >= order.amount;

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={`Review Order`}
        subtitle={`ID: ${order.id.split('-')[0]}`}
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-6">
          <GlassCard className="p-6">
            <h3 className="mb-4 text-lg font-bold border-b border-white/10 pb-2">Order Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs opacity-50">PLAYER USERNAME</p>
                <p className="font-bold text-cyan-400">{order.gosportUsername}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs opacity-50">AMOUNT</p>
                <p className="text-xl font-bold">{order.amount} DH</p>
              </div>
            </div>

            {order.proofUrl && (
              <div className="mt-6 rounded-3xl border border-white/10 overflow-hidden">
                <p className="p-3 text-xs bg-white/5 font-semibold">PAYMENT PROOF (وصل التحويل)</p>
                <img src={order.proofUrl} alt="Proof" className="w-full object-contain max-h-[500px]" />
              </div>
            )}

            {order.status === "proof_uploaded" && (
              <div className="mt-8 flex flex-col gap-3">
                {!hasEnoughBalance && (
                  <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex gap-3">
                    <AlertTriangle size={24} />
                    <p>رصيدك الحالي ({agentData?.balance} DH) غير كافٍ. يرجى شحن حسابك أولاً.</p>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <PrimaryButton 
                    disabled={!hasEnoughBalance || busy} 
                    onClick={() => postAction("/api/agent/approve-order", { orderId: order.id })}
                    className={`flex-1 py-4 flex items-center justify-center gap-2 ${!hasEnoughBalance ? "opacity-30 grayscale" : "bg-emerald-600 hover:bg-emerald-500"}`}
                  >
                    <CheckCircle size={18} /> Approve & Release
                  </PrimaryButton>
                  
                  <DangerButton onClick={() => setShowCancelModal(true)} className="px-8">
                    <XCircle size={18} /> Reject
                  </DangerButton>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        <GlassCard className="p-6 flex flex-col h-[600px]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyan-400">
            <MessageCircle size={20} /> Live Chat
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto pr-2">
            {order.messages?.map((m: any, i: number) => (
              <div key={i} className={`p-3 rounded-2xl text-sm max-w-[85%] ${m.senderRole === 'agent' ? 'ml-auto bg-cyan-500/20 border border-cyan-500/20' : 'bg-white/10 border border-white/10'}`}>
                <p className={`text-[9px] font-bold mb-1 uppercase ${m.senderRole === 'agent' ? 'text-cyan-300' : 'text-white/40'}`}>{m.senderRole}</p>
                <p className="leading-relaxed">{m.message}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
            <TextArea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message..." className="min-h-[45px] py-2" />
            <PrimaryButton onClick={handleSendMessage} disabled={busy || !message.trim()}>Send</PrimaryButton>
          </div>
        </GlassCard>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4 text-red-400">إلغاء الطلب</h3>
            <p className="text-sm text-white/60 mb-4">اكتب السبب (سيرسل للاعب):</p>
            <TextArea 
              rows={4} 
              placeholder="مثال: الوصل غير واضح..." 
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div className="mt-6 flex gap-3">
              <DangerButton onClick={handleReject} disabled={busy} className="flex-1">تأكيد الإلغاء</DangerButton>
              <button onClick={() => setShowCancelModal(false)} className="flex-1 rounded-2xl bg-white/5 py-3 font-semibold">تراجع</button>
            </div>
          </GlassCard>
        </div>
      )}
    </SidebarShell>
  );
}