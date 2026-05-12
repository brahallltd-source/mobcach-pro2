import { NextResponse } from "next/server";
import { FraudCategory } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const session = await getSessionUserFromCookies();
    const isAgent = String(session?.role ?? "").trim().toUpperCase() === "AGENT";
    const agentProfileId = session?.agentProfile?.id ? String(session.agentProfile.id) : "";
    if (!isAgent || !agentProfileId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;
    const suspended = await rejectAgentIfSuspended(prisma, String(session.id));
    if (suspended) return suspended;

    const { orderId, reason, fraudCategory } = await req.json();
    if (!orderId) {
      return NextResponse.json({ message: "orderId مطلوب" }, { status: 400 });
    }
    const reasonText = String(reason ?? "").trim();
    if (reasonText.length < 5) {
      return NextResponse.json({ message: "المرجو كتابة سبب واضح للإبلاغ (5 أحرف على الأقل)." }, { status: 400 });
    }
    const categoryRaw = String(fraudCategory ?? "").trim().toUpperCase();
    const category = Object.values(FraudCategory).includes(categoryRaw as FraudCategory)
      ? (categoryRaw as FraudCategory)
      : FraudCategory.SUSPICIOUS_ACTIVITY;

    // 1. فحص وجود الطلب ومعلوماته مع التحقق من ملكية الوكيل له.
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        amount: true,
        playerEmail: true,
        agentId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }
    if (String(order.agentId) !== agentProfileId) {
      return NextResponse.json({ message: "غير مصرح لك بالتبليغ عن هذا الطلب." }, { status: 403 });
    }

    // 2. التنفيذ داخل Transaction واحدة (تحديث الطلب + إنشاء نزاع + AI log).
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          isFlagged: true,
          flagReason: reasonText,
          fraudCategory: category,
          reviewRequired: true,
          reviewReason: reasonText,
          status: "UNDER_INVESTIGATION",
          updatedAt: new Date(),
        },
      });

      const aiSentinelLog = "AI Sentinel: Analyzing receipt metadata for tampering...";
      await tx.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "system",
          message: aiSentinelLog,
        },
      });

      const newDispute = await tx.dispute.create({
        data: {
          orderId: order.id,
          playerEmail: order.playerEmail,
          reason: reasonText,
          status: "pending",
        },
      });

      await tx.fraudFlag.create({
        data: {
          orderId: order.id,
          type: `agent_flag_${category}`,
          note: reasonText,
          score: category === FraudCategory.FAKE_RECEIPT ? 90 : category === FraudCategory.NON_RECEIPT ? 85 : 75,
          resolved: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: String(session.id),
          action: "AGENT_FLAGGED_ORDER_FRAUD",
          entityType: "Order",
          entityId: order.id,
          meta: {
            orderId: order.id,
            reason: reasonText,
            fraudCategory: category,
            aiSentinelLog,
          },
        },
      });

      return { updatedOrder, newDispute };
    });

    await notifyAllActiveAdmins({
      title: "🚨 High Priority Fraud Alert",
      message: `طلب ${order.id} تم وسمه كاحتيال (${category}). السبب: ${reasonText}.`,
      type: "ALERT",
      link: `/admin/fraud?orderId=${encodeURIComponent(order.id)}`,
    });

    return NextResponse.json({ 
      success: true,
      message: "تم إرسال البلاغ إلى الإدارة وتحويل الطلب إلى التحقيق بنجاح ✅", 
      order: result.updatedOrder 
    });

  } catch (error: any) {
    console.error("FLAG ORDER ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء محاولة التبليغ عن الطلب." 
    }, { status: 500 });
  }
}