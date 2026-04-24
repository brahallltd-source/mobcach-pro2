"use client";

import { RechargeRequestsManagement } from "@/components/admin/RechargeRequestsManagement";

/**
 * Alias route: same UI as `/admin/recharge-requests`.
 * Table (see `RechargeRequestsManagement`): agent column uses `request.agent?.username` /
 * `request.agent?.email`; GoSport365 column uses `request.gosport365Username` (with `note` fallback
 * in the component for legacy data); bank column uses `request.paymentMethod?.methodName` /
 * `request.paymentMethod?.accountName`.
 */
export default function AdminRequestsPage() {
  return (
    <RechargeRequestsManagement
      pageTitle="Recharge requests"
      pageSubtitle="Agent wallet top-ups: proof, bank method, approve or reject."
    />
  );
}
