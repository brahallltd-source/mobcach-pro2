import { NextResponse } from "next/server";
import { activeJsonPaymentLabels } from "@/lib/active-payment-labels";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { rejectAgentIfSuspended } from "@/lib/agent-account-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agentProfileIdFromSession(session: {
  role: string;
  agentProfile: { id: string } | null;
}): string | null {
  if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  return session.agentProfile?.id ?? null;
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const agentId = session ? agentProfileIdFromSession(session) : null;
    if (!session || !agentId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const suspended = await rejectAgentIfSuspended(prisma, session.id);
    if (suspended) return suspended;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const activePlayerWhere = {
      assignedAgentId: agentId,
      status: { in: ["active", "ACTIVE"] },
    };

    const [
      totalActivePlayers,
      pendingLinkRequests,
      todaySalesAgg,
      pendingPreview,
      recentAudits,
      wallet,
      agentRow,
    ] = await Promise.all([
      prisma.player.count({ where: activePlayerWhere }),
      prisma.agentCustomer.count({ where: { agentId, status: "PENDING" } }),
      prisma.order.aggregate({
        where: {
          agentId,
          status: "completed",
          createdAt: { gte: startOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.agentCustomer.findMany({
        where: {
          agentId,
          OR: [{ status: "PENDING" }, { status: "REQUESTED" }],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          player: { select: { id: true, username: true, phone: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: { userId: session.id, action: "AGENT_QUICK_RECHARGE" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.wallet.findFirst({
        where: { OR: [{ agentId }, { userId: session.id }] },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.agent.findUnique({
        where: { id: agentId },
        include: {
          user: {
            select: {
              likes: true,
              dislikes: true,
              executionTime: true,
              paymentMethods: true,
            },
          },
        },
      }),
    ]);

    const todaySalesDh = Number(todaySalesAgg._sum.amount ?? 0) || 0;
    const u = agentRow?.user;
    const likes = Number(u?.likes ?? 0) || 0;
    const dislikes = Number(u?.dislikes ?? 0) || 0;
    const totalVotes = likes + dislikes;
    const ratingPercent =
      totalVotes > 0 ? Math.round((likes / totalVotes) * 100) : 0;
    const executionTimeLabel =
      (typeof u?.executionTime === "string" && u.executionTime.trim()) ||
      `${agentRow?.responseMinutes ?? 30} min`;
    const paymentPills = activeJsonPaymentLabels(u?.paymentMethods);

    return NextResponse.json({
      success: true,
      walletBalance: Number(wallet?.balance ?? 0),
      stats: {
        totalPlayers: totalActivePlayers,
        pendingLinkRequests,
        todaySalesDh,
      },
      pendingPreview: pendingPreview.map((r) => ({
        id: r.id,
        playerId: r.playerId,
        username: r.player.username,
        phone: r.player.phone ?? "",
      })),
      recentRecharges: recentAudits.map((a) => {
        const meta = (a.meta && typeof a.meta === "object" ? a.meta : {}) as Record<string, unknown>;
        const amount = Number(meta.amount ?? 0) || 0;
        return {
          id: a.id,
          createdAt: a.createdAt.toISOString(),
          amount,
          playerId: String(a.entityId ?? ""),
        };
      }),
      marketplacePreview: {
        displayName: agentRow?.fullName || agentRow?.username || "—",
        likes,
        dislikes,
        ratingPercent,
        executionTimeLabel,
        paymentPills,
      },
    });
  } catch (e) {
    console.error("dashboard-home:", e);
    return NextResponse.json({ message: "خطأ في الخادم" }, { status: 500 });
  }
}
