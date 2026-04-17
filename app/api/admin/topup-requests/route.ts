export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";

export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const prisma = getPrisma();
    const requests = await prisma.rechargeRequest.findMany({ orderBy: { createdAt: "desc" } });
    
    // نجلب معلومات الوكلاء
    const agentIds = [...new Set(requests.map((r: any) => r.agentId))];
    const agents = await prisma.agent.findMany({
      where: { OR: [{ id: { in: agentIds } }, { userId: { in: agentIds } }] },
      select: { id: true, userId: true, username: true },
    });

    const agentMap = agents.reduce((acc: any, agent: any) => { 
      acc[agent.id] = agent; 
      acc[agent.userId] = agent; 
      return acc; 
    }, {});

    const formattedRequests = requests.map((req: any) => ({
      ...req,
      agentUsername: agentMap[req.agentId]?.username || (req.agentEmail ? req.agentEmail.split("@")[0] : "N/A"),
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching requests", requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const prisma = getPrisma();
    const { requestId, action, adminEmail } = await req.json();
    
    // 1. نجلب الطلب أولاً
    const requestRow = await prisma.rechargeRequest.findUnique({ where: { id: requestId } });

    if (!requestRow) {
      return NextResponse.json({ success: false, message: "Request not found" });
    }

    if (requestRow.status !== "pending") {
      return NextResponse.json({ success: false, message: "هذا الطلب تمت معالجته مسبقاً" });
    }

    if (action === "approve") {
      const baseAmount = Number(requestRow.amount) || 0;
      const bonus10 = Math.floor(baseAmount * 0.1);

      await prisma.$transaction(async (tx) => {
        let pendingApplied = null;
        try {
          // جلب أي بونيس معلق
          pendingApplied = await applyPendingBonusesToRecharge(requestRow.agentId, adminEmail);
        } catch (e) {
          console.error("Bonus error", e);
        }
        
        const totalToAdd = baseAmount + bonus10 + (pendingApplied?.totalApplied || 0);

        // 🟢 الحل الجذري: نقلبو على المحفظة بـ agentId أو userId باش ما نزگلوهاش
        let wallet = await tx.wallet.findFirst({
          where: {
            OR: [
              { agentId: requestRow.agentId },
              { userId: requestRow.agentId }
            ]
          }
        });

        if (wallet) {
          // إذا كانت موجودة، نحدث الرصيد بناءً على id المحفظة المضمون
          wallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: totalToAdd }, updatedAt: new Date() }
          });
        } else {
          // إذا لم تكن موجودة نهائياً، نقوم بإنشائها
          wallet = await tx.wallet.create({
            data: {
              userId: requestRow.agentId, 
              balance: totalToAdd
            }
          });
        }

        // تسجيل العملية في الـ Ledger
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            agentId: requestRow.agentId,
            amount: totalToAdd,
            type: "recharge_approved",
            reason: `Approve: ${baseAmount} + Bonus`,
            meta: { requestId }
          }
        });

        // تحديث حالة الطلب لـ approved
        await tx.rechargeRequest.update({
          where: { id: requestId },
          data: { status: "approved", updatedAt: new Date() }
        });
      });

      return NextResponse.json({ success: true });
      
    } else if (action === "reject") {
      await prisma.rechargeRequest.update({
        where: { id: requestId },
        data: { status: "rejected", updatedAt: new Date() }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error: any) {
    console.error("TOPUP ADMIN ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}