import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    const methods = await prisma.paymentMethod.findMany({
      where: { active: true, ownerRole: "ADMIN" }
    });

    // 🟢 هنا فين زدنا المسمار باش يبان الاسم وعنوان الكريبتو
    const formatted = methods.map((m: any) => ({
      ...m,
      method_name: m.methodName,
      account_name: m.accountName,       // 🟢 باش يبان السمية ديال صاحب الـ RIB
      wallet_address: m.walletAddress,   // 🟢 باش يبان عنوان الكريبتو
    }));

    return NextResponse.json({ methods: formatted });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}