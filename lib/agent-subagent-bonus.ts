import type { Prisma, PrismaClient } from "@prisma/client";

/** Each referred agent must reach this `User.totalSales` (DH) to count as “qualified”. */
export const SUB_AGENT_SALES_MILESTONE_DH = 10_000;
/** Every N qualified sub-agents → one bonus block for the parent. */
export const SUB_AGENTS_PER_BONUS_BLOCK = 10;
/** DH credited to the parent agent per full block (see product rule: 2% of 10 × 10k). */
export const SUB_AGENT_REFERRER_BONUS_DH = 2000;

/**
 * After a sub-agent’s `totalSales` was incremented: if they have a `referredById`,
 * evaluate the parent’s sub-agent bonus blocks and credit any unpaid ones.
 */
export async function applySubAgentReferrerBonuses(
  tx: Prisma.TransactionClient,
  params: { childUserId: string }
): Promise<{ creditedDh: number }> {
  const child = await tx.user.findUnique({
    where: { id: params.childUserId },
    select: { referredById: true },
  });
  if (!child?.referredById) return { creditedDh: 0 };

  const parentUserId = child.referredById;

  const qualifiedSubAgents = await tx.user.count({
    where: {
      referredById: parentUserId,
      role: "AGENT",
      totalSales: { gte: SUB_AGENT_SALES_MILESTONE_DH },
    },
  });

  const parent = await tx.user.findUnique({
    where: { id: parentUserId },
    select: {
      agentBonusesPaid: true,
      agentProfile: { select: { id: true } },
    },
  });
  if (!parent?.agentProfile) return { creditedDh: 0 };

  const earnedAgentBonuses = Math.floor(qualifiedSubAgents / SUB_AGENTS_PER_BONUS_BLOCK);
  const paid = parent.agentBonusesPaid ?? 0;
  const unpaidAgentBonuses = earnedAgentBonuses - paid;
  if (unpaidAgentBonuses <= 0) return { creditedDh: 0 };

  const bonusAmount = unpaidAgentBonuses * SUB_AGENT_REFERRER_BONUS_DH;

  let parentWallet = await tx.wallet.findUnique({ where: { userId: parentUserId } });
  if (!parentWallet) {
    parentWallet = await tx.wallet.create({
      data: { userId: parentUserId, balance: 0 },
    });
  }

  await tx.wallet.update({
    where: { userId: parentUserId },
    data: { balance: { increment: bonusAmount } },
  });

  await tx.walletLedger.create({
    data: {
      walletId: parentWallet.id,
      agentId: parentUserId,
      type: "IN",
      amount: bonusAmount,
      reason: "BONUS_SUB_AGENTS",
      meta: {
        unpaidAgentBonuses,
        qualifiedSubAgents,
        earnedAgentBonuses,
        bonusPerBlock: SUB_AGENT_REFERRER_BONUS_DH,
      } as object,
    },
  });

  await tx.agent.update({
    where: { id: parent.agentProfile.id },
    data: { availableBalance: { increment: bonusAmount } },
  });

  await tx.user.update({
    where: { id: parentUserId },
    data: { agentBonusesPaid: earnedAgentBonuses },
  });

  return { creditedDh: bonusAmount };
}

/** Resolve `referredById` from invite `ref` string (invite code on referrer `User`). */
export async function resolveAgentReferrerUserId(
  prisma: PrismaClient,
  ref: string
): Promise<string | null> {
  const code = String(ref || "").trim();
  if (!code) return null;
  const u = await prisma.user.findFirst({
    where: { inviteCode: code, role: "AGENT" },
    select: { id: true },
  });
  return u?.id ?? null;
}
