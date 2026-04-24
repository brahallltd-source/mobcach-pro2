import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

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
    const rows = await prisma.rechargeRequest.findMany({
      where: { agentId: currentAgentId },
      include: { paymentMethod: true },
      orderBy: { createdAt: "desc" },
    });

    const items = rows.map((r) => {
      const stored = Number(r.bonusAmount);
      const bonus =
        Number.isFinite(stored) && stored > 0
          ? stored
          : Math.floor(Number(r.amount) * 0.1);
      const methodLabel =
        r.paymentMethod?.methodName?.trim() ||
        r.adminMethodName?.trim() ||
        "—";

      return {
        id: r.id,
        amount: r.amount,
        bonus10: bonus,
        totalApprox: Number(r.amount) + bonus,
        methodLabel,
        adminMethodName: r.adminMethodName,
        status: r.status,
        proofUrl: r.proofUrl,
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
