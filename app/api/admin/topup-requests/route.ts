export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    // 1. جلب الطلبات بدون include لتفادي خطأ TypeScript
    const requests = await prisma.rechargeRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // 2. استخراج معرفات الوكلاء (agentIds) من الطلبات
    const agentIds = [...new Set(requests.map((r: any) => r.agentId))];

    // 3. جلب بيانات هؤلاء الوكلاء (للحصول على الـ username)
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, username: true },
    });

    // 4. تحويل بيانات الوكلاء إلى خريطة (Map) لتسهيل البحث
    const agentMap = agents.reduce((acc: any, agent: any) => {
      acc[agent.id] = agent;
      return acc;
    }, {});

    // 5. دمج الـ username مع كل طلب
    const formattedRequests = requests.map((req: any) => {
      const matchedAgent = agentMap[req.agentId];
      return {
        ...req,
        // إذا وجد الوكيل نضع اسمه، وإلا نستخدم بداية الإيميل كاحتياط
        agentUsername: matchedAgent?.username || (req.agentEmail ? req.agentEmail.split("@")[0] : ""),
        agentEmail: req.agentEmail || "",
      };
    });

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    console.error("GET ADMIN TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ message: "خطأ في جلب الطلبات من قاعدة البيانات", requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    const body = await req.json();
    const { requestId, action, adminEmail, transfer_reference, admin_note } = body;

    if (!requestId || !action) {
      return NextResponse.json({ message: "requestId and action are required" }, { status: 400 });
    }

    const requestRow = await prisma.rechargeRequest.findUnique({
      where: { id: requestId },
    });

    if (!requestRow) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }
    if (requestRow.status !== "pending") {
      return NextResponse.json({ message: "الطلب تمت معالجته مسبقاً" }, { status: 400 });
    }

    let updatedRequest;

    if (action === "approve") {
      const baseAmount = Number(requestRow.amount);
      const bonusAmount = Math.floor(baseAmount * 0.1);

      updatedRequest = await prisma.$transaction(async (tx) => {
        // تحديث الرصيد
        await tx.wallet.update({
          where: { agentId: requestRow.agentId },
          data: { balance: { increment: baseAmount + bonusAmount } },
        });

        // تطبيق البونص
        const pendingApplied = await applyPendingBonusesToRecharge(requestRow.agentId, adminEmail);

        // تحديث حالة الطلب
        return tx.rechargeRequest.update({
          where: { id: requestId },
          data: {
            status: "approved",
            bonusAmount: bonusAmount,
            pendingBonusApplied: pendingApplied?.totalApplied || 0,
            updatedAt: new Date(),
          },
        });
      });

      await createNotification({
        targetRole: "agent",
        targetId: requestRow.agentId,
        title: "تمت الموافقة على شحن رصيدك",
        message: `تم تفعيل شحن ${requestRow.amount} DH. أضيفت لك مكافأة 10% (${bonusAmount} DH).`,
      });

    } else if (action === "reject") {
      updatedRequest = await prisma.rechargeRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          updatedAt: new Date(),
        },
      });

      await createNotification({
        targetRole: "agent",
        targetId: requestRow.agentId,
        title: "تم رفض طلب الشحن",
        message: `تم رفض طلب الشحن الخاص بك بقيمة ${requestRow.amount} DH من قبل الإدارة.`,
      });
    } else {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ message: `تمت الـ ${action} بنجاح`, request: updatedRequest });

  } catch (error) {
    console.error("PROCESS ADMIN TOPUP REQUEST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة العملية برمجياً" }, { status: 500 });
  }
}