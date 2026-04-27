/**
 * Client-side fetch options for `/api/agent/public-profile` so balance is not served from HTTP cache.
 */
export const publicAgentProfileFetchInit: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
};

export function publicAgentProfileUrl(agentId: string): string {
  return `/api/agent/public-profile?agentId=${encodeURIComponent(agentId)}&t=${Date.now()}`;
}

type PublicProfileApi = {
  message?: string;
  agent?: { availableBalance?: number; balance?: number; [key: string]: unknown };
};

/** Fetches the latest agent profile (including wallet balance) for client-side validation. */
export async function fetchPublicAgentProfile(agentId: string): Promise<{
  ok: boolean;
  message?: string;
  data?: PublicProfileApi["agent"];
}> {
  const res = await fetch(publicAgentProfileUrl(agentId), publicAgentProfileFetchInit);
  const json = (await res.json()) as PublicProfileApi;
  if (!res.ok || !json.agent) {
    return { ok: false, message: json.message ?? "Agent not found" };
  }
  return { ok: true, data: json.agent };
}

export function publicAgentAvailableBalance(agent: { availableBalance?: number; balance?: number } | undefined): number {
  if (!agent) return 0;
  const n = Number(agent.availableBalance ?? agent.balance ?? 0);
  return Math.max(0, Number.isFinite(n) ? n : 0);
}
