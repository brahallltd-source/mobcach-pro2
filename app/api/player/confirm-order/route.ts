import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ 
      where: { id: String(orderId) } 
    });

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.status !== "agent_approved_waiting_player") {
      return NextResponse.json({ message: "Order not ready for confirmation" }, { status: 400 });
    }

    // تنفيذ العملية كـ Transaction لضمان تزامن الحالة مع رسالة النظام
    const updated = await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة الطلب إلى Completed
      const upd = await tx.order.update({
        where: { id: String(orderId) },
        data: {
          status: "completed",
          updatedAt: new Date(),
        },
      });

      // 2. ✅ إضافة رسالة النظام النهائية في الشات (كما طلبت)
      await tx.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "system",
          message: `🏁 You’re approved, the order is completed.`,
        },
      });

      return upd;
    });

    const agentUserId = await getAgentUserIdByAgentProfileId(order.agentId);
    if (agentUserId) {
      await createNotification({
        userId: agentUserId,
        title: "تم إكمال الطلب ✅",
        message: `اللاعب أكد استلام الشحن للطلب رقم ${order.id.split("-")[0]}.`,
      });
    }

    return NextResponse.json({ 
      success: true,
      message: "Order completed successfully ✅", 
      order: updated 
    });

  } catch (error: any) {
    console.error("CONFIRM ORDER ERROR:", error);
    return NextResponse.json({ 
      message: error?.message || "حدث خطأ أثناء تأكيد الطلب. حاول مجدداً." 
    }, { status: 500 });
  }
}