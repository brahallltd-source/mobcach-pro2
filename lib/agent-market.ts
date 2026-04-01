import { dataPath, normalize, readJsonArray } from "@/lib/json";

export type DiscoveryFilters = {
  country?: string;
  method?: string;
  amount?: number;
  time?: number;
  asset?: string;
};

export function getDiscoverableAgents(filters: DiscoveryFilters = {}) {
  const agents = readJsonArray<any>(dataPath("agents.json"));
  const profiles = readJsonArray<any>(dataPath("agent_profiles.json"));
  const methods = readJsonArray<any>(dataPath("agent_payment_methods.json"));

  const rows = agents
    .filter((agent) => agent.status === "account_created")
    .map((agent) => {
      const profile = profiles.find((item) => String(item.agentId) === String(agent.id)) || {};
      const availableMethods = methods.filter((item) => String(item.agentId) === String(agent.id) && item.enabled);
      return {
        agentId: String(agent.id),
        display_name: profile.display_name || agent.full_name || `${agent.first_name || ""} ${agent.last_name || ""}`.trim(),
        email: agent.email,
        online: Boolean(agent.online),
        country: profile.country || agent.country || "Morocco",
        rating: Number(profile.rating || 0),
        trades_count: Number(profile.trades_count || 0),
        success_rate: Number(profile.success_rate || profile.rating || 0),
        response_minutes: Number(profile.response_minutes || 30),
        sla: Number(profile.response_minutes || 30),
        last_activity: agent.updated_at || agent.created_at || new Date().toISOString(),
        min_limit: Number(profile.min_limit || 0),
        max_limit: Number(profile.max_limit || 0),
        available_balance: Number(profile.available_balance || 0),
        verified: Boolean(profile.verified),
        featured: Boolean(profile.featured),
        trusted: Number(profile.success_rate || 0) >= 98 && Number(profile.trades_count || 0) >= 50,
        fast: Number(profile.response_minutes || 30) <= 30,
        bank_methods: Array.isArray(profile.bank_methods) ? profile.bank_methods : [],
        supported_assets: Array.isArray(profile.supported_assets) ? profile.supported_assets : ["MAD"],
        updated_at: agent.updated_at || agent.created_at || new Date().toISOString(),
        methods: availableMethods,
      };
    })
    .filter((row) => {
      if (filters.country && filters.country !== "All" && normalize(row.country) !== normalize(filters.country)) return false;
      if (filters.method && filters.method !== "All" && !row.methods.some((item: any) => normalize(item.method_name) === normalize(filters.method))) return false;
      if (filters.asset && filters.asset !== "All" && !row.supported_assets.some((item: string) => normalize(item) === normalize(filters.asset))) return false;
      if (filters.amount && (filters.amount < row.min_limit || filters.amount > row.max_limit)) return false;
      if (filters.time && row.response_minutes > filters.time) return false;
      return true;
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.online) - Number(a.online) || b.rating - a.rating || b.trades_count - a.trades_count);

  return rows;
}
