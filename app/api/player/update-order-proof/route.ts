import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma(); // تم تعريفه هنا كـ prisma 
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const body = await req.json();
    const { orderId, proof_url, proof_hash } = body;

    if (!orderId || !proof_url) {
      return NextResponse.json({ message: "Order ID and proof are required" }, { status: 400 });
    }

    // 1. تحديث الطلب (استخدمنا prisma بدلاً من db)
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        proofUrl: proof_url,
        proofHash: proof_hash,
        status: "proof_uploaded", // تم استخدامه من OrderStatus enum 
      },
    });

    // 2. إرسال رسالة نظام داخل الشات
    await prisma.orderMessage.create({
      data: {
        orderId: orderId,
        senderRole: "system",
        message: "Player has uploaded payment proof. Agent review required.",
      },
    });

    // 3. إشعار الوكيل
    createNotification({
      targetRole: "agent",
      targetId: updatedOrder.agentId,
      title: "Proof Uploaded",
      message: `Player has uploaded proof for order ${orderId.split('-')[0]}.`,
    });

    return NextResponse.json({
      success: true,
      message: "Order updated and agent notified.",
      order: updatedOrder
    });

  } catch (error) {
    console.error("UPDATE ORDER PROOF ERROR:", error);
    return NextResponse.json({ message: "Failed to update order status" }, { status: 500 });
  }
}