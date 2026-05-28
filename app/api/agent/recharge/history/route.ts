import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { RECHARGE_PROOF_STATUS } from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `RechargeRequest.agentId` is always the agent’s `User.id` (same as `mobcash_user` / session `user.id`). */
async function resolveAgentUserId(): Promise<string | null> {
  const fromCookie = await getAgentFromMobcashUserCookie();
  if (fromCookie) return fromCookie.id;
  const user = await getSessionUserFromCookies();
  if (user && String(user.role).trim().toUpperCase() === "AGENT") {
    return user.id;
  }
  return null;
}

/**
 * GET /api/agent/recharge/history — wallet recharge requests for the signed-in agent.
 * Auth: `mobcash_user` cookie (preferred) or session JWT + DB user with role AGENT.
 */
export async function GET() {
  const currentAgentId = await resolveAgentUserId();
  if (!currentAgentId) {
    return NextResponse.json({ message: "Unauthorized", items: [] }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ items: [] });
  }

  try {
    const rows = await prisma.paymentProofTransaction.findMany({
      where: {
        agentUserId: currentAgentId,
        status: {
          in: [
            RECHARGE_PROOF_STATUS.AGENT_APPROVED,
            RECHARGE_PROOF_STATUS.AGENT_REJECTED,
            RECHARGE_PROOF_STATUS.AUTO_APPROVED,
            "APPROVED",
            "REJECTED",
            "AUTO_APPROVED",
          ],
        },
      },
      include: {
        playerUser: {
          select: {
            id: true,
            player: {
              select: {
                goSportId: true,
                gosportUsername: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const items = rows.map((r) => {
      const statusUpper = String(r.status ?? "").trim().toUpperCase();
      const status =
        statusUpper === RECHARGE_PROOF_STATUS.AUTO_APPROVED
          ? "AUTO_APPROVED"
          : statusUpper === RECHARGE_PROOF_STATUS.AGENT_REJECTED || statusUpper === "REJECTED"
            ? "REJECTED"
            : "APPROVED";
      const playerId =
        String(
          r.playerUser?.player?.goSportId ??
            r.playerUser?.player?.gosportUsername ??
            r.playerUser?.id ??
            "",
        ).trim() || "—";

      return {
        id: r.id,
        playerId,
        amount: r.amount,
        status,
        proofUrl: r.receiptUrl || null,
        decisionAt: r.updatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/agent/recharge/history:", e);
    return NextResponse.json(
      { message: "Failed to load history", items: [] },
      { status: 500 }
    );
  }
}
