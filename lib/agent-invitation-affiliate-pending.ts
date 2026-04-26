import type { PrismaClient } from "@prisma/client";
import {
  BONUS_PER_BLOCK_DH,
  MILESTONE_RECHARGE_DH,
  PLAYERS_PER_BONUS_BLOCK,
} from "@/lib/agent-milestone-bonus";

/**
 * Player-invitation milestone bonus not yet reflected in `User.bonusesClaimed`
 * (same rules as `buildAgentInvitationsStatsPayload` / invitations-rewards UI).
 */
export async function getInvitationAffiliatePendingDh(
  prisma: PrismaClient,
  params: { agentUserId: string; agentProfileId: string }
): Promise<{
  pendingDh: number;
  pendingBlocks: number;
  bonusesClaimed: number;
  totalEarnedBonuses: number;
}> {
  const eligiblePlayersCount = await prisma.agentCustomer.count({
    where: {
      agentId: params.agentProfileId,
      totalRecharged: { gte: MILESTONE_RECHARGE_DH },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: params.agentUserId },
    select: { bonusesClaimed: true },
  });
  const bonusesClaimed = user?.bonusesClaimed ?? 0;
  const totalEarnedBonuses = Math.floor(eligiblePlayersCount / PLAYERS_PER_BONUS_BLOCK);
  const pendingBlocks = Math.max(0, totalEarnedBonuses - bonusesClaimed);
  const pendingDh = pendingBlocks * BONUS_PER_BLOCK_DH;

  return { pendingDh, pendingBlocks, bonusesClaimed, totalEarnedBonuses };
}
