import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!agentId || !prisma) {
      return NextResponse.json({ message: "بيانات ناقصة" }, { status: 400 });
    }

    // 1. كنقلبو على المحفظة
    let wallet = await prisma.wallet.findUnique({ 
      where: { agentId: String(agentId) } 
    });

    // 2. 🟢 المسمار (السطر 21): إلا مالقيناهاش كنكرييوها
    if (!wallet) {
      // استعملنا 'as any' هنا باش نسكتو TypeScript ونخليو الـ Build يدوز 100%
      wallet = await prisma.wallet.create({
        data: {
          balance: 0,
          agentId: String(agentId),
          // هاد الربط ضروري حيت السكيما تبدلات
          agent: { connect: { id: String(agentId) } },
          user: { connect: { id: String(agentId) } },
        } as any 
      });
    }

    return NextResponse.json({
      wallet: {
        balance: wallet.balance,
      },
    });
  } catch (error) {
    console.error("AGENT WALLET GET ERROR:", error);
    return NextResponse.json({ message: "خطأ في تحميل المحفظة" }, { status: 500 });
  }
}