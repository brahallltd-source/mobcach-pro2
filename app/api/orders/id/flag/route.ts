import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const prisma = getPrisma();
    const orderId = params.id;
    const body = await req.json();
    const { note, reportedByRole, reporterId } = body;

    if (!note || !reportedByRole) {
      return NextResponse.json({ message: "المرجو كتابة سبب الإبلاغ" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. تغيير حالة الطلب
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { 
          status: "flagged_for_review",
          reviewRequired: true,
          reviewReason: note
        },
      });

      // 2. تسجيل التقرير (Flag) في قاعدة البيانات
      const flag = await tx.fraudFlag.create({
        data: {
          orderId: orderId,
          type: `manual_flag_by_${reportedByRole}`,
          note: `[بواسطة: ${reportedByRole}] - ${note}`,
          score: 100, // نعطيوها سكور طالع باش تبان للإدارة كحالة مستعجلة
          resolved: false,
        },
      });

      return { updatedOrder, flag };
    });

    // 3. إرسال إشعار للإدارة (ADMIN)
    await createNotification({
      targetRole: "admin",
      targetId: "admin", // أو ID ديال الإدارة يلا كان محدد
      title: "🚨 طلب مشبوه جديد",
      message: `تم الإبلاغ عن الطلب ${order.amount} DH من طرف ${reportedByRole}. السبب: ${note}`,
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم إرسال البلاغ للإدارة بنجاح وسيتم التدخل قريباً." 
    });

  } catch (error: any) {
    console.error("FLAG ORDER ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إرسال البلاغ" }, { status: 500 });
  }
}