import { redirect } from "next/navigation";

/** Canonical flow lives under `/player/become-agent`. */
export default function BecomeAgentRedirectPage() {
  redirect("/player/become-agent");
}
