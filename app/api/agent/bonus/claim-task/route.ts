import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });

    const rewardAmount = 50; // 💡 يمكنك تغيير قيمة مكافأة المهام من هنا

    // تحديث رصيد البونيس المعلق
    const profile = await prisma.agentBonusProfile.update({
      where: { agentId: String(agentId) },
      data: { pendingBonus: { increment: rewardAmount } }
    });

    // تسجيل العملية في السجل
    await prisma.pendingBonus.create({
      data: {
        agentId: String(agentId),
        source: "task_reward",
        sourceRef: `task_${Date.now()}`,
        amount: rewardAmount,
        status: "pending"
      }
    });

    return NextResponse.json({ message: "Task reward moved to pending bonus", task: profile });
  } catch (error: any) {
    console.error("CLAIM TASK REWARD ERROR:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 400 });
  }
}