import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgent(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  if (!session.agentProfile?.id) return null;
  return { session, agentProfileId: session.agentProfile.id, agentUserId: session.id };
}

/**
 * Agent removes an active linked player: clears `assignedAgentId` on `Player` + `User`,
 * removes `AgentCustomer` rows for this pair, and notifies the player.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const ctx = requireAgent(session);
    if (!ctx) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, ctx.agentUserId);
    if (suspended) return suspended;

    const player = await prisma.player.findFirst({
      where: { id: playerId, assignedAgentId: ctx.agentProfileId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!player?.user) {
      return NextResponse.json({ message: "Player not found or not linked to you" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.agentCustomer.deleteMany({
        where: { agentId: ctx.agentProfileId, playerId: player.id },
      });
      await tx.player.update({
        where: { id: player.id },
        data: { assignedAgentId: null, status: "inactive" },
      });
      await tx.user.update({
        where: { id: player.userId },
        data: {
          assignedAgentId: null,
          playerStatus: "inactive",
          status: "PENDING_AGENT",
        },
      });
      await tx.activation.deleteMany({ where: { playerUserId: player.userId } });
    });

    await createNotification({
      userId: player.user.id,
      title: "Agent unlinked",
      message: "Your agent removed the link. You can choose another agent from your dashboard.",
      type: "ALERT",
      link: "/player/dashboard",
    });

    return NextResponse.json({ success: true, message: "Player unlinked" });
  } catch (e) {
    console.error("POST /api/agent/my-players/[playerId]/unlink", e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
