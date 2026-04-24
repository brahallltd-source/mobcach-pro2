import { Gs365CashLanding } from "@/components/home/Gs365CashLanding";
import { getHomeSpotlightAgents } from "@/lib/home-online-agents";

/** Public marketing home — GS365 Cash fintech landing (agents hydrated server-side). */
export default async function HomePage() {
  const agents = await getHomeSpotlightAgents(3);
  return <Gs365CashLanding agents={agents} />;
}
