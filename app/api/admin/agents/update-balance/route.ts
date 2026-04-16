import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, newBalance, reason } = await req.json();

    if (!agentId || newBalance === undefined) {
      return NextResponse.json({ message: "agentId و newBalance مطلوبان" }, { status: 400 });
    }

    // تحديث الرصيد في قاعدة البيانات
    const result = await prisma.$transaction(async (tx) => {
      // 1. تحديث المحفظة
      const updatedWallet = await tx.wallet.update({
        where: { agentId: agentId },
        data: { balance: parseFloat(newBalance) }
      });

      // 2. تسجيل العملية في الـ Ledger للشفافية
      await tx.walletLedger.create({
        data: {
          agentId,
          walletId: updatedWallet.id,
          type: "ADMIN_ADJUSTMENT",
          amount: parseFloat(newBalance),
          reason: reason || "تعديل يدوي من طرف الإدارة",
        }
      });

      return updatedWallet;
    });

    return NextResponse.json({ message: "تم تحديث الرصيد بنجاح ✅", balance: result.balance });
  } catch (error) {
    console.error("ADMIN WALLET UPDATE ERROR:", error);
    return NextResponse.json({ message: "فشل تحديث الرصيد" }, { status: 500 });
  }
}