"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, StatCard, TextField } from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { useAgentTranslation } from "@/hooks/useTranslation";

export function AgentInviteAgentPanel() {
  const { t, ta } = useAgentTranslation();
  const [user, setUser] = useState<{ agentId?: string; id?: string } | null>(null);
  const [records, setRecords] = useState<
    {
      id: string;
      invited_agent_email?: string | null;
      total_recharge_amount?: number;
      invite_code?: string;
      bonus_awarded?: boolean;
      created_at: string;
    }[]
  >([]);
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (agentId: string) => {
    const res = await fetch(`/api/agent/invite-agent?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
    const data = await res.json();
    setRecords(data.invites || []);
  };

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      setUser(u as { agentId?: string; id?: string });
      const currentAgentId = String((u as { agentId?: string }).agentId || u.id);
      load(currentAgentId).finally(() => setLoading(false));
    })();
  }, []);

  const eligible = useMemo(() => {
    const totalRecharge = records.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);
    return records.length >= 5 || totalRecharge >= 5000;
  }, [records]);

  const bonusLabel = eligible
    ? t("invite_agent_bonus_ready")
    : records.some((item) => item.bonus_awarded)
      ? t("invite_agent_bonus_claimed")
      : t("invite_agent_bonus_locked");

  const totalRechargeDh = records.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);

  const generateInvite = async () => {
    const currentAgentId = user?.agentId || user?.id;
    if (!currentAgentId) {
      alert(t("invite_agent_alert_account"));
      return;
    }

    const res = await fetch("/api/agent/invite-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: currentAgentId,
        type: "generate",
        invitedAgentEmail: email,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return alert(data.message || t("invite_agent_alert_fail"));
    }

    setInviteCode(data.invite?.invite_code || "");
    setInviteLink(data.inviteLink || "");
    await load(currentAgentId);
  };

  const copyInvite = async () => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${base}${inviteLink}`;
    const text = ta("invite_agent_copy_clipboard", { code: inviteCode, link });
    await navigator.clipboard.writeText(text);
    alert(`${t("invite_agent_alert_copied_title")}\n\n${t("invite_agent_alert_copied_body")}`);
  };

  if (loading || !user) return <LoadingCard text={t("invite_agent_loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("invite_agent_title")} subtitle={t("invite_agent_subtitle")} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label={t("invite_agent_stat_invited")} value={String(records.length)} hint={t("invite_agent_stat_invited_hint")} />
        <StatCard
          label={t("invite_agent_stat_recharge")}
          value={`${totalRechargeDh} DH`}
          hint={t("invite_agent_stat_recharge_hint")}
        />
        <StatCard
          label={t("invite_agent_stat_target")}
          value={t("invite_agent_stat_target_value")}
          hint={t("invite_agent_stat_target_hint")}
        />
        <StatCard label={t("invite_agent_stat_bonus")} value={bonusLabel} hint={t("invite_agent_stat_bonus_hint")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">{t("invite_agent_generate_title")}</h2>
          <div className="mt-5 space-y-4">
            <TextField
              placeholder={t("invite_agent_email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PrimaryButton onClick={generateInvite}>{t("invite_agent_generate_btn")}</PrimaryButton>
            <TextField placeholder={t("invite_agent_code_placeholder")} value={inviteCode} onChange={() => {}} />
            <TextField
              placeholder={t("invite_agent_link_placeholder")}
              value={inviteLink ? `${typeof window !== "undefined" ? window.location.origin : ""}${inviteLink}` : ""}
              onChange={() => {}}
            />
            <PrimaryButton onClick={copyInvite} disabled={!inviteCode}>
              <Copy size={16} className="mr-2 inline-block" />
              {t("invite_agent_copy_btn")}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">{t("invite_agent_records_title")}</h2>
          <div className="mt-5 grid gap-4">
            {records.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{item.invited_agent_email || t("invite_agent_email_fallback")}</p>
                    <p className="mt-1 text-sm text-white/55">
                      {ta("invite_agent_recharge_total", { amount: String(item.total_recharge_amount ?? 0) })}
                    </p>
                    <p className="mt-1 text-xs text-cyan-200">
                      {ta("invite_agent_code_line", { code: String(item.invite_code ?? "") })}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                      item.bonus_awarded ? "bg-emerald-400/10 text-emerald-200" : "bg-white/10 text-white/65"
                    }`}
                  >
                    {item.bonus_awarded ? t("invite_agent_status_awarded") : t("invite_agent_status_tracking")}
                  </div>
                </div>
                <p className="mt-3 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
            {!records.length ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">
                {t("invite_agent_empty")}
              </div>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
