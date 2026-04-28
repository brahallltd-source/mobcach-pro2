import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { createNotification } from "@/lib/notifications";

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

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: String(orderId) },
        include: {
          agent: {
            include: { wallet: true },
          },
        },
      });

      if (!order || !order.agent) {
        throw new Error("Order or Agent not found");
      }

      const resolved = await resolveAgentWalletIds(tx, order.agentId);
      if (!resolved) throw new Error("Agent wallet keys not found");
      const wallet = await ensureAgentWallet(tx, resolved);

      if (order.walletDeducted || order.status === "completed") {
        throw new Error("هذا الطلب تم تفعيله مسبقاً.");
      }
      if (!["proof_uploaded", "pending_payment"].includes(String(order.status))) {
        throw new Error("الطلب ليس في حالة قابلة للموافقة.");
      }

      if (Number(wallet.balance || 0) < order.amount) {
        throw new Error(`رصيدك غير كافٍ. المتوفر حالياً: ${wallet.balance} DH`);
      }
      const nextWalletBalance = Number(wallet.balance || 0) - Number(order.amount || 0);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: order.amount },
          ledger: {
            create: {
              agentId: order.agentId,
              type: "debit",
              amount: order.amount,
              reason: `شحن حساب GoSport365: ${order.gosportUsername}`,
              meta: {
                orderId: order.id,
                playerEmail: order.playerEmail,
                targetAccount: order.gosportUsername,
              },
            },
          },
        },
      });
      await tx.agent.update({
        where: { id: order.agentId },
        data: { availableBalance: nextWalletBalance },
      });

      const upd = await tx.order.update({
        where: { id: String(orderId) },
        data: {
          status: "agent_approved_waiting_player",
          walletDeducted: true,
          updatedAt: new Date(),
        },
      });

      await tx.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "system",
          message: `✅ Agent approved: Check your balance on gosport365.com.`,
        },
      });

      return { updatedOrder: upd, order };
    });

    const playerUser = await prisma.user.findFirst({
      where: {
        email: updatedOrder.order.playerEmail.trim().toLowerCase(),
        deletedAt: null,
        role: { equals: "PLAYER", mode: "insensitive" },
      },
      select: { id: true },
    });
    if (playerUser) {
      await createNotification({
        userId: playerUser.id,
        title: "تم شحن حسابك ✅",
        message: `الوكيل ${updatedOrder.order.agent.fullName} قام بتفعيل طلبك. تفقد حسابك الآن.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "تمت الموافقة بنجاح. المرجو إبلاغ اللاعب بتفقد حسابه.",
      order: updatedOrder.updatedOrder,
    });
  } catch (error: any) {
    console.error("APPROVE ORDER ERROR:", error);
    return NextResponse.json(
      {
        message: error.message || "حدث خطأ أثناء معالجة الطلب",
      },
      { status: 400 }
    );
  }
}
