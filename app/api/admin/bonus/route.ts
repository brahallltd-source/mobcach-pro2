import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب طلبات المكافآت (Claims/Rewards)
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ claims: [] }, { status: 500 });

    // جلب المكافآت المعلقة مع معلومات الوكيل
    const claims = await prisma.pendingBonus.findMany({
      orderBy: { createdAt: "desc" },
      // ملاحظة: بما أن PendingBonus ما عندوش Relation مباشرة مع Agent فـ الـ Schema
      // غادي نجيبو المعلومات الأساسية والـ Frontend غايدير الربط
    });

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("ADMIN BONUS GET ERROR:", error);
    return NextResponse.json({ message: "خطأ في جلب الطلبات", claims: [] }, { status: 500 });
  }
}

// 🔵 الموافقة أو الرفض (Approve/Reject)
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { claimId, action } = await req.json();

    if (!claimId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "البيانات المطلوبة ناقصة" }, { status: 400 });
    }

    // 1. البحث عن المكافأة
    const claim = await prisma.pendingBonus.findUnique({
      where: { id: claimId }
    });

    if (!claim) {
      return NextResponse.json({ message: "لم يتم العثور على المكافأة" }, { status: 404 });
    }

    if (claim.status === "applied" || claim.status === "claimed") {
      return NextResponse.json({ message: "هذه المكافأة تمت معالجتها مسبقاً" }, { status: 400 });
    }

    // 2. تنفيذ العملية فـ Transaction
    const result = await prisma.$transaction(async (tx) => {
      // أ. تحديث حالة المكافأة
      const updatedClaim = await tx.pendingBonus.update({
        where: { id: claimId },
        data: {
          status: action === "approve" ? "applied" : "locked", // حسب الـ Enum اللي عندك
          appliedAt: action === "approve" ? new Date() : null
        }
      });

      if (action === "approve") {
        // ب. جلب المحفظة
        const wallet = await tx.wallet.findUnique({
          where: { agentId: claim.agentId }
        });

        if (!wallet) throw new Error("Wallet not found for this agent");

        // ج. إضافة الرصيد للمحفظة
        await tx.wallet.update({
          where: { agentId: claim.agentId },
          data: { balance: { increment: claim.amount } }
        });

        // د. تسجيل العملية فـ الـ Ledger
        await tx.walletLedger.create({
          data: {
            agentId: claim.agentId,
            walletId: wallet.id,
            type: "BONUS",
            amount: claim.amount,
            reason: `Bonus Approved: ${claim.source || 'General Reward'}`,
            meta: { claimId: claim.id, sourceRef: claim.sourceRef }
          }
        });
      }

      return updatedClaim;
    });

    // 3. إرسال إشعار للوكيل
    await createNotification({
      targetRole: "agent",
      targetId: claim.agentId,
      title: action === "approve" ? "تم قبول المكافأة 🎁" : "تم رفض طلب المكافأة",
      message: action === "approve" 
        ? `مبروك! تم إضافة ${claim.amount} درهم لرصيدك كمكافأة.` 
        : `نعتذر، تم رفض طلبك للحصول على المكافأة المتعلقة بـ ${claim.source}.`
    });

    return NextResponse.json({
      message: action === "approve" ? "تم قبول المكافأة وإيداعها" : "تم رفض المكافأة بنجاح",
      claim: result
    });

  } catch (error: any) {
    console.error("ADMIN BONUS POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء معالجة العملية" }, { status: 500 });
  }
}