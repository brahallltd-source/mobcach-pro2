"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, Star, WalletCards, Zap, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/language";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
  TextField,
} from "@/components/ui";

// ... (نفس الـ Types اللي عندك الفوق) ...

export default function PlayerSelectAgentPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingAgentId, setSelectingAgentId] = useState<string | null>(null);
  
  // الفلاتر
  const [country, setCountry] = useState("Morocco");
  const [method, setMethod] = useState("All");
  const [amount, setAmount] = useState("");
  const [time, setTime] = useState("0");

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current = JSON.parse(saved);
    if (current.role !== "player") return void (window.location.href = "/login");
    
    // إلا كان ديجا عندو وكيل، نصيفطوه للداشبورد نيشان
    if (current.assigned_agent_id || current.assignedAgentId) {
      window.location.href = "/player/dashboard";
      return;
    }
    setUser(current);
  }, []);

  const load = async () => {
    try {
      const query = new URLSearchParams({ country, method, amount, time });
      const res = await fetch(`/api/agents/discovery?${query.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error("Discovery Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [country, method, amount, time]);

  // 🟢 الدالة السحرية لاختيار الوكيل
  const chooseAgent = async (agent: any) => {
    // تحديد الـ ID الصحيح (سواء سميتو id أو agentId)
    const agentId = agent.id || agent.agentId;
    
    if (!user?.email) {
      alert("انتهت الجلسة، المرجو تسجيل الدخول مرة أخرى.");
      window.location.href = "/login";
      return;
    }

    if (!agentId) {
      alert("خطأ: معرف الوكيل غير موجود.");
      return;
    }

    setSelectingAgentId(agentId);

    try {
      const res = await fetch("/api/player/select-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          playerEmail: user.email, 
          agentId: agentId 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "فشل ربط الوكيل");
      }

      // 1. تحديث البيانات فـ localStorage (ضرورية بزاف)
      const updatedUser = { 
        ...user, 
        assigned_agent_id: agentId, 
        assignedAgentId: agentId,
        player_status: "active" 
      };
      localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));

      alert("تم اختيار الوكيل بنجاح! سيتم توجيهك للداشبورد ✅");

      // 2. التوجيه النهائي
      window.location.href = "/player/dashboard";

    } catch (error: any) {
      alert(error.message);
      setSelectingAgentId(null);
    }
  };

  const availableMethods = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => a.bank_methods?.forEach((m: string) => m && set.add(m)));
    return ["All", ...Array.from(set)];
  }, [agents]);

  if (loading) return <SidebarShell role="player"><LoadingCard text="جاري البحث عن أفضل الوكلاء..." /></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader
        title="اختر الوكيل الخاص بك"
        subtitle="اختر الوكيل المناسب بناءً على طرق الدفع المتوفرة، الرصيد، والسمعة."
      />

      {/* ... (إحصائيات الكارطيات - Stats Cards) ... */}

      <div className="space-y-4 mt-6">
        {agents.length === 0 ? (
          <GlassCard className="p-10 text-center text-white/50">
            لا يوجد وكلاء متاحون حالياً بهذه الفلاتر.
          </GlassCard>
        ) : (
          agents.map((agent) => (
            <GlassCard key={agent.id || agent.agentId} className="overflow-hidden p-5 md:p-6 border-white/5 hover:border-cyan-500/30 transition-all">
              <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                <div>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-xl font-bold text-cyan-400">
                      {(agent.display_name || "A").slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold flex items-center gap-2">
                        {agent.display_name}
                        <span className={`h-2.5 w-2.5 rounded-full ${agent.online ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                      </h3>
                      <p className="text-sm text-white/50">{agent.bank_methods?.join(" • ") || "All methods supported"}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[10px] uppercase text-white/40">Available</p>
                      <p className="text-lg font-bold">{agent.available_balance || 0} DH</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[10px] uppercase text-white/40">Min Limit</p>
                      <p className="text-lg font-bold">{agent.min_limit || 100} DH</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[10px] uppercase text-white/40">Rating</p>
                      <p className="text-lg font-bold text-amber-400">{agent.rating || 100}%</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[10px] uppercase text-white/40">Response</p>
                      <p className="text-lg font-bold text-emerald-400">~{agent.response_minutes || 5}m</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="text-center md:text-left">
                    <h4 className="font-semibold text-lg">اربط حسابك بهذا الوكيل</h4>
                    <p className="text-xs text-white/50 mt-1">سيتم توجيه جميع طلبات الشحن الخاصة بك لهذا الوكيل مباشرة.</p>
                  </div>
                  
                  {/* 🟢 الزر دابا ولا كياخد الـ agent كامل كباراميتر */}
                  <PrimaryButton 
                    onClick={() => chooseAgent(agent)} 
                    disabled={selectingAgentId === (agent.id || agent.agentId)}
                    className="w-full py-4 shadow-lg shadow-cyan-500/10"
                  >
                    {selectingAgentId === (agent.id || agent.agentId) ? "جاري الربط..." : "اختيار هذا الوكيل"}
                  </PrimaryButton>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </SidebarShell>
  );
}