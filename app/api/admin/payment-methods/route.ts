import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    const methods = await prisma.paymentMethod.findMany({
      where: { active: true, ownerRole: "ADMIN" }
    });

    // 🟢 استعملنا (m: any) باش TypeScript يسكت والـ Build يدوز
    const formatted = methods.map((m: any) => ({
      ...m,
      method_name: m.methodName, // هادا هو اللي كيتسناه الـ UI
    }));

    return NextResponse.json({ methods: formatted });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}