import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    // 🟢 استعملنا (m: any) باش TypeScript ما يحبسش الـ Build نهائياً
    const formatted = methods.map((m: any) => ({
      ...m,
      method_name: m.methodName, 
      id: m.id
    }));

    return NextResponse.json({ methods: formatted });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}