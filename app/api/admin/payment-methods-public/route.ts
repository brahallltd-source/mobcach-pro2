import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // هادي باش نتفاداو مشاكل bcrypt اللي طالعين ف الـ build

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    // كنجيبو كاع الطرق اللي active
    const methods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
        ownerRole: "ADMIN"
      }
    });

    // 🟢 تحويل البيانات باش الـ Frontend يقرأ "method_name"
    const formatted = methods.map(m => ({
      ...m,
      method_name: (m as any).methodName, // استعملنا methodName ديال الداتابيز
      id: m.id
    }));

    console.log(`✅ Found ${formatted.length} admin methods`);
    return NextResponse.json({ methods: formatted });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}