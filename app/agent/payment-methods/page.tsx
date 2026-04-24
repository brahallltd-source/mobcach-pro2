import { redirect } from "next/navigation";

/** Legacy route: agent payment rails are configured under `/agent/settings/payments`. */
export default function LegacyAgentPaymentMethodsRedirectPage() {
  redirect("/agent/settings/payments");
}
