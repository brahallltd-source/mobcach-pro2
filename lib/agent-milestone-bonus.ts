import { randomBytes } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

/** Per linked player: lifetime recharge through this agent must reach this to count as “milestone”. */
export const MILESTONE_RECHARGE_DH = 5000;
/** Every N eligible players → one automated bonus block. */
export const PLAYERS_PER_BONUS_BLOCK = 10;
/** DH credited per bonus block (auto-claim). */
export const BONUS_PER_BLOCK_DH = 1000;

export function generateAgentInviteCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `AGENT-${suffix}`;
}

/** Up to 4 chars A–Z / 0–9 for invite prefix (User has no `name`; use agent name or username). */
function inviteCodePrefixFromProfile(
  fullName: string | null | undefined,
  username: string | null | undefined
): string {
  const raw = String(fullName ?? "").trim() || String(username ?? "").trim();
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (alnum.length >= 4) return alnum.slice(0, 4);
  if (alnum.length > 0) return alnum.padEnd(4, "X");
  return "GOS";
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Ensures the agent `User` row has a unique `inviteCode`.
 * Tries a short readable code first, then the legacy `AGENT-…` form (retries on `@unique` collisions).
 */
export async function ensureAgentInviteCode(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      inviteCode: true,
      username: true,
      agentProfile: { select: { fullName: true } },
    },
  });
  if (!user) {
    throw new Error("INVITE_CODE_USER_NOT_FOUND");
  }
  if (user.inviteCode) return user.inviteCode;

  const baseName = inviteCodePrefixFromProfile(user.agentProfile?.fullName, user.username);

  const persist = async (code: string) => {
    await prisma.user.update({
      where: { id: userId },
      data: { inviteCode: code },
    });
    return code;
  };

  for (let i = 0; i < 16; i++) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newCode = `${baseName}-${randomNum}`;
    try {
      return await persist(newCode);
    } catch (e) {
      if (isPrismaUniqueViolation(e)) continue;
      throw e;
    }
  }

  for (let i = 0; i < 12; i++) {
    const code = generateAgentInviteCode();
    try {
      return await persist(code);
    } catch (e) {
      if (isPrismaUniqueViolation(e)) continue;
      throw e;
    }
  }

  throw new Error("INVITE_CODE_ALLOC_FAILED");
}

/**
 * After `AgentCustomer.totalRecharged` was updated for an approved recharge:
 * count players with totalRecharged ≥ milestone, credit wallet for new full blocks of 10.
 */
export async function applyAutomatedMilestoneBonuses(
  tx: Prisma.TransactionClient,
  params: { agentId: string; agentUserId: string }
): Promise<{ creditedDh: number; eligiblePlayers: number; newBonusesClaimed: number }> {
  const eligiblePlayersCount = await tx.agentCustomer.count({
    where: {
      agentId: params.agentId,
      totalRecharged: { gte: MILESTONE_RECHARGE_DH },
    },
  });

  const totalEarnedBonuses = Math.floor(eligiblePlayersCount / PLAYERS_PER_BONUS_BLOCK);
  const user = await tx.user.findUnique({
    where: { id: params.agentUserId },
    select: { bonusesClaimed: true },
  });
  const claimed = user?.bonusesClaimed ?? 0;
  const pendingBonuses = totalEarnedBonuses - claimed;

  if (pendingBonuses <= 0) {
    return { creditedDh: 0, eligiblePlayers: eligiblePlayersCount, newBonusesClaimed: claimed };
  }

  const bonusAmount = pendingBonuses * BONUS_PER_BLOCK_DH;

  let agentWallet = await tx.wallet.findUnique({ where: { userId: params.agentUserId } });
  if (!agentWallet) {
    agentWallet = await tx.wallet.create({
      data: { userId: params.agentUserId, balance: 0 },
    });
  }

  await tx.wallet.update({
    where: { userId: params.agentUserId },
    data: { balance: { increment: bonusAmount } },
  });

  await tx.walletLedger.create({
    data: {
      walletId: agentWallet.id,
      agentId: params.agentUserId,
      type: "IN",
      amount: bonusAmount,
      reason: "BONUS_MILESTONE",
      meta: {
        pendingBonuses,
        eligiblePlayersCount,
        totalEarnedBonuses,
        bonusPerBlock: BONUS_PER_BLOCK_DH,
      } as object,
    },
  });

  await tx.agent.update({
    where: { id: params.agentId },
    data: { availableBalance: { increment: bonusAmount } },
  });

  await tx.user.update({
    where: { id: params.agentUserId },
    data: { bonusesClaimed: totalEarnedBonuses },
  });

  return {
    creditedDh: bonusAmount,
    eligiblePlayers: eligiblePlayersCount,
    newBonusesClaimed: totalEarnedBonuses,
  };
}
