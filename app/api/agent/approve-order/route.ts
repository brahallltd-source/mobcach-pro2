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

    // استخدام Transaction لضمان أن جميع العمليات المالية تتم معاً أو تفشل معاً
    return await prisma.$transaction(async (tx) => {
      
      // 1. جلب الطلب مع محفظة الوكيل
      const order = await tx.order.findUnique({ 
        where: { id: String(orderId) },
        include: { agent: { include: { wallet: true } } }
      });

      if (!order) throw new Error("Order not found");
      if (!order.agent.wallet) throw new Error("Agent wallet not found");

      // 2. التحقق من الحالة ومنع الخصم المزدوج
      if (order.status !== "proof_uploaded") {
        throw new Error("Order must be in proof_uploaded state to approve");
      }
      if (order.walletDeducted) {
        throw new Error("Funds already deducted for this order");
      }

      // 3. التحقق من كفاية الرصيد (Available Balance)
      if (order.agent.wallet.balance < order.amount) {
        throw new Error(`Insufficient balance. Available: ${order.agent.wallet.balance} DH`);
      }

      // 4. الخصم من المحفظة وتحديث سجل العمليات (Ledger)
      const updatedWallet = await tx.wallet.update({
        where: { agentId: order.agentId },
        data: {
          balance: { decrement: order.amount },
          ledger: {
            create: {
              type: "debit",
              amount: order.amount,
              reason: `Order Approval: ${order.id.split('-')[0]}`,
              meta: { orderId: order.id, playerEmail: order.playerEmail }
            }
          }
        }
      });

      // 5. تحديث حالة الطلب وعلامة الخصم المالي
      const updatedOrder = await tx.order.update({
        where: { id: String(orderId) },
        data: {
          status: "agent_approved_waiting_player",
          walletDeducted: true,
          updatedAt: new Date(),
        },
      });

      // 6. تحديث إحصائيات الوكيل (Trades Count)
      await tx.agent.update({
        where: { id: order.agentId },
        data: { tradesCount: { increment: 1 } }
      });

      // 7. إرسال الإشعارات
      const playerUser = await tx.user.findFirst({ where: { email: order.playerEmail, role: "PLAYER" } });
      if (playerUser) {
        await createNotification({
          targetRole: "player",
          targetId: playerUser.id,
          title: "Order Approved ✅",
          message: `Your agent approved your ${order.amount} DH recharge. Please confirm receipt.`,
        });
      }

      return NextResponse.json({
        message: "Order approved & balance deducted successfully ✅",
        order: updatedOrder,
      });
    });

  } catch (error: any) {
    console.error("APPROVE ORDER TRANSACTION ERROR:", error);
    return NextResponse.json({ 
      message: error.message || "Something went wrong during approval." 
    }, { status: 400 });
  }
}