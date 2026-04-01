
"use client";

import { useEffect, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell, StatCard } from "@/components/ui";
import { Progress } from "@/components/ui-progress";

type BonusProfile = { volume: number; energy: number; completedOrders: number; pendingBonus: number };

export default function AgentBonusPage() {
  const [profile, setProfile] = useState<BonusProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    fetch(`/api/agent/bonus?agentId=${encodeURIComponent(user.agentId)}`, { cache: "no-store" }).then((res) => res.json()).then((data) => setProfile(data.profile || { volume: 0, energy: 0, completedOrders: 0, pendingBonus: 0 })).finally(() => setLoading(false));
  }, []);
  const levelTarget = 5000, taskTarget = 5, energyTarget = 1000;
  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading bonus..." /></SidebarShell>;
  if (!profile) return <SidebarShell role="agent"><GlassCard className="p-10 text-center">No bonus profile found.</GlassCard></SidebarShell>;
  return (
    <SidebarShell role="agent">
      <PageHeader title="Bonus & Tasks" subtitle="Track volume, energy and task progress from one place." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Volume" value={`${profile.volume} DH`} hint={`Target ${levelTarget} DH`} />
        <StatCard label="Energy" value={`${profile.energy}/1000`} hint="Unlock reward when full" />
        <StatCard label="Completed orders" value={String(profile.completedOrders)} hint={`Task target ${taskTarget}`} />
        <StatCard label="Pending bonus" value={`${profile.pendingBonus} DH`} hint="Applied on next recharge" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="p-6"><h3 className="text-xl font-semibold">Level progress</h3><div className="mt-4"><Progress value={Math.min(100, (profile.volume / levelTarget) * 100)} /></div><p className="mt-3 text-sm text-white/60">{profile.volume} / {levelTarget} DH</p></GlassCard>
        <GlassCard className="p-6"><h3 className="text-xl font-semibold">Energy progress</h3><div className="mt-4"><Progress value={Math.min(100, (profile.energy / energyTarget) * 100)} /></div><p className="mt-3 text-sm text-white/60">{profile.energy} / {energyTarget}</p></GlassCard>
        <GlassCard className="p-6"><h3 className="text-xl font-semibold">Task progress</h3><div className="mt-4"><Progress value={Math.min(100, (profile.completedOrders / taskTarget) * 100)} /></div><p className="mt-3 text-sm text-white/60">{profile.completedOrders} / {taskTarget} orders</p></GlassCard>
      </div>
    </SidebarShell>
  );
}
