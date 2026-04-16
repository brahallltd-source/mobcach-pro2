import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });

    // التأكد من وجود طاقة كافية
    const profile = await prisma.agentBonusProfile.findUnique({
      where: { agentId: String(agentId) }
    });

    if (!profile || profile.energy < 100) {
      return NextResponse.json({ message: "طاقة غير كافية، تحتاج إلى 100 على الأقل." }, { status: 400 });
    }

    const rewardAmount = 50; // 💡 100 طاقة = 50 درهم بونيس (يمكنك تغييرها)

    // خصم الطاقة وإضافة البونيس المعلق
    const updatedProfile = await prisma.agentBonusProfile.update({
      where: { agentId: String(agentId) },
      data: {
        energy: { decrement: 100 },
        pendingBonus: { increment: rewardAmount }
      }
    });

    // تسجيل العملية
    await prisma.pendingBonus.create({
      data: {
        agentId: String(agentId),
        source: "energy_unlock",
        sourceRef: `energy_${Date.now()}`,
        amount: rewardAmount,
        status: "pending"
      }
    });

    return NextResponse.json({ message: "Energy reward moved to pending bonus", result: updatedProfile });
  } catch (error: any) {
    console.error("UNLOCK ENERGY REWARD ERROR:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 400 });
  }
}