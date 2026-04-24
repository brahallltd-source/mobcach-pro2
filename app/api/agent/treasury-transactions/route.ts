import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — list treasury top-up requests (`AgentTransaction`) for the signed-in agent.
 */
export async function GET() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { success: false, message: "Database unavailable" },
      { status: 500 }
    );
  }

  const user = await getSessionUserFromCookies();
  if (!user || String(user.role).trim().toUpperCase() !== "AGENT") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.agentTransaction.findMany({
    where: { agentId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    success: true,
    transactions: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      method: r.method,
      status: r.status,
      motif: r.motif,
      receiptUrl: r.receiptUrl,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
