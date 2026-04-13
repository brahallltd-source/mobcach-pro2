"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, CreditCard, Upload, Copy, MessageCircle, 
  AlertCircle, Clock, ChevronRight, Zap, Phone, Info
} from "lucide-react";
import {
  GlassCard, 
  LoadingCard, 
  SidebarShell, 
  PrimaryButton, 
  DangerButton, 
  EmptyState // ✅ أضفنا هذا الاستيراد لحل مشكلة الخطأ
} from "@/components/ui";

type Order = {
  id: string;
  amount: number;
  status: string;
  agentId: string;
  paymentMethodName?: string;
  gosportUsername?: string;
  proofUrl?: string;
  createdAt: string;
  agent?: { phone: string; fullName: string }; // أضفنا بيانات الوكيل للواتساب
};

export default function PlayerOrderMapPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/order-messages?orderId=${orderId}`);
      const data = await res.json();
      setOrder(data.order);

      // جلب الحسابات البنكية إذا كان الطلب بانتظار الدفع
      if (data.order?.status === "pending_payment") {
        const methodsRes = await fetch(`/api/agent/payment-methods?agentId=${data.order.agentId}`);
        const methodsData = await methodsRes.json();
        setMethods(methodsData.methods || []);
      }
    } catch (error) { 
      console.error("Fetch Error:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { if (orderId) void loadData(); }, [orderId]);

  const handleUploadProof = async () => {
    if (!selectedMethod || !proofFile || !order) return alert("يرجى اختيار البنك ورفع الوصل");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("orderId", order.id);
      formData.append("paymentMethodName", selectedMethod.methodName);

      const res = await fetch("/api/player/upload-proof", { method: "POST", body: formData });
      if (res.ok) { 
        alert("تم الإرسال بنجاح!"); 
        await loadData(); 
      }
    } catch { 
      alert("خطأ في الرفع"); 
    } finally { 
      setBusy(false); 
    }
  };

  if (loading) return <SidebarShell role="player"><LoadingCard text="تحميل الخريطة..." /></SidebarShell>;
  
  // ✅ حل مشكلة EmptyState: تأكد أنه معرف في @/components/ui
  if (!order) return (
    <SidebarShell role="player">
      <EmptyState title="الطلب غير موجود" subtitle="تأكد من رقم الطلب أو تواصل مع الدعم" />
    </SidebarShell>
  );

  // منطق مراحل الخريطة (Steps)
  const isStep1Done = true;
  const isStep2Active = order.status === "pending_payment";
  const isStep2Done = ["proof_uploaded", "agent_approved_waiting_player", "completed"].includes(order.status);
  const isStep3Active = order.status === "agent_approved_waiting_player";
  const isStep3Done = order.status === "completed";
  const isFlagged = order.status === "flagged"; // حالة الفلاج (التنبيه)

  return (
    <SidebarShell role="player">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* الخريطة البصرية (Progress Map) */}
        <GlassCard className="p-6">
          <div className="relative flex justify-between items-center">
            <div className="absolute top-5 left-[12%] right-[12%] h-0.5 bg-white/10 -z-0" />
            <div 
              className="absolute top-5 left-[12%] h-0.5 bg-cyan-500 transition-all duration-1000 -z-0" 
              style={{ width: isStep3Done ? '76%' : isStep2Done ? '38%' : '0%' }}
            />
            <MapStep icon={CheckCircle2} label="المبلغ" active={true} done={isStep1Done} />
            <MapStep icon={CreditCard} label="الدفع والوصل" active={isStep2Active || isStep2Done} done={isStep2Done} />
            <MapStep icon={Zap} label="إتمام العملية" active={isStep3Active || isStep3Done} done={isStep3Done} />
          </div>
        </GlassCard>

        {/* المرحلة ٢: اختيار البنك والرفع */}
        {isStep2Active && (
          <GlassCard className="p-6 md:p-8 space-y-6 border-cyan-500/20 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-cyan-400">
              <Info size={24} />
              <h2 className="text-xl font-bold">المرحلة الثانية: بيانات الدفع</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <p className="text-sm font-semibold opacity-70">اختر حساب الوكيل البنكي:</p>
                <div className="grid gap-3">
                  {methods.map((m) => (
                    <button key={m.id} onClick={() => setSelectedMethod(m)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition ${selectedMethod?.id === m.id ? "border-cyan-500 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}
                    >
                      <span className="font-bold">{m.methodName}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod && (
                <div className="rounded-3xl bg-black/40 p-6 border border-white/10 space-y-4 shadow-2xl animate-in slide-in-from-right-4">
                  <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">بيانات التحويل</p>
                  <div><p className="text-[10px] opacity-40">RIB / رقم الحساب</p>
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl mt-1">
                      <p className="font-mono text-xs overflow-hidden text-ellipsis">{selectedMethod.rib}</p>
                      <Copy size={14} className="text-cyan-400 cursor-pointer" onClick={() => {navigator.clipboard.writeText(selectedMethod.rib); alert("تم النسخ");}} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedMethod && (
              <div className="pt-6 border-t border-white/10 space-y-4">
                <p className="text-sm font-semibold">ارفع صورة وصل التحويل (Screenshot):</p>
                <div className="flex flex-col md:flex-row gap-4">
                  <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="flex-1 text-sm file:bg-cyan-500 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-black file:font-bold cursor-pointer" />
                  <PrimaryButton disabled={!proofFile || busy} onClick={handleUploadProof}>
                    {busy ? "جاري الرفع..." : "إرسال الإثبات للوكيل"}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {/* الحالة: انتظار المراجعة أو الفلاج */}
        {order.status === "proof_uploaded" && (
          <GlassCard className="p-10 text-center space-y-6 border-yellow-500/20">
            <div className="mx-auto h-20 w-20 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center animate-pulse">
              <Clock size={40} />
            </div>
            <h3 className="text-2xl font-bold">جاري التحقق من التحويل...</h3>
            <p className="text-white/50">سيقوم الوكيل بمراجعة الوصل وشحن حسابك فوراً.</p>
          </GlassCard>
        )}

        {/* المرحلة ٣: الإتمام والنجاح */}
        {isStep3Active && (
          <GlassCard className="p-10 text-center space-y-6 border-emerald-500/20">
            <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-bold">قام الوكيل بشحن حسابك!</h3>
            <PrimaryButton className="w-full bg-emerald-600 hover:bg-emerald-500 py-4" onClick={() => router.push("/player/dashboard")}>
              تم إتمام العملية ✅
            </PrimaryButton>
          </GlassCard>
        )}

        {/* أزرار الدعم والتواصل */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button onClick={() => router.push(`/player/chat?orderId=${order.id}`)} className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 p-4 hover:bg-white/10 transition">
            <MessageCircle size={18} /> Chat
          </button>
          {/* ✅ واتساب ديناميكي باستخدام رقم الوكيل من الطلب */}
          <a href={`https://wa.me/${order.agent?.phone}`} target="_blank" className="flex items-center justify-center gap-2 rounded-2xl bg-green-500/10 p-4 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition">
            <Phone size={18} /> WhatsApp
          </a>
          {!isStep3Done && (
            <DangerButton onClick={() => {/* دالة الإلغاء */}}>إلغاء الطلب</DangerButton>
          )}
        </div>
      </div>
    </SidebarShell>
  );
}

// مكون المرحلة الصغيرة داخل الخريطة
function MapStep({ icon: Icon, label, active, done }: any) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className={`h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all duration-700 ${
        done ? "bg-cyan-500 border-cyan-500 text-black" : 
        active ? "border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] bg-[#0B0F19]" : 
        "border-white/10 text-white/20 bg-[#0B0F19]"
      }`}>
        <Icon size={24} />
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? "text-cyan-400" : "text-white/20"}`}>
        {label}
      </span>
    </div>
  );
}