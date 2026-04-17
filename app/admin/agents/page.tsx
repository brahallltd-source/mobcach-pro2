"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { SidebarShell, PageHeader, GlassCard, LoadingCard, TextField } from "@/components/ui";
import { Key, ShieldAlert, Edit2, Save, X, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";

type Agent = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  status: string;
  availableBalance: number;
  country: string;
};

export default function AgentListPage() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/admin/agents", { cache: "no-store" }); 
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  // 💰 تعديل الرصيد
  const handleUpdateWallet = async (agentId: string) => {
    try {
      const res = await fetch("/api/admin/agents/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, balance: newBalance }),
      });
      if (res.ok) {
        toast.success(t("confirm") || "Balance updated! ✅");
        setEditingWalletId(null);
        fetchAgents();
      } else {
        toast.error("Failed to update balance");
      }
    } catch (e) { toast.error("Network Error"); }
  };

  // 🔑 تغيير المودباس
  const handleResetPassword = async (agentId: string) => {
    const newPass = prompt("Enter new password (min 6 chars):");
    if (newPass && newPass.length >= 6) {
      try {
        const res = await fetch("/api/admin/agents/action", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_password", agentId, newPassword: newPass }),
        });
        if (res.ok) toast.success("Password updated successfully");
      } catch (e) { toast.error("Error updating password"); }
    } else if (newPass) {
      toast.error("Password must be at least 6 characters");
    }
  };

  // 🛑 تجميد/تفعيل الحساب
  const toggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (confirm(`Change status to ${newStatus}?`)) {
      await fetch("/api/admin/agents/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", agentId, status: newStatus }),
      });
      fetchAgents();
    }
  };

  // 🗑️ حذف الحساب
  const handleDelete = async (agentId: string) => {
    if (confirm("Are you SURE you want to delete this agent? This action cannot be undone!")) {
      const res = await fetch(`/api/admin/agents/action?agentId=${agentId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Agent deleted");
        fetchAgents();
      } else {
        toast.error("Failed to delete agent");
      }
    }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text={t("processing")} /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title={t("agents")} subtitle="Manage agent accounts, balances, and permissions." />

      <div className="grid gap-4 mt-6">
        {agents.length === 0 ? (
          <GlassCard className="p-8 text-center text-white/50">{t("noOffers")}</GlassCard>
        ) : (
          agents.map((agent) => (
            <GlassCard key={agent.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{agent.fullName || agent.username}</h3>
                  <span className={clsx(
                    "px-3 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-widest",
                    agent.status === "ACTIVE" ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-red-500/20 text-red-400 bg-red-500/5"
                  )}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-white/40 mt-1">{agent.email} • {agent.country}</p>
                
                <div className="mt-3 flex items-center gap-3">
                  {editingWalletId === agent.id ? (
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                      <TextField type="number" className="w-24 h-8 text-xs px-2" value={newBalance} onChange={(e) => setNewBalance(Number(e.target.value))} />
                      <button onClick={() => handleUpdateWallet(agent.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg"><Save size={16}/></button>
                      <button onClick={() => setEditingWalletId(null)} className="p-1.5 text-white/30 hover:bg-white/10 rounded-lg"><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <p className="text-sm font-bold text-cyan-300">{t("available")}: <span className="text-lg">{agent.availableBalance} DH</span></p>
                      <button onClick={() => { setEditingWalletId(agent.id); setNewBalance(agent.availableBalance); }} className="p-1.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition"><Edit2 size={14}/></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleResetPassword(agent.id)} className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/70 hover:bg-white/10 rounded-xl text-xs font-semibold transition">
                  <Key size={14} /> Password
                </button>
                <button onClick={() => toggleStatus(agent.id, agent.status)} className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border border-white/5", agent.status === "ACTIVE" ? "text-amber-400 hover:bg-amber-400/10" : "text-emerald-400 hover:bg-emerald-400/10")}>
                  <ShieldAlert size={14} /> {agent.status === "ACTIVE" ? "Suspend" : "Activate"}
                </button>
                <button onClick={() => handleDelete(agent.id)} className="flex items-center gap-2 px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition border border-rose-500/20">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </SidebarShell>
  );
}