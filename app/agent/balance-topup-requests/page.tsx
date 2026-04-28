"use client";

import { useState } from "react";
import { PageHeader, SidebarShell } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RechargeFromAdminClient } from "@/app/agent/recharge-from-admin/RechargeFromAdminClient";
import { AgentRechargeHistoryBoard } from "@/components/agent/AgentRechargeHistoryBoard";
import { useAgentTranslation } from "@/hooks/useTranslation";

export default function AgentBalanceTopupRequestsPage() {
  const { t } = useAgentTranslation();
  const [tab, setTab] = useState("pending");

  return (
    <SidebarShell role="agent">
      <PageHeader title={t("sidebar_balance_topup_requests")} subtitle={t("recharge_from_admin_subtitle")} />

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="h-auto min-h-11 w-full flex-wrap justify-start gap-1 md:w-auto">
          <TabsTrigger value="pending">{t("balance_topup_tab_pending")}</TabsTrigger>
          <TabsTrigger value="history">{t("balance_topup_tab_history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <RechargeFromAdminClient embedded />
        </TabsContent>
        <TabsContent value="history">
          <AgentRechargeHistoryBoard />
        </TabsContent>
      </Tabs>
    </SidebarShell>
  );
}
