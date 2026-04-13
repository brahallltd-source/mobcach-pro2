"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MessageCircle, Zap, Info, ArrowRight, ShieldCheck, User } from "lucide-react";
import { useLanguage } from "@/components/language";
import { 
  GlassCard, 
  LoadingCard, 
  PageHeader, 
  PrimaryButton, 
  SidebarShell, 
  TextField 
} from "@/components/ui";

type CurrentUser = { 
  id: string; 
  email: string; 
  role: string; 
  assigned_agent_id?: string 
};

type AgentData = { 
  id: string; 
  fullName: string; 
  phone: string; // للمستخدم في واتساب
  availableBalance: number; 
  minLimit: number;
};

export default function AchatStepOnePage() {
  const { t } = useLanguage();
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    username: "",
    confirmUsername: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current = JSON.parse(saved);
    setUser(current);

    // جلب بيانات الوكيل ورصيده الحالي (الـ Max)
    fetch(`/api/agent/public-profile?agentId=${params.agentId}`)
      .then((res) => res.json())
      .then((data) => {
        setAgent(data.agent);
      })
      .finally(() => setLoading(false));
  }, [params.agentId]);

  const numericAmount = Number(form.amount || 0);
  const agentMax = agent?.availableBalance || 0;

  // التحقق من القيود (10 DH إلى Agent Balance)
  const validationError = useMemo(() => {
    if (!form.amount) return null;
    if (numericAmount < 10) return "Minimum amount is 10 DH";
    if (numericAmount > agentMax) return `Amount exceeds agent's current liquid balance (${agentMax} DH)`;
    return null;
  }, [numericAmount, agentMax]);

  const handleNextStep = async () => {
    if (!user || !agent) return;
    if (validationError || !form.amount || !form.username) {
      return alert("Please check the amount and username fields.");
    }
    if (form.username !== form.confirmUsername) {
      return alert("GoSport365 usernames do not match.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerEmail: user.email,
          agentId: agent.id,
          amount: numericAmount,
          gosportUsername: form.username,
          status: "pending_payment", // بداية الخريطة
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // الانتقال للمرحلة الثانية (خريطة الطلب)
      router.push(`/player/orders/${data.order.id}`);
    } catch (error: any) {
      alert(error.message || "Failed to initiate order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SidebarShell role="player"><LoadingCard text="Fetching agent availability..." /></SidebarShell>;
  if (!agent) return <SidebarShell role="player"><GlassCard className="p-10 text-center">Agent data not found.</GlassCard></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader
        title="New Recharge Request"
        subtitle="Step 1: Enter value and account details"
      />

      <div className="mx-auto max-w-4xl mt-6">
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          
          {/* نموذج إدخال البيانات */}
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-white/70 block mb-2">Recharge Amount (DH)</label>
                <TextField 
                  type="number" 
                  placeholder="Enter value (Min: 10 DH)"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className={validationError ? "border-red-500/50" : ""}
                />
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[11px] text-white/40">Range: 10 DH - {agentMax} DH</span>
                  {validationError && <span className="text-[11px] text-red-400 font-bold">{validationError}</span>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-white/70 block mb-2">GoSport365 Username</label>
                  <TextField 
                    placeholder="Enter username"
                    value={form.username}
                    onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/70 block mb-2">Confirm Username</label>
                  <TextField 
                    placeholder="Repeat username"
                    value={form.confirmUsername}
                    onChange={(e) => setForm(prev => ({ ...prev, confirmUsername: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <PrimaryButton 
              onClick={handleNextStep} 
              disabled={submitting || !!validationError || !form.amount || !form.username}
              className="w-full py-4 text-base font-bold flex items-center justify-center gap-2"
            >
              {submitting ? "Processing..." : "Confirm & Continue to Payment"}
              <ArrowRight size={18} />
            </PrimaryButton>
          </GlassCard>

          {/* تفاصيل الوكيل والتواصل */}
          <div className="space-y-4">
            <GlassCard className="p-6 border-cyan-500/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs text-white/50 leading-none">Your Agent</p>
                  <h3 className="text-lg font-bold">{agent.fullName}</h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-white/5 p-3 border border-white/5">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider">Agent Balance Max</p>
                  <p className="text-xl font-mono font-bold text-emerald-400">{agentMax} DH</p>
                </div>

                <div className="pt-2">
                  <p className="text-sm font-semibold mb-3">Need a higher amount?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={`https://wa.me/${agent.phone}`}
                      target="_blank"
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition"
                    >
                      <Zap size={20} />
                      <span className="text-[10px] font-bold">WhatsApp</span>
                    </a>
                    <button 
                      onClick={() => router.push(`/player/chat?agentId=${agent.id}`)}
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition"
                    >
                      <MessageCircle size={20} />
                      <span className="text-[10px] font-bold">Live Chat</span>
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] text-center text-white/30 italic">"Contact your agent for custom limits"</p>
                </div>
              </div>
            </GlassCard>

            <div className="flex items-center gap-2 px-4 text-white/40">
              <ShieldCheck size={14} className="text-emerald-500" />
              <p className="text-[10px]">Secure P2P transaction powered by GoSport365</p>
            </div>
          </div>

        </div>
      </div>
    </SidebarShell>
  );
}