"use client";

import { RechargeForm } from "@/components/RechargeForm";
import { useAgentTranslation } from "@/hooks/useTranslation";

export function RechargeFromAdminClient({ embedded }: { embedded?: boolean }) {
  const { t } = useAgentTranslation();
  return (
    <RechargeForm
      pageTitle={t("recharge_from_admin_title")}
      pageSubtitle={t("recharge_from_admin_subtitle")}
      hidePageHeaderBranding
      embedded={Boolean(embedded)}
      enableInvitationAffiliateBonus={false}
    />
  );
}
