"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
} from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui-progress";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { useAgentTranslation } from "@/hooks/useTranslation";
import { useAgentInvitationsStatsSwr } from "@/hooks/useAgentInvitationsStatsSwr";
import { FadeIn } from "@/components/animations";
import { cn } from "@/lib/cn";

export default function AgentInvitationsRewardsPage() {
  const { t, ta, am, dir } = useAgentTranslation();
  const { data, error, isLoading, mutate } = useAgentInvitationsStatsSwr();
  const [tab, setTab] = useState("players");
  const [origin, setOrigin] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) {
        redirectToLogin();
        return;
      }
      setSessionReady(true);
    })();
  }, []);

  const copyText = useCallback(
    async (text: string, okMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(okMessage);
      } catch {
        toast.error(t("invitations_rewards_err_copy"));
      }
    },
    [t]
  );

  const playerUrl = useMemo(() => {
    if (!data?.inviteCode) return "";
    const ref = encodeURIComponent(data.inviteCode);
    return origin ? `${origin}/register?ref=${ref}` : `/register?ref=${ref}`;
  }, [data?.inviteCode, origin]);

  const subAgentUrl = useMemo(() => {
    if (!data?.inviteCode) return "";
    const ref = encodeURIComponent(data.inviteCode);
    return origin ? `${origin}/agent-register?ref=${ref}` : `/agent-register?ref=${ref}`;
  }, [data?.inviteCode, origin]);

  if (!sessionReady) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text={t("invitations_rewards_loading")} />
      </SidebarShell>
    );
  }

  if (error) {
    return (
      <SidebarShell role="agent">
        <GlassCard className="space-y-4 p-8 text-center">
          <p className="text-white/80">{t("invitations_rewards_error_load")}</p>
          <PrimaryButton type="button" onClick={() => void mutate()}>
            {t("dashboard_error_retry")}
          </PrimaryButton>
        </GlassCard>
      </SidebarShell>
    );
  }

  if (isLoading || !data) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text={t("invitations_rewards_loading")} />
      </SidebarShell>
    );
  }

  const milestone = data.milestoneDh;
  const subMilestone = data.subAgentMilestoneDh;
  const playerBlockProgressPct = (data.progressTowardNextBonus / data.playersPerBlock) * 100;
  const subBlockProgressPct = (data.progressTowardNextSubAgentBlock / data.subAgentsPerBonusBlock) * 100;

  const playerBonusDesc = ta("invitations_rewards_player_bonus_desc", {
    inBlock: String(data.progressTowardNextBonus),
    perBlock: String(data.playersPerBlock),
    bonus: String(data.bonusBlockDh),
    milestone: String(milestone),
    qualified: String(data.eligiblePlayersCount),
    paid: String(data.bonusesClaimed),
  });

  const subBonusDesc = ta("invitations_rewards_subagent_bonus_desc", {
    inBlock: String(data.progressTowardNextSubAgentBlock),
    perBlock: String(data.subAgentsPerBonusBlock),
    bonus: String(data.subAgentBonusBlockDh),
    milestone: String(subMilestone),
    qualified: String(data.qualifiedSubAgentsCount),
    paid: String(data.agentBonusesPaid),
  });

  const rule1 = ta("invitations_rewards_rules_rule1_body", {
    bonus: String(data.bonusBlockDh),
    count: String(data.playersPerBlock),
    milestone: String(milestone),
  });
  const rule2 = ta("invitations_rewards_rules_rule2_body", {
    bonus: "500",
    count: String(data.playersPerBlock),
    milestone: String(milestone),
  });
  const rule3 = ta("invitations_rewards_rules_rule3_body", {
    bonus: String(data.subAgentBonusBlockDh),
    count: String(data.subAgentsPerBonusBlock),
    milestone: String(subMilestone),
  });

  return (
    <SidebarShell role="agent">
      <FadeIn>
        <PageHeader title={t("invitations_rewards_title")} subtitle={t("invitations_rewards_page_subtitle")} />
      </FadeIn>

      <FadeIn delay={0.06} className="mt-4">
        <GlassCard className="p-5 md:p-6">
          <div dir={dir}>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto min-h-11 w-full flex-wrap justify-start gap-1 md:w-auto">
              <TabsTrigger value="players">{t("invitations_rewards_tab_players")}</TabsTrigger>
              <TabsTrigger value="agents">{t("invitations_rewards_tab_agents")}</TabsTrigger>
              <TabsTrigger value="rules">{t("invitations_rewards_tab_rules")}</TabsTrigger>
            </TabsList>

            <TabsContent value="players" className="mt-5 space-y-6">
              <GlassCard className="space-y-4 p-5 md:p-6">
                <h2 className="text-lg font-semibold text-white">{t("invitations_rewards_player_link_title")}</h2>
                <p className="text-sm text-white/65">{t("invitations_rewards_player_link_desc")}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-cyan-100/95 sm:text-sm">
                    {playerUrl || "—"}
                  </code>
                  <PrimaryButton
                    type="button"
                    className="shrink-0"
                    disabled={!playerUrl}
                    onClick={() => void copyText(playerUrl, t("invitations_rewards_copy_players_ok"))}
                  >
                    <Copy className="me-2 inline h-4 w-4" aria-hidden />
                    {t("invitations_rewards_copy")}
                  </PrimaryButton>
                </div>
                <p className="text-sm text-white/55">{ta("invitations_rewards_invite_code", { code: data.inviteCode })}</p>
                <p className="text-xs text-white/45">
                  {t("invitations_rewards_manual_add")}{" "}
                  <Link href="/agent/add-player" className="text-cyan-300 underline hover:text-cyan-200">
                    {t("invitations_rewards_manual_add_link")}
                  </Link>
                  .
                </p>
              </GlassCard>

              <GlassCard className="space-y-4 p-5 md:p-6">
                <h2 className="text-lg font-semibold text-white">{t("invitations_rewards_player_bonus_title")}</h2>
                <p className="text-sm leading-relaxed text-white/70">{playerBonusDesc}</p>
                <div dir="ltr" className="w-full">
                  <Progress value={Math.min(100, playerBlockProgressPct)} />
                </div>
                <div className="grid gap-3 text-xs text-white/50 sm:grid-cols-3 sm:text-sm">
                  <div>
                    <span className="text-white/40">{t("invitations_rewards_stat_players_qualified")}</span>{" "}
                    <span className="font-semibold text-white">{data.eligiblePlayersCount}</span>
                  </div>
                  <div>
                    <span className="text-white/40">{t("invitations_rewards_stat_blocks_earned")}</span>{" "}
                    <span className="font-semibold text-white">{data.totalEarnedBonuses}</span>
                  </div>
                  <div>
                    <span className="text-white/40">{t("invitations_rewards_stat_blocks_paid")}</span>{" "}
                    <span className="font-semibold text-white">{data.bonusesClaimed}</span>
                  </div>
                </div>
                <p className="text-xs text-white/45">{t("invitations_rewards_auto_players")}</p>
              </GlassCard>

              <GlassCard className="overflow-x-auto p-5 md:p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">{t("invitations_rewards_table_player")}</h2>
                {data.players.length === 0 ? (
                  <p className="text-sm text-white/55">{t("invitations_rewards_empty_players")}</p>
                ) : (
                  <table className="w-full min-w-[520px] border-separate border-spacing-0 text-start text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-white/45">
                        <th className="border-b border-white/10 pb-2 pe-4">{t("invitations_rewards_table_player")}</th>
                        <th className="border-b border-white/10 pb-2 pe-4">{t("invitations_rewards_table_username")}</th>
                        <th className="border-b border-white/10 pb-2 pe-4">{t("invitations_rewards_table_progress")}</th>
                        <th className="border-b border-white/10 pb-2">{t("invitations_rewards_table_status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.players.map((row) => {
                        const pct = Math.min(100, (Number(row.totalRecharged) / milestone) * 100);
                        const qualified = Number(row.totalRecharged) >= milestone;
                        return (
                          <tr key={row.id} className="border-b border-white/[0.06]">
                            <td className="py-3 pe-4 font-medium text-white">{row.displayName}</td>
                            <td className="py-3 pe-4 text-white/70">{row.username}</td>
                            <td className="py-3 pe-4">
                              <div className="max-w-[220px] space-y-1">
                                <div className="text-xs text-white/55">
                                  {Math.round(Number(row.totalRecharged))} / {milestone} DH
                                </div>
                                <div dir="ltr" className="w-full">
                                  <Progress value={pct} />
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                                  qualified ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/70"
                                )}
                              >
                                {qualified
                                  ? t("invitations_rewards_status_qualified")
                                  : t("invitations_rewards_status_pending")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </GlassCard>
            </TabsContent>

            <TabsContent value="agents" className="mt-5 space-y-6">
              <GlassCard className="space-y-4 p-5 md:p-6">
                <h2 className="text-lg font-semibold text-white">{t("invitations_rewards_agent_link_title")}</h2>
                <p className="text-sm text-white/65">{t("invitations_rewards_agent_link_desc")}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-amber-100/95 sm:text-sm">
                    {subAgentUrl || "—"}
                  </code>
                  <PrimaryButton
                    type="button"
                    className="shrink-0"
                    disabled={!subAgentUrl}
                    onClick={() => void copyText(subAgentUrl, t("invitations_rewards_copy_agents_ok"))}
                  >
                    <Copy className="me-2 inline h-4 w-4" aria-hidden />
                    {t("invitations_rewards_copy")}
                  </PrimaryButton>
                </div>
                <p className="text-sm text-white/55">{ta("invitations_rewards_invite_code", { code: data.inviteCode })}</p>
              </GlassCard>

              <GlassCard className="space-y-4 p-5 md:p-6">
                <h2 className="text-lg font-semibold text-white">{t("invitations_rewards_subagent_bonus_title")}</h2>
                <p className="text-sm leading-relaxed text-white/70">{subBonusDesc}</p>
                <div dir="ltr" className="w-full">
                  <Progress value={Math.min(100, subBlockProgressPct)} />
                </div>
                <div className="grid gap-3 text-xs text-white/50 sm:grid-cols-3 sm:text-sm">
                  <div>
                    <span className="text-white/40">{t("invitations_rewards_stat_subagents_qualified")}</span>{" "}
                    <span className="font-semibold text-white">{data.qualifiedSubAgentsCount}</span>
                  </div>
                  <div>
                    <span className="text-white/40">{t("invitations_rewards_stat_blocks_earned")}</span>{" "}
                    <span className="font-semibold text-white">{data.totalEarnedSubAgentBlocks}</span>
                  </div>
                  <div>
                    <span className="text-white/40">{t("invitations_rewards_stat_blocks_paid")}</span>{" "}
                    <span className="font-semibold text-white">{data.agentBonusesPaid}</span>
                  </div>
                </div>
                <p className="text-xs text-white/45">{t("invitations_rewards_auto_subagents")}</p>
              </GlassCard>

              <GlassCard className="overflow-x-auto p-5 md:p-6">
                <h2 className="mb-1 text-lg font-semibold text-white">{t("invitations_rewards_subagents_list_title")}</h2>
                <p className="mb-4 text-sm text-white/55">{t("invitations_rewards_subagents_list_desc")}</p>
                {data.subAgents.length === 0 ? (
                  <p className="text-sm text-white/55">{t("invitations_rewards_empty_subagents")}</p>
                ) : (
                  <table className="w-full min-w-[520px] border-separate border-spacing-0 text-start text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-white/45">
                        <th className="border-b border-white/10 pb-2 pe-4">{t("invitations_rewards_table_subagent")}</th>
                        <th className="border-b border-white/10 pb-2 pe-4">{t("invitations_rewards_table_username")}</th>
                        <th className="border-b border-white/10 pb-2 pe-4">{t("invitations_rewards_table_progress")}</th>
                        <th className="border-b border-white/10 pb-2">{t("invitations_rewards_table_status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subAgents.map((row) => {
                        const pct = Math.min(100, (Number(row.totalSales) / subMilestone) * 100);
                        const qualified = Number(row.totalSales) >= subMilestone;
                        return (
                          <tr key={row.id} className="border-b border-white/[0.06]">
                            <td className="py-3 pe-4 font-medium text-white">{row.displayName}</td>
                            <td className="py-3 pe-4 text-white/70">{row.username}</td>
                            <td className="py-3 pe-4">
                              <div className="max-w-[220px] space-y-1">
                                <div className="text-xs text-white/55">
                                  {Math.round(Number(row.totalSales))} / {subMilestone} DH
                                </div>
                                <div dir="ltr" className="w-full">
                                  <Progress value={pct} />
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                                  qualified ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/70"
                                )}
                              >
                                {qualified
                                  ? t("invitations_rewards_status_qualified")
                                  : t("invitations_rewards_status_pending")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </GlassCard>
            </TabsContent>

            <TabsContent value="rules" className="mt-5 space-y-4">
              <GlassCard className="space-y-2 border border-cyan-500/20 bg-cyan-500/5 p-4 md:p-5">
                <p className="text-sm font-semibold text-cyan-100">{am("invite.step1")}</p>
                <p className="text-xs leading-relaxed text-white/60">{am("invite.step1Hint")}</p>
              </GlassCard>
              <p className="text-sm text-white/65">{t("invitations_rewards_rules_intro")}</p>
              <GlassCard className="space-y-3 p-5 md:p-6">
                <h3 className="font-semibold text-amber-100/95">{t("invitations_rewards_rules_rule1_title")}</h3>
                <p className="text-sm leading-relaxed text-white/80">{rule1}</p>
              </GlassCard>
              <GlassCard className="space-y-3 p-5 md:p-6">
                <h3 className="font-semibold text-amber-100/95">{t("invitations_rewards_rules_rule2_title")}</h3>
                <p className="text-sm leading-relaxed text-white/80">{rule2}</p>
              </GlassCard>
              <GlassCard className="space-y-3 p-5 md:p-6">
                <h3 className="font-semibold text-amber-100/95">{t("invitations_rewards_rules_rule3_title")}</h3>
                <p className="text-sm leading-relaxed text-white/80">{rule3}</p>
              </GlassCard>
              <p className="text-xs text-white/45">{t("invitations_rewards_rules_note")}</p>
            </TabsContent>
          </Tabs>
          </div>
        </GlassCard>
      </FadeIn>
    </SidebarShell>
  );
}
