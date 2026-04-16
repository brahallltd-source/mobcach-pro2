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
    const body = await req.json();
    const { requestId, action, adminEmail } = body;

    if (!requestId || !action) return NextResponse.json({ message: "Missing data" }, { status: 400 });

    const requestRow = await prisma.rechargeRequest.findUnique({ where: { id: requestId } });
    if (!requestRow || requestRow.status !== "pending") {
      return NextResponse.json({ message: "الطلب غير موجود أو تمت معالجته" }, { status: 404 });
    }

    let updatedRequest;

    if (action === "approve") {
      const baseAmount = Number(requestRow.amount);
      const bonus10Percent = Math.floor(baseAmount * 0.1);

      updatedRequest = await prisma.$transaction(async (tx) => {
        // 1. تطبيق البونص المعلق من المهام/Levels (إلا كان كاين)
        const pendingApplied = await applyPendingBonusesToRecharge(requestRow.agentId, adminEmail);
        const extraBonus = pendingApplied?.totalApplied || 0;

        const finalTotal = baseAmount + bonus10Percent + extraBonus;

        // 2. تحديث المحفظة (Wallet)
        const wallet = await tx.wallet.update({
          where: { agentId: requestRow.agentId },
          data: { balance: { increment: finalTotal } },
        });

        // 3. 🟢 تسجيل العملية في السجل (WalletLedger) - هادي هي اللي كانت ناقصاك!
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            agentId: requestRow.agentId,
            amount: finalTotal,
            type: "recharge_approved",
            reason: `شحن (Original: ${baseAmount} + 10% Bonus: ${bonus10Percent} + Extra: ${extraBonus})`,
            meta: { requestId, adminEmail }
          }
        });

        // 4. تحديث حالة الطلب
        return tx.rechargeRequest.update({
          where: { id: requestId },
          data: {
            status: "approved",
            bonusAmount: bonus10Percent,
            pendingBonusApplied: extraBonus,
            updatedAt: new Date(),
          },
        });
      });

      await createNotification({
        targetRole: "agent",
        targetId: requestRow.agentId,
        title: "تم شحن رصيدك بنجاح",
        message: `تمت إضافة ${baseAmount + bonus10Percent} DH إلى رصيدك. مبروك!`,
      });

    } else if (action === "reject") {
      updatedRequest = await prisma.rechargeRequest.update({
        where: { id: requestId },
        data: { status: "rejected", updatedAt: new Date() },
      });
      // إشعار بالرفض...
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error: any) {
    console.error("PROCESS ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}