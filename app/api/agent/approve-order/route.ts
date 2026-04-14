import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
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

      // حماية ضد الخصم المزدوج
      if (order.walletDeducted || order.status === "completed") {
        throw new Error("هذا الطلب تم تفعيله مسبقاً.");
      }

      // 2. التحقق من الرصيد الكافي قبل الخصم
      if (order.agent.wallet.balance < order.amount) {
        throw new Error(`رصيدك غير كافٍ. المتوفر حالياً: ${order.agent.wallet.balance} DH`);
      }

      // 3. خصم المبلغ من المحفظة وتحديث سجل العمليات (Ledger)
      await tx.wallet.update({
        where: { agentId: order.agentId },
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
                targetAccount: order.gosportUsername 
              }
            }
          }
        }
      });

      // 4. تحديث حالة الطلب للانتقال للمرحلة الثالثة
      const updatedOrder = await tx.order.update({
        where: { id: String(orderId) },
        data: {
          status: "agent_approved_waiting_player", 
          walletDeducted: true,
          updatedAt: new Date(),
        },
      });

      // 5. ✅ إضافة رسالة النظام الموحدة في الشات (كما طلبت)
      // هذه الرسالة ستظهر في تاريخ المحادثة بين الوكيل واللاعب
      await tx.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "system",
          message: `✅ Agent approved: Check your balance on gosport365.com.`,
        },
      });

      // 6. إرسال إشعار فوري للاعب
      await createNotification({
        targetRole: "player",
        targetId: order.playerEmail, // 👈 بدلها لهادي
        title: "تم شحن حسابك ✅",
        message: `الوكيل ${order.agent.fullName} قام بتفعيل طلبك. تفقد حسابك الآن.`,
      });

      return NextResponse.json({
        success: true,
        message: "تمت الموافقة بنجاح. المرجو إبلاغ اللاعب بتفقد حسابه.",
        order: updatedOrder,
      });
    });

  } catch (error: any) {
    console.error("APPROVE ORDER ERROR:", error);
    return NextResponse.json({ 
      message: error.message || "حدث خطأ أثناء معالجة الطلب" 
    }, { status: 400 });
  }
}