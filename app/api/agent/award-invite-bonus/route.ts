import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database error" }, { status: 500 });

    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });

    // 1. جلب الدعوات (Referrals) الخاصة بهذا الوكيل
    const referrals = await prisma.referral.findMany({
      where: { referredByAgentId: String(agentId) }
    });

    if (referrals.length === 0) {
      return NextResponse.json({ message: "لا توجد دعوات مسجلة لهذا الوكيل" }, { status: 404 });
    }

    // 2. حساب إجمالي شحنات اللاعبين المدعوين من جدول الطلبات (Orders)
    // لأن جدول Referral عندك مافيهش حقل total_recharge، غانحسبوه من الـ Orders المكتملة
    const referredPlayerEmails = referrals.map(r => r.playerEmail);
    
    const orders = await prisma.order.findMany({
      where: {
        playerEmail: { in: referredPlayerEmails },
        status: "completed"
      },
      select: { amount: true }
    });

    const totalRechargeAmount = orders.reduce((sum, order) => sum + order.amount, 0);

    // 3. التحقق من الشرط (3000 درهم)
    if (totalRechargeAmount < 3000) {
      return NextResponse.json({ 
        message: `لم يتم بلوغ الحد الأدنى 3000 DH (الحالي: ${totalRechargeAmount} DH)` 
      }, { status: 400 });
    }

    // 4. التحقق واش المكافأة ديجا تعطات
    if (referrals.some(r => r.rewardStatus === "claimed")) {
      return NextResponse.json({ message: "تم منح مكافأة الدعوة مسبقاً" }, { status: 400 });
    }

    // 5. التحديث فـ Transaction
    const result = await prisma.$transaction(async (tx) => {
      const resolved = await resolveAgentWalletIds(tx, agentId);
      if (!resolved) throw new Error("Agent wallet keys not found");
      const wallet = await ensureAgentWallet(tx, resolved);

      // ب. زيادة الرصيد
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: 200 } }
      });

      // ج. تسجيل العملية فـ WalletLedger (بلاصة Transaction)
      await tx.walletLedger.create({
        data: {
          agentId: resolved.agentTableId,
          walletId: wallet.id,
          type: "CREDIT",
          amount: 200,
          reason: "Invite bonus: 3000 DH threshold reached",
          meta: { totalVolume: totalRechargeAmount }
        }
      });

      // د. تحديث حالة الـ Referrals
      await tx.referral.updateMany({
        where: { referredByAgentId: agentId },
        data: { rewardStatus: "claimed" }
      });

      return updatedWallet;
    });

    const agentUserId = await getAgentUserIdByAgentProfileId(agentId);
    if (agentUserId) {
      await createNotification({
        userId: agentUserId,
        title: "مكافأة دعوات اللاعبين ✅",
        message: "مبروك! حصلت على 200 درهم مكافأة مقابل نشاط لاعبيك المدعوين.",
      });
    }

    return NextResponse.json({ 
      success: true, 
      newBalance: result.balance,
      totalVolume: totalRechargeAmount 
    });

  } catch (error: any) {
    console.error("AWARD BONUS ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة المكافأة" }, { status: 500 });
  }
}