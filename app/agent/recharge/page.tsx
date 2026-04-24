import type { RechargeFormProps } from "@/components/RechargeForm";
import { RechargeForm } from "@/components/RechargeForm";

export const dynamic = "force-dynamic";

const serverProps: RechargeFormProps = {};

/**
 * Server Component: interactive UI in {@link RechargeForm} (client).
 * Only pass {@link RechargeFormProps} here — JSON-serializable data, never functions or `t()`.
 */
export default function AgentRechargePage() {
  return <RechargeForm {...serverProps} />;
}
