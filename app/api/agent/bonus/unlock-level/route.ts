import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, level } = await req.json();
    if (!agentId || !level) return NextResponse.json({ message: "agentId and level are required" }, { status: 400 });

    const rewardAmount = Number(level) * 100; // 💡 المستوى 2 = 200 درهم، المستوى 3 = 300 درهم...

    // إضافة المكافأة المعلقة
    const profile = await prisma.agentBonusProfile.update({
      where: { agentId: String(agentId) },
      data: { pendingBonus: { increment: rewardAmount } }
    });

    // تسجيل العملية
    await prisma.pendingBonus.create({
      data: {
        agentId: String(agentId),
        source: "level_unlock",
        sourceRef: `level_${level}`,
        amount: rewardAmount,
        status: "pending"
      }
    });

    return NextResponse.json({ message: "Level reward moved to pending bonus", claim: profile });
  } catch (error: any) {
    console.error("UNLOCK LEVEL REWARD ERROR:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 400 });
  }
}