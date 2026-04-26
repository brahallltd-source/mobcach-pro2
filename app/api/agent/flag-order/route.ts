import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { orderId, reason } = await req.json();
    if (!orderId) {
      return NextResponse.json({ message: "orderId مطلوب" }, { status: 400 });
    }

    // 1. فحص وجود الطلب ومعلوماته
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }

    // 2. التنفيذ فـ Transaction واحدة (تحديث الطلب + إنشاء نزاع)
    const result = await prisma.$transaction(async (tx) => {
      // أ. تحديث حالة الطلب
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          reviewRequired: true,
          reviewReason: reason || "Manual review requested",
          status: "flagged_for_review",
          updatedAt: new Date()
        }
      });

      // ب. إنشاء سجل نزاع (Dispute) جديد
      const newDispute = await tx.dispute.create({
        data: {
          orderId: order.id,
          playerEmail: order.playerEmail,
          reason: reason || "Manual review requested",
          status: "pending", // أو "open" حسب الـ Enum اللي عندك
        }
      });

      return { updatedOrder, newDispute };
    });

    await notifyAllActiveAdmins({
      title: "طلب مشبوه 🚩",
      message: `قام الوكيل بتبليغ عن الطلب ${order.id}. السبب: ${reason || "مراجعة يدوية"}.`,
    });

    return NextResponse.json({ 
      success: true,
      message: "تم إرسال الطلب للمراجعة وفتح نزاع بنجاح ✅", 
      order: result.updatedOrder 
    });

  } catch (error: any) {
    console.error("FLAG ORDER ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء محاولة التبليغ عن الطلب." 
    }, { status: 500 });
  }
}