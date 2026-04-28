"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Flag, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { GlassCard, LoadingCard, SidebarShell, TextArea } from "@/components/ui";

type Order = {
  id: string;
  amount: number;
  status: string;
  agentId: string;
  paymentMethodName?: string | null;
  gosportUsername?: string | null;
  proofUrl?: string | null;
  createdAt?: string;
  agent?: { fullName?: string; phone?: string };
};

export default function PlayerOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState<"like" | "dislike" | null>("like");
  const [comment, setComment] = useState("تم التأكد من وصول الرصيد بنجاح.");
  const [flagReason, setFlagReason] = useState("");

  const load = async () => {
    const res = await fetch(`/api/order-messages?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Order not found");
    setOrder(data.order || null);
  };

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر تحميل الطلب");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const closeOrder = async () => {
    if (!order) return;
    if (!rating) {
      toast.error("اختر تقييم العملية أولاً");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/player/close-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          action: "confirm",
          rating,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل إغلاق الطلب");
      toast.success("تم إغلاق الطلب بنجاح");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إغلاق الطلب");
    } finally {
      setBusy(false);
    }
  };

  const flagOrder = async () => {
    if (!order) return;
    if (flagReason.trim().length < 5) {
      toast.error("اكتب سبب المشكلة (5 أحرف على الأقل)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/player/close-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          action: "flag",
          reason: flagReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل رفع البلاغ");
      toast.success("تم تحويل الطلب للمراجعة");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر رفع البلاغ");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="جاري تحميل الطلب..." />
      </SidebarShell>
    );
  }
  if (!order) {
    return (
      <SidebarShell role="player">
        <GlassCard className="p-8 text-center text-white/70">الطلب غير موجود</GlassCard>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="player">
      <div className="mx-auto max-w-3xl space-y-5">
        <GlassCard className="space-y-3 p-6">
          <p className="text-xs uppercase tracking-wide text-white/50">Order</p>
          <p className="text-lg font-semibold text-white">#{order.id.slice(0, 8)}</p>
          <p className="text-white/80">Amount: {order.amount} DH</p>
          <p className="text-white/60">Status: {order.status}</p>
          {order.proofUrl ? (
            <img src={order.proofUrl} alt="Payment proof" className="max-h-[420px] w-full rounded-2xl border border-white/10 object-contain" />
          ) : null}
        </GlassCard>

        {order.status === "agent_approved_waiting_player" ? (
          <GlassCard className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-white">تحقق من الرصيد على GoSport365 ثم أغلق الطلب</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRating("like")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${rating === "like" ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : "border-white/15 text-white/70"}`}
              >
                <ThumbsUp className="mr-2 inline h-4 w-4" /> Like
              </button>
              <button
                type="button"
                onClick={() => setRating("dislike")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${rating === "dislike" ? "border-rose-400 bg-rose-500/15 text-rose-100" : "border-white/15 text-white/70"}`}
              >
                <ThumbsDown className="mr-2 inline h-4 w-4" /> Dislike
              </button>
            </div>
            <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تعليق اختياري..." className="min-h-[110px]" />
            <button
              type="button"
              disabled={busy}
              onClick={() => void closeOrder()}
              className="w-full rounded-full bg-emerald-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
            >
              <CheckCircle2 className="mr-2 inline h-4 w-4" /> Confirm & Close
            </button>

            <div className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
              <p className="text-sm font-semibold text-rose-100">Issue Path (Flag)</p>
              <TextArea value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="اشرح المشكلة..." className="min-h-[100px]" />
              <button
                type="button"
                disabled={busy}
                onClick={() => void flagOrder()}
                className="w-full rounded-full border border-rose-400/40 bg-rose-500/20 px-5 py-3 font-bold text-rose-100 disabled:opacity-50"
              >
                <Flag className="mr-2 inline h-4 w-4" /> Flag
              </button>
            </div>
          </GlassCard>
        ) : null}

        {order.status === "completed" ? (
          <GlassCard className="p-6 text-center text-emerald-200">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8" />
            تم إكمال الطلب بنجاح.
          </GlassCard>
        ) : null}

        {order.status === "flagged_for_review" ? (
          <GlassCard className="p-6 text-center text-rose-200">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
            تم رفع الطلب للمراجعة من طرف الإدارة.
          </GlassCard>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push(`/player/chat?orderId=${order.id}`)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            <MessageCircle className="mr-2 inline h-4 w-4" /> محادثة
          </button>
          <button onClick={() => router.push("/player/orders")} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            رجوع للطلبات
          </button>
        </div>
      </div>
    </SidebarShell>
  );
}