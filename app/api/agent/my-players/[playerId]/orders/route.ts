import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import { normalizeRechargeProofStatus, rechargeProofStatusLabelAr } from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgent(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  if (!session.agentProfile?.id) return null;
  return { session, agentProfileId: session.agentProfile.id, agentUserId: session.id };
}

/**
 * Player-scoped recharge history: `PaymentProofTransaction` for this agent user + player user.
 * (`AgentTransaction` is treasury-only and has no `playerId`.)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
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
      where: {
        id: playerId,
        assignedAgentId: ctx.agentProfileId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        phone: true,
        userId: true,
      },
    });

    if (!player) {
      return NextResponse.json({ message: "اللاعب غير موجود أو غير مرتبط بحسابك" }, { status: 404 });
    }

    const displayName =
      [player.firstName, player.lastName].filter(Boolean).join(" ").trim() || player.username;

    const [link, proofs] = await Promise.all([
      prisma.agentCustomer.findUnique({
        where: {
          agentId_playerId: { agentId: ctx.agentProfileId, playerId: player.id },
        },
        select: { totalRecharged: true },
      }),
      prisma.paymentProofTransaction.findMany({
        where: {
          agentUserId: ctx.agentUserId,
          playerUserId: player.userId,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalRecharged = Number(link?.totalRecharged ?? 0) || 0;

    const rows = proofs.map((r) => ({
      id: r.id,
      date: r.createdAt.toISOString(),
      amount: r.amount,
      status: r.status,
      statusLabel: rechargeProofStatusLabelAr(normalizeRechargeProofStatus(r.status)),
    }));

    return NextResponse.json({
      success: true,
      player: {
        id: player.id,
        displayName,
        username: player.username,
        phone: player.phone,
      },
      totalRecharged,
      recharges: rows,
    });
  } catch (e) {
    console.error("my-players orders GET:", e);
    return NextResponse.json({ message: "خطأ في الخادم" }, { status: 500 });
  }
}
