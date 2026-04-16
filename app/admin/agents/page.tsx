"use client";

import { useEffect, useState } from "react";
import { SidebarShell, PageHeader, GlassCard, LoadingCard } from "@/components/ui";
import { Key, ShieldAlert } from "lucide-react";

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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleResetPassword = async (agentId: string) => {
    const newPass = prompt("أدخل كلمة المرور الجديدة لهذا الوكيل (على الأقل 6 رموز):");
    if (newPass && newPass.length >= 6) {
      try {
        const res = await fetch(`/api/admin/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_password", newPassword: newPass }),
        });
        if (res.ok) {
          alert("تم تغيير المودباس بنجاح! ✅");
        } else {
          alert("فشل في تغيير المودباس.");
        }
      } catch (e) {
        alert("حدث خطأ في الاتصال بالسيرفر.");
      }
    } else if (newPass) {
      alert("المودباس قصير جداً!");
    }
  };

  const toggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (confirm(`هل أنت متأكد أنك تريد تحويل حالة الوكيل إلى ${newStatus}؟`)) {
      await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", status: newStatus }),
      });
      fetchAgents();
    }
  };

  if (loading) {
    return <SidebarShell role="admin"><LoadingCard text="جاري تحميل قائمة الوكلاء..." /></SidebarShell>;
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="لائحة الوكلاء (Agent List)"
        subtitle="إدارة الوكلاء النشطين، تعديل الأرصدة، وإعادة تعيين كلمات المرور."
      />

      <div className="grid gap-4 mt-6">
        {agents.length === 0 ? (
          <GlassCard className="p-8 text-center text-white/50">
            لا يوجد وكلاء حالياً.
          </GlassCard>
        ) : (
          agents.map((agent) => (
            <GlassCard key={agent.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{agent.fullName || agent.username}</h3>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${agent.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-white/60 mt-1">{agent.email} • {agent.country}</p>
                <p className="text-sm font-semibold text-cyan-300 mt-2">الرصيد: {agent.availableBalance} DH</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => handleResetPassword(agent.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-xl text-sm font-semibold transition"
                >
                  <Key size={16} /> تغيير المودباس
                </button>
                
                <button 
                  onClick={() => toggleStatus(agent.id, agent.status)}
                  className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:bg-white/10 rounded-xl text-sm transition"
                >
                  <ShieldAlert size={16} /> {agent.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </SidebarShell>
  );
}