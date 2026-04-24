import type { Prisma, PrismaClient } from "@prisma/client";

export type ResolvedAgentWalletIds = {
  /** `Agent.id` (public profile / dashboard-home key). */
  agentTableId: string;
  /** `User.id` for the agent account (wallet `userId`, `BalanceLog.agentId`). */
  userId: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Resolve an admin/client “agent id” that may be either `Agent.id` or the agent’s `User.id`.
 */
export async function resolveAgentWalletIds(db: Db, raw: unknown): Promise<ResolvedAgentWalletIds | null> {
  const id = String(raw ?? "").trim();
  if (!id) return null;

  const asAgent = await db.agent.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (asAgent) return { agentTableId: asAgent.id, userId: asAgent.userId };

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, agentProfile: { select: { id: true } } },
  });
  if (user?.agentProfile) {
    return { agentTableId: user.agentProfile.id, userId: user.id };
  }
  return null;
}
