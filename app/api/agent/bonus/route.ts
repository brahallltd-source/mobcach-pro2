import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });

    // البحث عن بروفايل البونيس
    let profile = await prisma.agentBonusProfile.findUnique({
      where: { agentId: String(agentId) }
    });

    // إذا كان الوكيل جديد ولم يتم إنشاء بروفايل له بعد
    if (!profile) {
      profile = await prisma.agentBonusProfile.create({
        data: {
          agentId: String(agentId),
          volume: 0,
          energy: 0,
          completedOrders: 0,
          pendingBonus: 0,
          bonusBalance: 0
        }
      });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET AGENT BONUS ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء جلب بيانات المكافآت." }, { status: 500 });
  }
}