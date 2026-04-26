"use client";

import { useState } from "react";
import { PageHeader, SidebarShell } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentRechargeHistoryBoard } from "@/components/agent/AgentRechargeHistoryBoard";
import { AgentWithdrawalsBoard } from "@/components/agent/AgentWithdrawalsBoard";
import { useAgentTranslation } from "@/hooks/useTranslation";

export default function AgentAllHistoryPage() {
  const { t } = useAgentTranslation();
  const [tab, setTab] = useState("wallet");

  return (
    <SidebarShell role="agent">
      <PageHeader title={t("sidebar_all_history")} subtitle={t("dashboard_subtitle")} />

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="wallet">{t("all_history_tab_wallet")}</TabsTrigger>
          <TabsTrigger value="payouts">{t("all_history_tab_payouts")}</TabsTrigger>
        </TabsList>
        <TabsContent value="wallet">
          <AgentRechargeHistoryBoard />
        </TabsContent>
        <TabsContent value="payouts">
          <AgentWithdrawalsBoard />
        </TabsContent>
      </Tabs>
    </SidebarShell>
  );
}
