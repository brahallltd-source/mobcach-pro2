import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransferBody = {
  playerUserId?: unknown;
  newAgentUserId?: unknown;
};

function asId(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
  }

  const auth = await requirePermission("MANAGE_USERS");
  if (!auth.ok) {
    return respondIfAdminAccessDenied(auth, { success: false });
  }

  let body: TransferBody;
  try {
    body = (await request.json()) as TransferBody;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const playerUserId = asId(body.playerUserId);
  const newAgentUserId = asId(body.newAgentUserId);

  if (!playerUserId || !newAgentUserId) {
    return NextResponse.json(
      { success: false, message: "playerUserId and newAgentUserId are required" },
      { status: 400 },
    );
  }
  if (playerUserId === newAgentUserId) {
    return NextResponse.json(
      { success: false, message: "Player and agent cannot be the same user" },
      { status: 400 },
    );
  }

  const [playerUser, targetAgent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: playerUserId },
      select: {
        id: true,
        role: true,
        email: true,
        username: true,
        assignedAgentId: true,
        agentId: true,
        player: {
          select: {
            id: true,
            userId: true,
            assignedAgentId: true,
          },
        },
      },
    }),
    prisma.agent.findUnique({
      where: { userId: newAgentUserId },
      select: {
        id: true,
        userId: true,
        username: true,
      },
    }),
  ]);

  if (!playerUser || !playerUser.player) {
    return NextResponse.json({ success: false, message: "Player not found" }, { status: 404 });
  }
  if (String(playerUser.role).trim().toUpperCase() !== "PLAYER") {
    return NextResponse.json({ success: false, message: "Target user is not a player" }, { status: 400 });
  }
  if (!targetAgent) {
    return NextResponse.json({ success: false, message: "Target agent not found" }, { status: 404 });
  }

  const oldAgentId =
    playerUser.player.assignedAgentId ??
    playerUser.assignedAgentId ??
    playerUser.agentId ??
    null;

  if (oldAgentId === targetAgent.id) {
    return NextResponse.json({ success: true, message: "Player already linked to this agent" });
  }

  const playerId = playerUser.player.id;

  try {
    await prisma.$transaction(async (tx) => {
      // Prefer the old-link row; fallback to the oldest link for this player.
      const oldLink = await tx.agentCustomer.findFirst({
        where: oldAgentId ? { playerId, agentId: oldAgentId } : { playerId },
        orderBy: { createdAt: "asc" },
        select: { id: true, agentId: true },
      });

      if (!oldLink) {
        throw new Error("Existing AgentCustomer link not found for this player");
      }

      // Guard against unique(agentId, playerId) collision before re-pointing the row.
      const existingForTarget = await tx.agentCustomer.findFirst({
        where: { playerId, agentId: targetAgent.id },
        select: { id: true },
      });
      if (existingForTarget && existingForTarget.id !== oldLink.id) {
        throw new Error("Player already has an AgentCustomer record for the target agent");
      }

      await tx.user.update({
        where: { id: playerUserId },
        data: {
          assignedAgentId: targetAgent.id,
          agentId: targetAgent.id,
        },
      });

      await tx.player.update({
        where: { userId: playerUserId },
        data: { assignedAgentId: targetAgent.id },
      });

      await tx.agentCustomer.update({
        where: { id: oldLink.id },
        data: { agentId: targetAgent.id },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "ADMIN_TRANSFER_PLAYER_TO_AGENT",
          entityType: "AgentCustomer",
          entityId: oldLink.id,
          meta: {
            playerUserId,
            playerId,
            playerEmail: playerUser.email,
            playerUsername: playerUser.username,
            oldAgentId: oldAgentId ?? oldLink.agentId ?? null,
            newAgentId: targetAgent.id,
            newAgentUserId: targetAgent.userId,
            newAgentUsername: targetAgent.username,
          },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    const status = /already has an AgentCustomer record/i.test(message) ? 409 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }

  return NextResponse.json({
    success: true,
    message: "Player transferred successfully",
  });
}

