import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { normalizeRechargeProofStatus } from "@/lib/recharge-proof-lifecycle";
import { normalizeStoredPermissions } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canViewFinancials(session: NonNullable<Awaited<ReturnType<typeof getSessionUserFromCookies>>>): boolean {
  const roleU = String(session.role ?? "").trim().toUpperCase();
  if (roleU === "SUPER_ADMIN") return true;
  if (roleU !== "ADMIN") return false;
  const raw =
    "adminPermissions" in session && Array.isArray(session.adminPermissions)
      ? session.adminPermissions
      : [];
  const perms = normalizeStoredPermissions(raw);
  return perms.includes("VIEW_FINANCIALS");
}

/** Admin list of player recharge proof transactions (full lifecycle). */
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 503 });
    }

    const session = await getSessionUserFromCookies();
    if (!session || !canViewFinancials(session)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.paymentProofTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        agentUser: { select: { id: true, username: true, email: true } },
        playerUser: { select: { id: true, username: true, email: true } },
      },
    });

    const transactions = rows.map((r) => ({
      id: r.id,
      status: normalizeRechargeProofStatus(r.status),
      rawStatus: r.status,
      amount: r.amount,
      paymentMethod: r.paymentMethod ?? r.paymentMethodTitle,
      agentRejectReason: r.agentRejectReason,
      playerComment: r.playerComment,
      playerRating: r.playerRating,
      disputeMessage: r.disputeMessage,
      timerStartedAt: r.timerStartedAt?.toISOString() ?? null,
      isLatePenaltyApplied: r.isLatePenaltyApplied,
      createdAt: r.createdAt.toISOString(),
      agentUserId: r.agentUserId,
      playerUserId: r.playerUserId,
      agentUsername: r.agentUser.username,
      playerUsername: r.playerUser.username,
    }));

    return NextResponse.json({ transactions });
  } catch (e) {
    console.error("GET /api/admin/recharge-transactions", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
