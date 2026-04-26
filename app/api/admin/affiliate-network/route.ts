export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import type {
  AffiliateNetworkAgentNode,
  AffiliateNetworkPlayerNode,
} from "@/lib/admin-affiliate-network-types";

/** DH recharged via agent–player link without any completed order → suspicious “recharge-only” pattern. */
const LOOP_RECHARGE_MIN_DH = 500;

export type { AffiliateNetworkAgentNode, AffiliateNetworkPlayerNode } from "@/lib/admin-affiliate-network-types";

function norm(s: string | null | undefined) {
  return String(s ?? "").trim().toUpperCase();
}

export async function GET() {
  const access = await requireAdminPermission("MANAGE_USERS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access, { trees: [] as AffiliateNetworkAgentNode[] });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ trees: [] as AffiliateNetworkAgentNode[] });
  }

  const [agentUsers, players, orderGroups, customers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "AGENT", deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        referredById: true,
        totalSales: true,
        bonusesClaimed: true,
        frozen: true,
        status: true,
        agentProfile: {
          select: { id: true, fullName: true },
        },
      },
    }),
    prisma.player.findMany({
      where: { assignedAgentId: { not: null } },
      select: {
        id: true,
        userId: true,
        username: true,
        assignedAgentId: true,
        status: true,
        user: { select: { email: true, frozen: true, status: true } },
      },
    }),
    prisma.order.groupBy({
      by: ["playerId"],
      where: { playerId: { not: null }, status: "completed" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.agentCustomer.findMany({
      select: { agentId: true, playerId: true, totalRecharged: true },
    }),
  ]);

  const completedByPlayerId = new Map<
    string,
    { sum: number; count: number }
  >();
  for (const row of orderGroups) {
    const pid = row.playerId;
    if (!pid) continue;
    completedByPlayerId.set(pid, {
      sum: Number(row._sum.amount) || 0,
      count: row._count._all,
    });
  }

  const rechargeByAgentPlayer = new Map<string, number>();
  for (const c of customers) {
    const k = `${c.agentId}:${c.playerId}`;
    rechargeByAgentPlayer.set(k, Number(c.totalRecharged) || 0);
  }

  const agentUserById = new Map(agentUsers.map((u) => [u.id, u]));
  const validAgentIds = new Set(
    agentUsers.filter((u) => u.agentProfile?.id).map((u) => u.id)
  );

  const playersByAgentProfileId = new Map<string, typeof players>();
  for (const p of players) {
    const aid = p.assignedAgentId;
    if (!aid) continue;
    const list = playersByAgentProfileId.get(aid) ?? [];
    list.push(p);
    playersByAgentProfileId.set(aid, list);
  }

  const subAgentsByParentUserId = new Map<string, typeof agentUsers>();
  for (const u of agentUsers) {
    const parent = u.referredById;
    if (!parent || !validAgentIds.has(u.id)) continue;
    if (!agentUserById.has(parent)) continue;
    const list = subAgentsByParentUserId.get(parent) ?? [];
    list.push(u);
    subAgentsByParentUserId.set(parent, list);
  }

  function buildPlayerNode(
    p: (typeof players)[number],
    agentProfileId: string
  ): AffiliateNetworkPlayerNode {
    const ord = completedByPlayerId.get(p.id);
    const completedOrders = ord?.count ?? 0;
    const totalSales = ord?.sum ?? 0;
    const totalRechargedDh =
      rechargeByAgentPlayer.get(`${agentProfileId}:${p.id}`) ?? 0;
    const userSt = norm(p.user?.status);
    const isActive =
      norm(p.status) === "ACTIVE" &&
      userSt === "ACTIVE" &&
      !p.user?.frozen;
    const loopSuspicion =
      totalRechargedDh >= LOOP_RECHARGE_MIN_DH && completedOrders === 0;

    return {
      kind: "player",
      id: p.id,
      userId: p.userId,
      username: p.username,
      email: p.user?.email ?? "",
      playerStatus: p.status,
      isActive,
      totalSales,
      activePlayers: isActive ? 1 : 0,
      bonusesClaimed: 0,
      completedOrders,
      totalRechargedDh,
      loopSuspicion,
    };
  }

  function buildAgentNode(u: (typeof agentUsers)[number]): AffiliateNetworkAgentNode | null {
    const prof = u.agentProfile;
    if (!prof?.id) return null;

    const agentProfileId = prof.id;
    const kind: "master_agent" | "sub_agent" = u.referredById ? "sub_agent" : "master_agent";

    const assignedPlayers = playersByAgentProfileId.get(agentProfileId) ?? [];
    let activePlayers = 0;
    const childPlayers: AffiliateNetworkPlayerNode[] = [];

    for (const p of assignedPlayers) {
      const node = buildPlayerNode(p, agentProfileId);
      childPlayers.push(node);
      if (node.isActive) activePlayers += 1;
    }

    const subs = (subAgentsByParentUserId.get(u.id) ?? [])
      .filter((s) => s.agentProfile?.id)
      .sort((a, b) => a.username.localeCompare(b.username));

    const childAgents: AffiliateNetworkAgentNode[] = [];
    let downstreamLoopingPlayers = childPlayers.filter((c) => c.loopSuspicion).length;

    for (const s of subs) {
      const subNode = buildAgentNode(s);
      if (subNode) {
        childAgents.push(subNode);
        downstreamLoopingPlayers += subNode.downstreamLoopingPlayers;
      }
    }

    const hasLoopRisk =
      downstreamLoopingPlayers > 0 || childAgents.some((a) => a.hasLoopRisk);

    const children: (AffiliateNetworkAgentNode | AffiliateNetworkPlayerNode)[] = [
      ...childAgents,
      ...childPlayers.sort((a, b) => a.username.localeCompare(b.username)),
    ];

    return {
      kind,
      id: prof.id,
      userId: u.id,
      agentProfileId: prof.id,
      displayName: prof.fullName?.trim() || u.username,
      username: u.username,
      email: u.email,
      referredById: u.referredById,
      totalSales: Number(u.totalSales) || 0,
      activePlayers,
      bonusesClaimed: Number(u.bonusesClaimed) || 0,
      downstreamLoopingPlayers,
      hasLoopRisk,
      children,
    };
  }

  const roots = agentUsers
    .filter((u) => {
      if (!u.agentProfile?.id) return false;
      if (u.referredById == null) return true;
      return !validAgentIds.has(u.referredById);
    })
    .sort((a, b) => a.username.localeCompare(b.username));

  const trees: AffiliateNetworkAgentNode[] = [];
  for (const r of roots) {
    const node = buildAgentNode(r);
    if (node) trees.push(node);
  }

  return NextResponse.json({ trees });
}
