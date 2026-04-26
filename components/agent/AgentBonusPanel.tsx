"use client";

import { useEffect, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, StatCard } from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { Progress } from "@/components/ui-progress";
import { useAgentTranslation } from "@/hooks/useTranslation";

type BonusProfile = { volume: number; energy: number; completedOrders: number; pendingBonus: number };

export function AgentBonusPanel() {
  const { t, ta } = useAgentTranslation();
  const [profile, setProfile] = useState<BonusProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const user = await requireMobcashUserOnClient("agent");
      if (!user) return void redirectToLogin();
      const agentId = String((user as { agentId?: string }).agentId || user.id);
      fetch(`/api/agent/bonus?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setProfile(data.profile || { volume: 0, energy: 0, completedOrders: 0, pendingBonus: 0 }))
        .finally(() => setLoading(false));
    })();
  }, []);
  const levelTarget = 5000;
  const taskTarget = 5;
  const energyTarget = 1000;
  if (loading) return <LoadingCard text={t("bonus_loading")} />;
  if (!profile) return <GlassCard className="p-10 text-center">{t("bonus_not_found")}</GlassCard>;
  return (
    <div className="space-y-4">
      <PageHeader title={t("bonus_title")} subtitle={t("bonus_subtitle")} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label={t("bonus_stat_volume")}
          value={`${profile.volume} DH`}
          hint={ta("bonus_stat_volume_hint", { target: String(levelTarget) })}
        />
        <StatCard label={t("bonus_stat_energy")} value={`${profile.energy}/1000`} hint={t("bonus_stat_energy_hint")} />
        <StatCard
          label={t("bonus_stat_orders")}
          value={String(profile.completedOrders)}
          hint={ta("bonus_stat_orders_hint", { target: String(taskTarget) })}
        />
        <StatCard
          label={t("bonus_stat_pending")}
          value={`${profile.pendingBonus} DH`}
          hint={t("bonus_stat_pending_hint")}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold">{t("bonus_level_title")}</h3>
          <div className="mt-4">
            <Progress value={Math.min(100, (profile.volume / levelTarget) * 100)} />
          </div>
          <p className="mt-3 text-sm text-white/60">
            {ta("bonus_progress_volume", { current: String(profile.volume), target: String(levelTarget) })}
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold">{t("bonus_energy_title")}</h3>
          <div className="mt-4">
            <Progress value={Math.min(100, (profile.energy / energyTarget) * 100)} />
          </div>
          <p className="mt-3 text-sm text-white/60">
            {ta("bonus_progress_energy", { current: String(profile.energy), target: String(energyTarget) })}
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold">{t("bonus_task_title")}</h3>
          <div className="mt-4">
            <Progress value={Math.min(100, (profile.completedOrders / taskTarget) * 100)} />
          </div>
          <p className="mt-3 text-sm text-white/60">
            {ta("bonus_progress_orders", { current: String(profile.completedOrders), target: String(taskTarget) })}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
