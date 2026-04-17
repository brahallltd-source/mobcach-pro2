import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // باش نتفاداو صداع Bcrypt فـ الـ build

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    // كنجيبو كاع الطرق اللي active وتابعة للآدمين
    const methods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
        ownerRole: "ADMIN"
      }
    });

    // 🟢 الفينيسيون: كنرجعو الحقول بالسميات اللي كيتسنى الـ Frontend
    // استعملنا (m as any) باش TypeScript ما يحبسش الـ Build
    const formatted = methods.map((m: any) => ({
      ...m,
      method_name: m.methodName, // هادي هي اللي كتقلب عليها صفحة Recharge
      id: m.id
    }));

    return NextResponse.json({ methods: formatted });
  } catch (error) {
    console.error("PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json({ methods: [] });
  }
}