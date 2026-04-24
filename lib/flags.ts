const MS_7D = 7 * 24 * 60 * 60 * 1000;

export function isNewAgentByCreatedAt(createdAt: Date | null | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < MS_7D;
}

/** Rules: amount &gt; 5000 → HIGH_VALUE; agent account age &lt; 7 days → NEW_AGENT. */
export function computeRechargeMonitoringFlags(
  amount: number,
  agentUserCreatedAt: Date | null | undefined
): string[] {
  const out: string[] = [];
  if (Number.isFinite(amount) && amount > 5000) out.push("HIGH_VALUE");
  if (isNewAgentByCreatedAt(agentUserCreatedAt ?? null)) out.push("NEW_AGENT");
  return out;
}

export function mergeUniqueFlags(...groups: (string[] | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const g of groups) {
    for (const x of g ?? []) {
      const t = String(x).trim();
      if (t) s.add(t);
    }
  }
  return [...s];
}

/** Stored DB flags plus derived monitoring flags (for admin JSON). */
export function mergeRechargeRequestFlagsForDisplay(
  stored: string[] | null | undefined,
  amount: number,
  agentUserCreatedAt: Date | null | undefined
): string[] {
  return mergeUniqueFlags(stored, computeRechargeMonitoringFlags(amount, agentUserCreatedAt));
}

/** User row: stored flags plus NEW_AGENT when role is AGENT and account is new. */
export function mergeUserFlagsForDisplay(
  stored: string[] | null | undefined,
  role: string,
  createdAt: Date | null | undefined
): string[] {
  const base = mergeUniqueFlags(stored);
  if (String(role ?? "").trim().toUpperCase() === "AGENT" && isNewAgentByCreatedAt(createdAt ?? null)) {
    return mergeUniqueFlags(base, ["NEW_AGENT"]);
  }
  return base;
}
