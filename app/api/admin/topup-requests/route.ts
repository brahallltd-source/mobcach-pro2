export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db"; // تأكد من المسار الصحيح للـ prisma
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

// --- GET Function (نفس المنطق ديالك مع تنقية بسيطة) ---
export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const prisma = getPrisma();
    const requests = await prisma.rechargeRequest.findMany({ orderBy: { createdAt: "desc" } });
    const agentIds = [...new Set(requests.map((r: any) => r.agentId))];
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, username: true },
    });

    const agentMap = agents.reduce((acc: any, agent: any) => { acc[agent.id] = agent; return acc; }, {});

    const formattedRequests = requests.map((req: any) => ({
      ...req,
      agentUsername: agentMap[req.agentId]?.username || (req.agentEmail ? req.agentEmail.split("@")[0] : "N/A"),
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching requests" }, { status: 500 });
  }
}

// --- POST Function (المصلحة والناضية) ---
export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const prisma = getPrisma();
    const { requestId, action, adminEmail } = await req.json();
    const requestRow = await prisma.rechargeRequest.findUnique({ where: { id: requestId } });

    if (action === "approve" && requestRow) {
      const baseAmount = Number(requestRow.amount);
      const bonus10 = Math.floor(baseAmount * 0.1);

      await prisma.$transaction(async (tx) => {
        const pendingApplied = await applyPendingBonusesToRecharge(requestRow.agentId, adminEmail);
        const totalToAdd = baseAmount + bonus10 + (pendingApplied?.totalApplied || 0);

        await tx.wallet.update({
          where: { agentId: requestRow.agentId },
          data: { balance: { increment: totalToAdd } }
        });

        await tx.walletLedger.create({
          data: {
            walletId: (await tx.wallet.findUnique({ where: { agentId: requestRow.agentId } }))!.id,
            agentId: requestRow.agentId,
            amount: totalToAdd,
            type: "recharge_approved",
            reason: `Approve: ${baseAmount} + Bonus`,
            meta: { requestId }
          }
        });

        await tx.rechargeRequest.update({
          where: { id: requestId },
          data: { status: "approved", updatedAt: new Date() }
        });
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ status: 500 }); }
}