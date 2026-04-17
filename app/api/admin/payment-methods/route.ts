import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    const methods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
        ownerRole: "ADMIN" 
      }
    });

    // 🟢 تحويل البيانات باش الـ Frontend يفهمها (method_name)
    const formatted = methods.map(m => ({
      ...m,
      method_name: m.methodName || m.method_name, 
      id: m.id
    }));

    return NextResponse.json({ methods: formatted });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}