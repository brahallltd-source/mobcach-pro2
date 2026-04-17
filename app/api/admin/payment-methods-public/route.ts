import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    // 🟢 الحل القطعي: كنجيبو كاع الطرق اللي Active بلا فلتر ديال Roles
    // هكا غايبانو للوكيل بزز كيفما كان نوعهم
    const methods = await prisma.paymentMethod.findMany({
      where: {
        active: true 
      }
    });

    // 🟢 الفينيسيون: كنأكدو أن الأسماء هي اللي كيتسنى الـ Frontend
    const formatted = methods.map(m => ({
      ...m,
      method_name: m.methodName || m.method_name, // جربهم بجوج باش ما نغلطوش
      id: m.id
    }));

    return NextResponse.json({ methods: formatted });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}