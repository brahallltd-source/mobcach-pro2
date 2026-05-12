import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary admin patch:
 * Ensure `Player.assignedAgentId` matches `AgentCustomer.agentId` for CONNECTED links.
 */
export async function GET() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
  }

  const auth = await requirePermission("MANAGE_USERS");
  if (!auth.ok) {
    return respondIfAdminAccessDenied(auth, { success: false });
  }

  try {
    const links = await prisma.agentCustomer.findMany({
      where: { status: "CONNECTED" },
      select: {
        id: true,
        agentId: true,
        playerId: true,
        player: { select: { assignedAgentId: true } },
      },
    });

    const toPatch = links.filter((link) => link.player.assignedAgentId !== link.agentId);

    if (toPatch.length > 0) {
      await prisma.$transaction(
        toPatch.map((link) =>
          prisma.player.update({
            where: { id: link.playerId },
            data: { assignedAgentId: link.agentId },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      scanned: links.length,
      updated: toPatch.length,
      patchedPlayerIds: toPatch.map((link) => link.playerId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Patch failed";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
