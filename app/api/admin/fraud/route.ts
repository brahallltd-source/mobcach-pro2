import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, action, data } = await req.json();

    if (!agentId) return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });

    // 🟢 الحالة 1: تعديل الرصيد يدوياً (Manual Balance Adjustment)
    if (action === "update_balance") {
      const newBalance = parseFloat(data.balance);
      
      const result = await prisma.$transaction(async (tx) => {
        // 1. تحديث المحفظة
        const wallet = await tx.wallet.update({
          where: { agentId },
          data: { balance: newBalance }
        });

        // 2. تسجيل العملية فـ الـ Ledger باش يبان الآدمين شنو دار
        await tx.walletLedger.create({
          data: {
            agentId,
            walletId: wallet.id,
            type: "ADMIN_ADJUSTMENT",
            amount: newBalance,
            reason: data.reason || "تعديل يدوي من الإدارة",
          }
        });
        return wallet;
      });

      return NextResponse.json({ success: true, message: "تم تحديث الرصيد بنجاح ✅", balance: result.balance });
    }

    // 🔵 الحالة 2: تعديل المعلومات الشخصية (Email, Phone, Status)
    if (action === "update_profile") {
      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: {
          email: data.email,
          phone: data.phone,
          status: data.status, // ACTIVE, SUSPENDED, etc.
          fullName: data.fullName
        }
      });
      return NextResponse.json({ success: true, message: "تم تحديث بيانات الوكيل" });
    }

    return NextResponse.json({ message: "Action invalid" }, { status: 400 });

  } catch (error: any) {
    console.error("ADMIN AGENT UPDATE ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء التحديث" }, { status: 500 });
  }
}