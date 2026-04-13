"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  CheckCircle2, 
  Circle, 
  CreditCard, 
  Upload, 
  Copy, 
  MessageCircle, 
  AlertCircle,
  Clock,
  ChevronRight
} from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  SidebarShell,
  StatusBadge,
  PrimaryButton,
  TextField,
  DangerButton
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
};

type PaymentMethod = {
  id: string;
  methodName: string;
  accountName: string;
  rib: string;
};

export default function PlayerOrderMapPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.orderId || "");

  const [order, setOrder] = useState<Order | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // جلب بيانات الطلب وبنوك الوكيل
  const loadData = async () => {
    try {
      const saved = localStorage.getItem("mobcash_user");
      const user = JSON.parse(saved || "{}");

      const res = await fetch(`/api/order-messages?orderId=${orderId}`);
      const data = await res.json();
      const orderData = data.order;
      setOrder(orderData);

      if (orderData && orderData.status === "pending_payment") {
        const methodsRes = await fetch(`/api/agent/payment-methods?agentId=${orderData.agentId}`);
        const methodsData = await methodsRes.json();
        setMethods(methodsData.methods || []);
      }
    } catch (error) {
      console.error("Error loading order map:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) loadData();
  }, [orderId]);

  // المرحلة ٢: رفع الإثبات
  const handleUploadProof = async () => {
    if (!selectedMethod || !proofFile) return alert("يرجى اختيار البنك ورفع صورة الوصل");

    setBusy(true);
    try {
      // 1. تحويل الصورة لـ DataURL (أو رفعها لـ Cloudinary إذا كان متاحاً)
      const reader = new FileReader();
      reader.readAsDataURL(proofFile);
      reader.onload = async () => {
        const base64 = reader.result;
        
        const res = await fetch("/api/player/upload-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            orderId: order?.id, 
            proofUrl: base64,
            paymentMethodName: selectedMethod.methodName 
          }),
        });

        if (res.ok) {
          alert("تم إرسال الإثبات بنجاح. في انتظار مراجعة الوكيل.");
          loadData();
        }
      };
    } catch (error) {
      alert("خطأ أثناء الرفع");
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!confirm("هل أنت متأكد من إلغاء هذا الطلب؟")) return;
    setBusy(true);
    try {
      await fetch(`/api/player/cancel-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order?.id })
      });
      router.push("/player/dashboard");
    } finally { setBusy(false); }
  };

  if (loading) return <SidebarShell role="player"><LoadingCard text="جاري تحميل خريطة الطلب..." /></SidebarShell>;
  if (!order) return <SidebarShell role="player"><GlassCard className="p-10 text-center">Order not found.</GlassCard></SidebarShell>;

  // تحديد المرحلة الحالية للخريطة
  const isStep1Done = true; // المبلغ تم إدخاله مسبقاً
  const isStep2Active = order.status === "pending_payment";
  const isStep2Done = ["proof_uploaded", "agent_approved_waiting_player", "completed"].includes(order.status);
  const isStep3Active = order.status === "agent_approved_waiting_player";
  const isStep3Done = order.status === "completed";

  return (
    <SidebarShell role="player">
      <div className="mx-auto max-w-4xl space-y-8">
        
        {/* الخريطة البصرية (Order Map Stepper) */}
        <GlassCard className="p-6">
          <div className="relative flex justify-between">
            {/* الخطوط الواصلة */}
            <div className="absolute top-5 left-0 w-full h-0.5 bg-white/10 -z-0" />
            <div 
              className="absolute top-5 left-0 h-0.5 bg-cyan-500 transition-all duration-500 -z-0" 
              style={{ width: isStep3Done ? '100%' : isStep2Done ? '50%' : '0%' }}
            />

            <MapStep icon={CheckCircle2} label="إدخال المبلغ" active={isStep1Done} done={isStep1Done} />
            <MapStep icon={CreditCard} label="الدفع والوصل" active={isStep2Active || isStep2Done} done={isStep2Done} />
            <MapStep icon={Zap} label="إتمام العملية" active={isStep3Active || isStep3Done} done={isStep3Done} />
          </div>
        </GlassCard>

        {/* محتوى المرحلة الثانية: اختيار البنك ورفع الوصل */}
        {isStep2Active && (
          <GlassCard className="p-6 md:p-8 space-y-6 border-cyan-500/20">
            <div className="flex items-center gap-3 text-cyan-400">
              <Clock size={24} />
              <h2 className="text-xl font-bold">المرحلة الثانية: تحويل المبلغ ورفع الإثبات</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <label className="text-sm font-semibold">اختر بنك الوكيل المفضل:</label>
                <div className="grid gap-3">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethod(m)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                        selectedMethod?.id === m.id 
                        ? "border-cyan-500 bg-cyan-500/10" 
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="font-bold">{m.methodName}</span>
                      <ChevronRight size={16} className={selectedMethod?.id === m.id ? "text-cyan-400" : "opacity-20"} />
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod && (
                <div className="rounded-3xl bg-black/40 p-6 border border-white/10 space-y-4 animate-in fade-in slide-in-from-right-4">
                  <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest">بيانات التحويل</p>
                  <div>
                    <p className="text-[10px] text-white/40">اسم البنك</p>
                    <p className="font-bold">{selectedMethod.methodName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40">الاسم الكامل للوكيل</p>
                    <p className="font-bold">{selectedMethod.accountName}</p>
                  </div>
                  <div className="relative group">
                    <p className="text-[10px] text-white/40">رقم الحساب / RIB</p>
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl mt-1">
                      <p className="font-mono text-sm overflow-hidden text-ellipsis">{selectedMethod.rib}</p>
                      <button onClick={() => {navigator.clipboard.writeText(selectedMethod.rib); alert("تم النسخ");}} className="text-cyan-400">
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedMethod && (
              <div className="pt-6 border-t border-white/10">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Upload size={16} className="text-cyan-400" /> ارفع وصل التحويل (Upload Proof)
                </p>
                <div className="flex flex-col md:flex-row gap-4">
                  <input 
                    type="file" 
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="flex-1 text-sm text-white/40 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-cyan-500 file:text-black cursor-pointer" 
                  />
                  <PrimaryButton 
                    disabled={!proofFile || busy} 
                    onClick={handleUploadProof}
                    className="md:min-w-[200px]"
                  >
                    {busy ? "جاري الإرسال..." : "إرسال للوكيل (Send)"}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {/* حالة الانتظار بعد رفع الوصل */}
        {order.status === "proof_uploaded" && (
          <GlassCard className="p-10 text-center space-y-4 border-yellow-500/20">
            <div className="mx-auto h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 animate-pulse">
              <Clock size={32} />
            </div>
            <h3 className="text-xl font-bold">في انتظار مراجعة الوكيل...</h3>
            <p className="text-white/60 max-w-md mx-auto">
              لقد قمت برفع الوصل بنجاح. سيقوم الوكيل بالتحقق من رصيده وتفعيل طلبك خلال دقائق.
            </p>
          </GlassCard>
        )}

        {/* المرحلة الأخيرة: استلام الشحن */}
        {isStep3Active && (
          <GlassCard className="p-8 text-center space-y-6 border-emerald-500/20">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-emerald-400">قام الوكيل بشحن حسابك!</h3>
              <p className="mt-2 text-white/60">يرجى التأكد من وصول الرصيد في تطبيق GoSport365 ثم اضغط على الزر أدناه.</p>
            </div>
            <PrimaryButton onClick={() => loadData()} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500">
              تم إتمام العملية بنجاح ✅
            </PrimaryButton>
          </GlassCard>
        )}

        {/* أزرار المساعدة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => router.push(`/player/chat?orderId=${order.id}`)} className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 p-4 text-sm font-semibold hover:bg-white/10 transition">
            <MessageCircle size={18} /> Chat
          </button>
          <button className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 p-4 text-sm font-semibold hover:bg-white/10 transition">
            <Phone size={18} /> WhatsApp
          </button>
          {!isStep3Done && order.status !== "cancelled" && (
            <button onClick={cancelOrder} className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition">
              Cancel Order
            </button>
          )}
          <button className="rounded-2xl bg-white/5 p-4 text-sm font-semibold opacity-40 cursor-not-allowed">
            <AlertCircle size={18} className="inline mr-2" /> Report
          </button>
        </div>
      </div>
    </SidebarShell>
  );
}

// مكون مساعد لرسم خطوات الخريطة
function MapStep({ icon: Icon, label, active, done }: { icon: any, label: string, active: boolean, done: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
        done ? "bg-cyan-500 border-cyan-500 text-black" : 
        active ? "bg-[#0B0F19] border-cyan-500 text-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]" : 
        "bg-[#0B0F19] border-white/10 text-white/20"
      }`}>
        <Icon size={20} />
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-cyan-400" : "text-white/20"}`}>
        {label}
      </span>
    </div>
  );
}