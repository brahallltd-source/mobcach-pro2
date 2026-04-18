import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    // 🟢 جلب طرق الدفع الخاصة بالآدمن (SYSTEM) لتظهر للوكلاء
    const methods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
        ownerRole: "ADMIN"
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ 
      methods: methods.map(m => ({
        id: m.id,
        method_name: m.methodName,
        account_name: m.accountName,
        rib: m.rib,
        wallet_address: m.walletAddress,
        type: m.type
      }))
    });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}