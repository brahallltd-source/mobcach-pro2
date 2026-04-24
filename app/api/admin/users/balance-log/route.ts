import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Last manual balance adjustments for a user (`agentId` = target `User.id`). */
export async function GET(req: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ logs: [] }, { status: 503 });
  }

  const auth = await requirePermission("VIEW_FINANCIALS");
  if (!auth.ok) {
      return respondIfAdminAccessDenied(auth, { logs: [] });
    }

  const agentId = String(new URL(req.url).searchParams.get("agentId") ?? "").trim();
  if (!agentId) {
    return NextResponse.json({ message: "agentId query required", logs: [] }, { status: 400 });
  }

  try {
    const rows = await prisma.balanceLog.findMany({
      where: { agentId, type: "MANUAL_ADJUST" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        admin: { select: { email: true, username: true } },
      },
    });

    const logs = rows.map((r) => ({
      id: r.id,
      adminEmail: r.admin.email,
      adminUsername: r.admin.username,
      amount: r.amount,
      operation: r.operation,
      bonusApplied: r.bonusApplied,
      previousBalance: r.previousBalance,
      newBalance: r.newBalance,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ logs });
  } catch (e) {
    console.error("GET /api/admin/users/balance-log:", e);
    return NextResponse.json({ message: "Failed to load balance log", logs: [] }, { status: 500 });
  }
}
