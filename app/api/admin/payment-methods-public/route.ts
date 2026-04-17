export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const prisma = getPrisma();

    // 🟢 المسمار 1: تعريف المتغير 'methods' (باش ما يبقاش يعطيك Cannot find name)
    const dbMethods = await prisma.paymentMethod.findMany({
      where: {
        active: true, // كنجيبو غير اللي خدامين
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // تنسيق البيانات لتتوافق مع الواجهة
    // ... داخل الـ map
const methods = dbMethods.map((item: any) => ({ // 🟢 زدنا 'any' هنا باش TypeScript يغمض عينيه
  id: item.id,
  type: item.type,
  method_name: item.methodName,
  currency: item.currency,
  account_name: item.accountName || "",
  rib: item.rib || "",
  wallet_address: item.walletAddress || "",
  network: item.network || "",
  phone: item.phone || "",
}));

    // 🟢 المسمار 2: الـ return خاصو يكون هنا (باش ما يوقعش Unreachable code)
    return NextResponse.json({ methods });

  } catch (error) {
    console.error("PUBLIC METHODS ERROR:", error);
    // هاد السطر غايخدم غير إلا وقع Error حقيقي
    return NextResponse.json({ methods: [] }, { status: 500 });
  }
}