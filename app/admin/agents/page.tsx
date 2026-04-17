"use client";

import { useEffect, useState } from "react";
// 🟢 المسمار: استيراد useTranslation من المسار الصحيح
import { useTranslation } from "@/lib/i18n";
import { SidebarShell, PageHeader, GlassCard, LoadingCard, TextField } from "@/components/ui";
import { Key, ShieldAlert, Wallet, Save, X, Edit2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";
type Agent = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  status: string;
  availableBalance: number; // أو wallet حسب السكيما ديالك
  country: string;
};

export default function AgentListPage() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States لتعديل الرصيد
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/admin/agents"); 
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- دالة تعديل الرصيد يدوياً ---
  const handleUpdateWallet = async (agentId: string) => {
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_wallet", balance: newBalance }),
      });
      if (res.ok) {
        toast.success("تم تحديث الرصيد بنجاح! ✅");
        setEditingWalletId(null);
        fetchAgents();
      } else {
        toast.error("فشل في تحديث الرصيد.");
      }
    } catch (e) {
      toast.error("خطأ في الاتصال.");
    }
  };

  const handleResetPassword = async (agentId: string) => {
    const newPass = prompt("أدخل كلمة المرور الجديدة (6 رموز على الأقل):");
    if (newPass && newPass.length >= 6) {
      try {
        const res = await fetch(`/api/admin/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_password", newPassword: newPass }),
        });
        if (res.ok) toast.success("تم تغيير كلمة المرور! ✅");
        else toast.error("فشل العملية.");
      } catch (e) {
        toast.error("خطأ في الاتصال.");
      }
    }
  };

  const toggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (confirm(`تحويل حالة الوكيل إلى ${newStatus}؟`)) {
      await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", status: newStatus }),
      });
      fetchAgents();
    }
  };

  if (loading) {
    return <SidebarShell role="admin"><LoadingCard text={t("processing")} /></SidebarShell>;
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title={t("agents")}
        subtitle="إدارة الحسابات، الأرصدة، والصلاحيات."
      />

      <div className="grid gap-4 mt-6">
        {agents.length === 0 ? (
          <GlassCard className="p-8 text-center text-white/50">
            {t("noOffers")}
          </GlassCard>
        ) : (
          agents.map((agent) => (
            <GlassCard key={agent.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{agent.fullName || agent.username}</h3>
                  <span className={`px-3 py-0.5 text-[10px] font-bold rounded-full border ${agent.status === "ACTIVE" ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-red-500/20 text-red-400 bg-red-500/5"}`}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-white/40 mt-1">{agent.email} • {agent.country}</p>
                
                {/* 💰 قسم الرصيد المعدل */}
                <div className="mt-3 flex items-center gap-3">
                  {editingWalletId === agent.id ? (
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                      <TextField 
                        type="number" 
                        className="w-24 h-8 text-xs px-2" 
                        value={newBalance} 
                        onChange={(e) => setNewBalance(Number(e.target.value))}
                      />
                      <button onClick={() => handleUpdateWallet(agent.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg"><Save size={16}/></button>
                      <button onClick={() => setEditingWalletId(null)} className="p-1.5 text-white/30 hover:bg-white/10 rounded-lg"><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <p className="text-sm font-bold text-cyan-300">
                        {t("available")}: <span className="text-lg">{agent.availableBalance} DH</span>
                      </p>
                      <button 
                        onClick={() => { setEditingWalletId(agent.id); setNewBalance(agent.availableBalance); }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition"
                      >
                        <Edit2 size={14}/>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => handleResetPassword(agent.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/70 hover:bg-white/10 rounded-xl text-xs font-semibold transition"
                >
                  <Key size={14} /> {t("settings")}
                </button>
                
                <button 
                  onClick={() => toggleStatus(agent.id, agent.status)}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border border-white/5",
                    agent.status === "ACTIVE" ? "text-red-400 hover:bg-red-400/5" : "text-emerald-400 hover:bg-emerald-400/5"
                  )}
                >
                  <ShieldAlert size={14} /> {agent.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </SidebarShell>
  );
}