/**
 * Single place to derive “how much this agent can cover” for an order/recharge.
 * `Wallet.balance` and `Agent.availableBalance` are kept in sync by wallet flows, but
 * if one is briefly stale, using the max avoids false “insufficient balance” rejects
 * (e.g. wallet 0, availableBalance 3300 after a backfill or legacy row).
 */
export function getAgentSpendableBalanceDh(agent: {
  availableBalance?: unknown;
  wallet?: { balance?: unknown } | null;
}): number {
  const w = agent.wallet != null ? Number(agent.wallet.balance) : NaN;
  const a = Number(agent.availableBalance ?? 0);
  const wn = Number.isFinite(w) ? Math.max(0, w) : 0;
  const an = Number.isFinite(a) ? Math.max(0, a) : 0;
  return Math.max(wn, an);
}
