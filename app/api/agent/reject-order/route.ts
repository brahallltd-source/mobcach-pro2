import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  const prisma = getPrisma();
  const { orderId, reason } = await req.json();

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة الطلب
      await tx.order.update({
        where: { id: orderId },
        data: { status: "cancelled" }
      });

      // 2. إرسال سبب الإلغاء كرسالة شات
      await tx.orderMessage.create({
        data: {
          orderId,
          senderRole: "agent",
          message: `❌ تم رفض طلبك للسبب التالي: ${reason}`
        }
      });

      return NextResponse.json({ success: true });
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}