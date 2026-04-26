import type { PrismaClient } from "@prisma/client";
import {
  BONUS_PER_BLOCK_DH,
  ensureAgentInviteCode,
  MILESTONE_RECHARGE_DH,
  PLAYERS_PER_BONUS_BLOCK,
} from "@/lib/agent-milestone-bonus";
import {
  SUB_AGENT_REFERRER_BONUS_DH,
  SUB_AGENT_SALES_MILESTONE_DH,
  SUB_AGENTS_PER_BONUS_BLOCK,
} from "@/lib/agent-subagent-bonus";

export type AgentInvitationsPlayerRow = {
  id: string;
  playerId: string;
  displayName: string;
  username: string;
  totalRecharged: number;
  status: string;
  playerCreatedAt?: string;
};

export type AgentInvitationsSubAgentRow = {
  id: string;
  username: string;
  displayName: string;
  totalSales: number;
};

/** JSON returned by `GET /api/agent/invite` and `GET /api/agent/invitations-rewards/stats`. */
export type AgentInvitationsStatsPayload = {
  inviteCode: string;
  eligiblePlayersCount: number;
  bonusesClaimed: number;
  totalEarnedBonuses: number;
  progressTowardNextBonus: number;
  playersRemainingForBonus: number;
  milestoneDh: number;
  bonusBlockDh: number;
  playersPerBlock: number;
  players: AgentInvitationsPlayerRow[];
  qualifiedSubAgentsCount: number;
  agentBonusesPaid: number;
  totalEarnedSubAgentBlocks: number;
  progressTowardNextSubAgentBlock: number;
  subAgentsRemainingForBonus: number;
  subAgentMilestoneDh: number;
  subAgentBonusBlockDh: number;
  subAgentsPerBonusBlock: number;
  subAgents: AgentInvitationsSubAgentRow[];
};

export async function buildAgentInvitationsStatsPayload(
  prisma: PrismaClient,
  ctx: { userId: string; agentId: string }
): Promise<AgentInvitationsStatsPayload> {
  const inviteCode = await ensureAgentInviteCode(prisma, ctx.userId);

  const eligiblePlayersCount = await prisma.agentCustomer.count({
    where: {
      agentId: ctx.agentId,
      totalRecharged: { gte: MILESTONE_RECHARGE_DH },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { bonusesClaimed: true },
  });
  const bonusesClaimed = user?.bonusesClaimed ?? 0;
  const totalEarnedBonuses = Math.floor(eligiblePlayersCount / PLAYERS_PER_BONUS_BLOCK);
  const progress = eligiblePlayersCount % PLAYERS_PER_BONUS_BLOCK;

  const customers = await prisma.agentCustomer.findMany({
    where: { agentId: ctx.agentId },
    orderBy: { updatedAt: "desc" },
    take: 150,
    include: {
      player: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      },
    },
  });

  const players = customers.map((c) => {
    const name = [c.player.firstName, c.player.lastName].filter(Boolean).join(" ").trim();
    return {
      id: c.id,
      playerId: c.playerId,
      displayName: name || c.player.username,
      username: c.player.username,
      totalRecharged: c.totalRecharged,
      status: c.status,
      playerCreatedAt: c.player.createdAt.toISOString(),
    };
  });

  const qualifiedSubAgentsCount = await prisma.user.count({
    where: {
      referredById: ctx.userId,
      role: "AGENT",
      totalSales: { gte: SUB_AGENT_SALES_MILESTONE_DH },
    },
  });

  const subAgentRows = await prisma.user.findMany({
    where: { referredById: ctx.userId, role: "AGENT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      username: true,
      totalSales: true,
      agentProfile: { select: { fullName: true, username: true } },
    },
  });

  const meBonuses = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { agentBonusesPaid: true },
  });
  const agentBonusesPaid = meBonuses?.agentBonusesPaid ?? 0;
  const totalEarnedSubAgentBlocks = Math.floor(qualifiedSubAgentsCount / SUB_AGENTS_PER_BONUS_BLOCK);
  const progressTowardNextSubAgentBlock = qualifiedSubAgentsCount % SUB_AGENTS_PER_BONUS_BLOCK;
  const subAgentsRemainingForBonus = Math.max(0, SUB_AGENTS_PER_BONUS_BLOCK - progressTowardNextSubAgentBlock);

  const subAgents = subAgentRows.map((u) => {
    const display =
      String(u.agentProfile?.fullName ?? "").trim() ||
      String(u.agentProfile?.username ?? u.username ?? "").trim() ||
      u.username;
    return {
      id: u.id,
      username: u.username,
      displayName: display,
      totalSales: u.totalSales,
    };
  });

  return {
    inviteCode,
    eligiblePlayersCount,
    bonusesClaimed,
    totalEarnedBonuses,
    progressTowardNextBonus: progress,
    playersRemainingForBonus: Math.max(0, PLAYERS_PER_BONUS_BLOCK - progress),
    milestoneDh: MILESTONE_RECHARGE_DH,
    bonusBlockDh: BONUS_PER_BLOCK_DH,
    playersPerBlock: PLAYERS_PER_BONUS_BLOCK,
    players,
    qualifiedSubAgentsCount,
    agentBonusesPaid,
    totalEarnedSubAgentBlocks,
    progressTowardNextSubAgentBlock,
    subAgentsRemainingForBonus,
    subAgentMilestoneDh: SUB_AGENT_SALES_MILESTONE_DH,
    subAgentBonusBlockDh: SUB_AGENT_REFERRER_BONUS_DH,
    subAgentsPerBonusBlock: SUB_AGENTS_PER_BONUS_BLOCK,
    subAgents,
  };
}
