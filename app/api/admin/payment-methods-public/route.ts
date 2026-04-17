export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] }, { status: 500 });

    // 🟢 المسمار: كنجيبو كاع طرق الدفع اللي "Active" بلا أي تعقيد
    const dbMethods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // تنسيق البيانات لتتوافق 100% مع واجهة الـ Recharge عند الوكيل
    const methods = dbMethods.map((item: any) => ({
      id: item.id,
      type: item.type,
      method_name: item.methodName,
      // 🟢 الحقول الضرورية اللي كانت ناقصة وبسبابها مابغاو يبانو للوكيل:
      provider: item.provider || item.methodName, // اسم البنك (CIH, USDT...)
      instructions: item.instructions || "",       // طريقة الدفع
      currency: item.currency || "MAD",
      account_name: item.accountName || "",
      account_number: item.accountNumber || "",
      rib: item.rib || "",
      wallet_address: item.walletAddress || "",
      network: item.network || "",
      phone: item.phone || "",
    }));

    return NextResponse.json({ methods });

  } catch (error) {
    console.error("PUBLIC METHODS ERROR:", error);
    return NextResponse.json({ methods: [] }, { status: 500 });
  }
}