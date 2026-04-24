import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVED_STATUSES = ["APPROVED", "approved"] as const;

/** Calendar day in UTC for `updatedAt` filters (stable across server TZ). */
function utcDayRange(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export type LedgerFeedItem = {
  id: string;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
  agentId: string;
  agentLabel: string;
};

export async function GET() {
  const access = await requireAdminPermission("VIEW_FINANCIALS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }

  const now = new Date();
  const { start: startOfTodayUtc, end: endOfTodayUtc } = utcDayRange(now);
  const signupsSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [
      salesTodayAgg,
      bonusTodayAgg,
      agentLiquidityAgg,
      pendingRechargeCount,
      newSignups24h,
      ledgerRows,
    ] = await Promise.all([
      prisma.rechargeRequest.aggregate({
        where: {
          status: { in: [...APPROVED_STATUSES] },
          updatedAt: { gte: startOfTodayUtc, lt: endOfTodayUtc },
        },
        _sum: { amount: true },
      }),
      prisma.rechargeRequest.aggregate({
        where: {
          status: { in: [...APPROVED_STATUSES] },
          updatedAt: { gte: startOfTodayUtc, lt: endOfTodayUtc },
        },
        _sum: { bonusAmount: true },
      }),
      // Agent balances live on `Wallet` (1:1 with `User`); sum balances for users with role AGENT.
      prisma.wallet.aggregate({
        where: {
          user: { role: { equals: "AGENT", mode: "insensitive" } },
        },
        _sum: { balance: true },
      }),
      prisma.rechargeRequest.count({
        where: { status: { in: ["PENDING", "pending"] } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: signupsSince } },
      }),
      prisma.walletLedger.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          wallet: {
            select: {
              userId: true,
              user: { select: { email: true, username: true, role: true } },
            },
          },
        },
      }),
    ]);

    const ledgerFeed: LedgerFeedItem[] = ledgerRows.map((row) => {
      const u = row.wallet?.user;
      const label =
        u != null
          ? `${String(u.username || "").trim() || "—"} · ${String(u.email || "").trim()}`
          : row.agentId;
      return {
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        agentId: row.agentId,
        agentLabel: label,
      };
    });

    const newUsers24h = newSignups24h;

    return NextResponse.json({
      realSalesTodayDh: Number(salesTodayAgg._sum.amount ?? 0),
      totalBonusTodayDh: Number(bonusTodayAgg._sum.bonusAmount ?? 0),
      agentLiquidityDh: Number(agentLiquidityAgg._sum.balance ?? 0),
      pendingRechargeCount,
      newSignups24h,
      newUsers24h,
      ledgerFeed,
      /** UTC day bounds used for “today” recharge aggregates (for debugging / UI tooltips). */
      metricsDayUtc: { start: startOfTodayUtc.toISOString(), end: endOfTodayUtc.toISOString() },
    });
  } catch (e) {
    console.error("GET /api/admin/dashboard-stats:", e);
    return NextResponse.json({ message: "Failed to load dashboard stats" }, { status: 500 });
  }
}
