import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const prisma = getPrisma();
    
    // 🟢 استخراج id من الـ Promise (ضروري في Next.js 15)
    const resolvedParams = await params;
    const orderId = resolvedParams.id;
    
    const body = await req.json();
    const { note, reportedByRole, reporterId } = body;

    if (!note || !reportedByRole) {
      return NextResponse.json({ message: "المرجو كتابة سبب الإبلاغ" }, { status: 400 });
    }

    // التأكد من وجود الطلب
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }

    // تنفيذ العملية في Transaction
    await prisma.$transaction(async (tx) => {
      // 1. تغيير حالة الطلب
      await tx.order.update({
        where: { id: orderId },
        data: { 
          status: "flagged_for_review",
          reviewRequired: true,
          reviewReason: note
        },
      });

      // 2. تسجيل البلاغ
      await tx.fraudFlag.create({
        data: {
          orderId: orderId,
          type: `manual_flag_by_${reportedByRole}`,
          note: `[بواسطة: ${reportedByRole}] - ${note}`,
          score: 100, 
          resolved: false,
        },
      });
    });

    await notifyAllActiveAdmins({
      title: "🚨 طلب مشبوه جديد",
      message: `تم الإبلاغ عن الطلب بقيمة ${order.amount} DH. السبب: ${note}`,
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