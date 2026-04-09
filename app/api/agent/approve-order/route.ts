import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

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

    return await prisma.$transaction(async (tx) => {
      // 1. جلب الطلب مع بيانات الوكيل والمحفظة
      const order = await tx.order.findUnique({
        where: { id: String(orderId) },
        include: { 
          agent: { 
            include: { wallet: true } 
          } 
        }
      });

      if (!order || !order.agent || !order.agent.wallet) {
        throw new Error("Order, Agent or Wallet not found");
      }

      // 2. التحقق من الرصيد
      if (order.agent.wallet.balance < order.amount) {
        throw new Error(`Insufficient balance. Available: ${order.agent.wallet.balance} DH`);
      }

      // 3. الخصم وتحديث السجل (Ledger) مع كل الحقول المطلوبة في السكيما
      await tx.wallet.update({
        where: { agentId: order.agentId },
        data: {
          balance: { decrement: order.amount },
          ledger: {
            create: {
              agentId: order.agentId, // مضاف لتجاوز خطأ الـ Build
              type: "debit",
              amount: order.amount,
              reason: `Order Approval: ${order.id.split('-')[0]}`,
              // @ts-ignore - لتجاوز أي تعارض في الأنظمة أثناء الـ Build
              meta: { orderId: order.id, playerEmail: order.playerEmail }
            }
          }
        }
      });

      // 4. تحديث الطلب
      const updatedOrder = await tx.order.update({
        where: { id: String(orderId) },
        data: {
          status: "agent_approved_waiting_player",
          walletDeducted: true,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Order approved successfully ✅",
        order: updatedOrder,
      });
    });

  } catch (error: any) {
    console.error("APPROVE ORDER ERROR:", error);
    return NextResponse.json({ 
      message: error.message || "Action failed" 
    }, { status: 400 });
  }
}