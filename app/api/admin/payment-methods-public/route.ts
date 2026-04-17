// 🟢 المسمار 1: منع الـ Caching باش الداتا تكون ديما جديدة
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
// 🟢 المسمار 2: استعمل Singleton Prisma (ما تخدمش بـ new PrismaClient هنا)
import { getPrisma } from "@/lib/db"; 

export async function GET() {
  try {
    const prisma = getPrisma();
    
    const methods = await prisma.paymentMethod.findMany({
      where: {
        ownerRole: "ADMIN",
        active: true, // تأكد بلي راهم ACTIVE فـ الداتابيز
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`🔍 Found ${methods.length} active methods for agents`);

    return NextResponse.json({
      methods: methods.map((item) => ({
        id: item.id,
        type: item.type,
        method_name: item.methodName,
        currency: item.currency,
        account_name: item.accountName,
        rib: item.rib,
        wallet_address: item.walletAddress,
        network: item.network,
        phone: item.phone,
        active: item.active,
      })),
    });
  } catch (error) {
    console.error("PUBLIC METHODS ERROR:", error);
    return NextResponse.json({ methods: [] }, { status: 500 });
  }
}