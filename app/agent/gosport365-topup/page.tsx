"use client";

import { useEffect, useState } from "react";
import { PageHeader, SidebarShell } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RechargeForm } from "@/components/RechargeForm";
import { AgentRechargeHistoryBoard } from "@/components/agent/AgentRechargeHistoryBoard";
import { useAgentTranslation } from "@/hooks/useTranslation";
import { useInvitationAffiliatePendingDh } from "@/hooks/useInvitationAffiliatePendingDh";

type RechargePolicy = {
  minRechargeAmount: number;
  affiliateBonusEnabled: boolean;
};

export default function AgentGs365TopupPage() {
  const { t } = useAgentTranslation();
  const [tab, setTab] = useState("new");
  const [rechargePolicy, setRechargePolicy] = useState<RechargePolicy>({
    minRechargeAmount: 1000,
    affiliateBonusEnabled: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agent/system-context", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as {
          minRechargeAmount?: unknown;
          affiliateBonusEnabled?: unknown;
        };
        const min = Number(j.minRechargeAmount);
        setRechargePolicy({
          minRechargeAmount: Number.isFinite(min) && min >= 1 ? min : 1000,
          affiliateBonusEnabled: j.affiliateBonusEnabled !== false,
        });
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { availableDh, reload } = useInvitationAffiliatePendingDh(
    tab === "new" && rechargePolicy.affiliateBonusEnabled
  );

  return (
    <SidebarShell role="agent">
      <PageHeader title={t("sidebar_gs365_topup")} subtitle={t("dashboard_subtitle")} />

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="new">{t("gs365_tab_new")}</TabsTrigger>
          <TabsTrigger value="history">{t("gs365_tab_history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          <RechargeForm
            embedded
            enableInvitationAffiliateBonus
            affiliateBonusControlledByParent
            invitationAffiliateAvailableDh={availableDh}
            onInvitationAffiliateRefetch={reload}
            rechargePolicy={rechargePolicy}
          />
        </TabsContent>
        <TabsContent value="history">
          <AgentRechargeHistoryBoard />
        </TabsContent>
      </Tabs>
    </SidebarShell>
  );
}
