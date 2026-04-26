"use client";

import useSWR from "swr";
import type { AgentInvitationsStatsPayload } from "@/lib/agent-invitations-stats";

const STATS_KEY = "/api/agent/invitations-rewards/stats";

async function fetcher(url: string): Promise<AgentInvitationsStatsPayload> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (res.status === 401) {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(String(res.status));
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as AgentInvitationsStatsPayload;
}

/** Live stats for `/agent/invitations-rewards` (same payload as `GET /api/agent/invite`). */
export function useAgentInvitationsStatsSwr() {
  return useSWR(STATS_KEY, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
}
