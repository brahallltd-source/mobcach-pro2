"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MessageCircle, Zap, ArrowRight, User, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/language";
import { 
  GlassCard, 
  LoadingCard, 
  PageHeader, 
  PrimaryButton, 
  SidebarShell, 
  TextField 
} from "@/components/ui";

type AgentData = { 
  id: string; 
  fullName: string; 
  phone: string; 
  availableBalance: number; 
  balance?: number; // حقل احتياطي
};

export default function AchatStepOnePage() {
  const { t } = useLanguage();
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    username: "",
    confirmUsername: "",
  });

  const loadAgent = async () => {
    try {
      // نستخدم timestamp لمنع المتصفح من عرض بيانات قديمة (Cache)
      const res = await fetch(`/api/agent/public-profile?agentId=${params.agentId}&t=${Date.now()}`);
      const data = await res.json();
      
      if (!res.ok || !data.agent) {
        throw new Error(data.message || "Agent not found");
      }

      // ✅ إصلاح ذكي: التأكد من قراءة الرصيد سواء كان اسمه balance أو availableBalance
      const normalizedAgent = {
        ...data.agent,
        availableBalance: data.agent.availableBalance ?? data.agent.balance ?? 0
      };

      setAgent(normalizedAgent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.agentId) loadAgent();
    
    // تحديث تلقائي كل 10 ثوانٍ لضمان دقة الرصيد المتاح
    const interval = setInterval(loadAgent, 10000);
    return () => clearInterval(interval);
  }, [params.agentId]);

  const numericAmount = Number(form.amount || 0);
  const agentMax = agent?.availableBalance || 0;

  // التحقق من القيود (10 DH إلى Agent Balance Max)
  const validationError = useMemo(() => {
    if (!form.amount) return null;
    if (numericAmount < 10) return "الحد الأدنى هو 10 دراهم";
    if (numericAmount > agentMax) return `المبلغ يتجاوز رصيد الوكيل المتاح (${agentMax} DH)`;
    return null;
  }, [numericAmount, agentMax]);

  const handleNextStep = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return router.push("/login");
    const user = JSON.parse(saved);

    if (validationError || !form.amount || !form.username) return;
    if (form.username !== form.confirmUsername) {
      return alert("أسماء المستخدمين غير متطابقة.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerEmail: user.email,
          agentId: agent?.id,
          amount: numericAmount,
          gosportUsername: form.username,
          currentStep: 2,
          status: "pending_payment", 
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      router.push(`/player/orders/${data.order.id}`);
    } catch (error: any) {
      alert(error.message || "فشل في إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SidebarShell role="player"><LoadingCard text="جاري جلب بيانات الوكيل..." /></SidebarShell>;
  
  if (error || !agent) return (
    <SidebarShell role="player">
      <GlassCard className="p-10 text-center flex flex-col items-center gap-4">
        <AlertCircle size={48} className="text-red-500" />
        <h2 className="text-xl font-bold">بيانات الوكيل غير موجودة</h2>
        <p className="text-white/50 text-sm">تأكد من الرابط أو تواصل مع الدعم الفني.</p>
        <PrimaryButton onClick={() => router.push("/player/dashboard")}>العودة للرئيسية</PrimaryButton>
      </GlassCard>
    </SidebarShell>
  );

  return (
    <SidebarShell role="player">
      <PageHeader title="طلب شحن جديد" subtitle="المرحلة الأولى: إدخال القيمة وبيانات الحساب" />

      <div className="mx-auto max-w-4xl mt-6">
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-white/70 block mb-2">مبلغ الشحن (DH)</label>
                <TextField 
                  type="number" 
                  placeholder="أدخل المبلغ (Min: 10 DH)"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className={validationError ? "border-red-500/50 text-red-400" : ""}
                />
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[11px] text-white/40">المتاح لدى الوكيل: <b className="text-emerald-400">{agentMax} DH</b></span>
                  {validationError && <span className="text-[11px] text-red-400 font-bold">{validationError}</span>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-white/70 block mb-2">GoSport365 Username</label>
                  <TextField 
                    placeholder="اسم المستخدم"
                    value={form.username}
                    onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/70 block mb-2">Confirm Username</label>
                  <TextField 
                    placeholder="تأكيد اسم المستخدم"
                    value={form.confirmUsername}
                    onChange={(e) => setForm(prev => ({ ...prev, confirmUsername: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <PrimaryButton 
              onClick={handleNextStep} 
              disabled={submitting || !!validationError || !form.amount || !form.username}
              className={`w-full py-4 text-base font-bold flex items-center justify-center gap-2 ${!!validationError ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {submitting ? "جاري المعالجة..." : "تأكيد والانتقال للدفع"}
              <ArrowRight size={18} />
            </PrimaryButton>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="p-6 border-cyan-500/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400"><User size={20} /></div>
                <div>
                  <p className="text-xs text-white/50 leading-none">وكيلك المعتمد</p>
                  <h3 className="text-lg font-bold">{agent.fullName}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 p-3 border border-white/5 text-center">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider">Agent Balance Max</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">{agentMax} DH</p>
                </div>

                <div className="pt-2">
                  <p className="text-xs font-semibold mb-3 text-white/60">تريد مبلغا أكبر من المتاح؟</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`https://wa.me/${agent.phone}`} target="_blank" className="flex flex-col items-center p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition">
                      <Zap size={20} /><span className="text-[10px] font-bold mt-1">WhatsApp</span>
                    </a>
                    <button onClick={() => router.push(`/player/chat?agentId=${agent.id}`)} className="flex flex-col items-center p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition">
                      <MessageCircle size={20} /><span className="text-[10px] font-bold mt-1">Live Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}