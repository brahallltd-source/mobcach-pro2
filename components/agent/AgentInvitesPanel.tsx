"use client";

import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { useAgentTranslation } from "@/hooks/useTranslation";

type Invite = {
  id: string;
  agentId: string;
  playerEmail: string;
  total_recharge_amount: number;
  bonus_awarded: boolean;
  created_at: string;
};

export function AgentInvitesPanel() {
  const { t, ta } = useAgentTranslation();
  const [agentId, setAgentId] = useState("");
  const [items, setItems] = useState<Invite[]>([]);
  const [saving, setSaving] = useState(false);
  const load = async (id: string) => {
    const res = await fetch(`/api/agent/invites?agentId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.invites || []);
  };
  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      const aid = String((u as { agentId?: string }).agentId || u.id || "");
      setAgentId(aid);
      if (aid) load(aid);
    })();
  }, []);
  const total = items.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);
  const eligible = total >= 3000 && !items.some((item) => item.bonus_awarded);
  const bonusValue = eligible
    ? t("invites_bonus_ready")
    : items.some((item) => item.bonus_awarded)
      ? t("invites_bonus_claimed")
      : t("invites_bonus_locked");
  const claim = async () => {
    setSaving(true);
    const res = await fetch("/api/agent/award-invite-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || t("invites_alert_claim_fail"));
      setSaving(false);
      return;
    }
    alert(data.message || t("invites_alert_bonus_ok"));
    await load(agentId);
    setSaving(false);
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("invites_page_title")}
        subtitle={t("invites_page_subtitle")}
        action={
          <PrimaryButton onClick={claim} disabled={!eligible || saving}>
            {saving ? t("invites_claim_processing") : t("invites_claim")}
          </PrimaryButton>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={t("invites_stat_total")} value={`${total} DH`} hint={t("invites_stat_total_hint")} />
        <StatCard label={t("invites_stat_bonus")} value={bonusValue} hint={t("invites_stat_bonus_hint")} />
        <StatCard label={t("invites_stat_count")} value={String(items.length)} hint={t("invites_stat_count_hint")} />
      </div>
      <GlassCard className="p-6 md:p-8">
        <h2 className="text-2xl font-semibold">{t("invites_records_title")}</h2>
        <div className="mt-5 grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold">{item.playerEmail}</p>
                  <p className="mt-1 text-sm text-white/55">
                    {ta("invites_recharge_total", { amount: String(item.total_recharge_amount) })}
                  </p>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    item.bonus_awarded ? "bg-emerald-400/10 text-emerald-200" : "bg-white/10 text-white/65"
                  }`}
                >
                  {item.bonus_awarded ? t("invites_status_awarded") : t("invites_status_tracking")}
                </div>
              </div>
              <p className="mt-3 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p>
            </div>
          ))}
          {!items.length ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">
              {t("invites_empty")}
            </div>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
