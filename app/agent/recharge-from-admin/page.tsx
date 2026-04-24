import type { RechargeFormProps } from "@/components/RechargeForm";
import { RechargeForm } from "@/components/RechargeForm";

export const dynamic = "force-dynamic";

const props: RechargeFormProps = {
  pageTitle: "طلب رصيد من الإدارة",
  pageSubtitle:
    "اختر وسيلة دفع مفعّلة من قبل الإدارة، أرسل المبلغ والإثبات. بعد الموافقة يُضاف الرصيد لمحفظتك.",
  hidePageHeaderBranding: true,
};

/** Dedicated entry for treasury top-up (same flow as `/agent/recharge`, clearer intent in nav). */
export default function AgentRechargeFromAdminPage() {
  return <RechargeForm {...props} />;
}
