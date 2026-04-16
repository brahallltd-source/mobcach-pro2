"use client";

import { useEffect, useState } from "react";
import { SidebarShell, GlassCard, PageHeader, LoadingCard, StatCard } from "@/components/ui";
import { Users, UserCheck, UserPlus, Search, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function MyPlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const saved = localStorage.getItem("mobcash_user");
        if (!saved) return;
        const user = JSON.parse(saved);
        
        // 🟢 كنصيفطو الـ agentId للـ API اللي صاوبنا
        const agentId = user.agentId || user.id; 
        const res = await fetch(`/api/agent/my-players?agentId=${agentId}`);
        const data = await res.json();
        setPlayers(data.players || []);
      } catch (err) {
        console.error("Error loading players:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPlayers();
  }, []);

  const filtered = players.filter(p => 
    p.email.toLowerCase().includes(search.toLowerCase()) || 
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <SidebarShell role="agent"><LoadingCard text="جاري جلب قائمة لاعبيك..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader 
        title="قائمة لاعبيّ" 
        subtitle="هنا تجد جميع اللاعبين المرتبطين بحسابك."
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard label="إجمالي اللاعبين" value={String(players.length)} icon={<Users className="text-cyan-400" />} />
        <StatCard label="النشطون" value={String(players.filter(p => p.status === 'active').length)} icon={<UserCheck className="text-emerald-400" />} />
        <StatCard label="آخر الانضمامات" value={players.length > 0 ? "اليوم" : "لا يوجد"} icon={<UserPlus className="text-amber-400" />} />
      </div>

      <GlassCard className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input 
            type="text" 
            placeholder="بحث بالإيميل أو اسم المستخدم..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-cyan-500/50 transition-all text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </GlassCard>

      <div className="grid gap-3">
        {filtered.length > 0 ? filtered.map(player => (
          <GlassCard key={player.id} className="p-4 flex items-center justify-between hover:border-white/20 transition-all group">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-cyan-400 border border-white/5">
                {player.username?.slice(0, 1).toUpperCase() || "P"}
              </div>
              <div>
                <h3 className="font-medium">{player.username}</h3>
                <p className="text-xs text-white/40">{player.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:block text-right">
                <p className="text-[10px] uppercase text-white/30">الحالة</p>
                <span className={`text-[11px] font-bold ${player.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {player.status === 'active' ? 'نشط' : 'معلق'}
                </span>
              </div>
              <ArrowRight size={18} className="text-white/20 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
          </GlassCard>
        )) : (
          <div className="text-center py-20 opacity-40 italic">لا يوجد لاعبون حالياً.</div>
        )}
      </div>
    </SidebarShell>
  );
}