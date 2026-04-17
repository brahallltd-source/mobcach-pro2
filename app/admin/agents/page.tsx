"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { SidebarShell, PageHeader, GlassCard, LoadingCard, TextField } from "@/components/ui";
import { Key, ShieldAlert, Edit2, Save, X, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function AgentListPage() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/admin/agents", { cache: "no-store" });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) { toast.error("Error loading agents"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleAction = async (id: string, body: any, method = "PATCH") => {
    const res = await fetch(`/api/admin/agents/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("Success");
      fetchAgents();
      setEditingWalletId(null);
    } else { toast.error("Failed"); }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text={t("processing")} /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title={t("agents")} subtitle="Manage accounts and balances." />
      <div className="grid gap-4 mt-6">
        {agents.map((agent) => (
          <GlassCard key={agent.id} className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold">{agent.fullName || agent.username}</h3>
              <p className="text-sm text-white/40">{agent.email} • {agent.status}</p>
              <div className="mt-3 flex items-center gap-3">
                {editingWalletId === agent.id ? (
                  <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                    <TextField type="number" className="w-24 h-8 text-xs" value={newBalance} onChange={(e) => setNewBalance(Number(e.target.value))} />
                    <button onClick={() => handleAction(agent.id, { action: "update_balance", amount: newBalance })} className="p-1.5 text-green-400"><Save size={16}/></button>
                    <button onClick={() => setEditingWalletId(null)} className="p-1.5 text-white/30"><X size={16}/></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <p className="text-sm font-bold text-cyan-300">{t("available")}: {agent.availableBalance} DH</p>
                    <button onClick={() => { setEditingWalletId(agent.id); setNewBalance(agent.availableBalance); }} className="p-1.5 opacity-0 group-hover:opacity-100 text-white/30"><Edit2 size={14}/></button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const p = prompt("New Password:"); if(p) handleAction(agent.id, { action: "reset_password", newPassword: p }) }} className="p-2 bg-white/5 rounded-xl"><Key size={16}/></button>
              <button onClick={() => handleAction(agent.id, { action: "update_status", status: agent.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })} className="p-2 bg-white/5 rounded-xl"><ShieldAlert size={16}/></button>
              <button onClick={() => { if(confirm("Delete?")) handleAction(agent.id, {}, "DELETE") }} className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><Trash2 size={16}/></button>
            </div>
          </GlassCard>
        ))}
      </div>
    </SidebarShell>
  );
}