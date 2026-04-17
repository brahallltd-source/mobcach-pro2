import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { agentId, newBalance, reason } = await req.json();

    if (!agentId || newBalance === undefined) {
      return NextResponse.json({ message: "agentId و newBalance مطلوبان" }, { status: 400 });
    }

    const amount = parseFloat(newBalance);

    // تحديث الرصيد باستعمال upsert لضمان النجاح دائماً
    const result = await prisma.$transaction(async (tx) => {
      // 1. تحديث أو إنشاء المحفظة (Upsert)
      const updatedWallet = await (tx.wallet as any).upsert({
        where: { agentId: String(agentId) },
        update: { 
          balance: amount,
          updatedAt: new Date()
        },
        create: { 
          agentId: String(agentId), 
          balance: amount,
          // ربط العلاقات باش السيستيم يبقى متصل
          agent: { connect: { id: String(agentId) } },
          user: { connect: { id: String(agentId) } }
        }
      });

      // 2. تسجيل العملية في الـ Ledger
      await tx.walletLedger.create({
        data: {
          agentId: String(agentId),
          walletId: updatedWallet.id,
          type: "ADMIN_ADJUSTMENT", // تعديل إداري
          amount: amount,
          reason: reason || "تعديل يدوي من طرف الإدارة",
        }
      });

      return updatedWallet;
    });

    return NextResponse.json({ 
      success: true,
      message: "تم تحديث الرصيد بنجاح ✅", 
      balance: result.balance 
    });

  } catch (error: any) {
    console.error("ADMIN WALLET UPDATE ERROR:", error);
    return NextResponse.json({ 
      message: "فشل تحديث الرصيد: " + (error.message || "خطأ داخلي")
    }, { status: 500 });
  }
}