import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ message: "agentId is required", count: 0 }, { status: 400 });
    }

    // حساب عدد اللاعبين اللي تابعين لهاد الوكيل
    // ملاحظة: استعملنا assignedAgentId حيت هو اللي كيربط اللاعب بالوكيل في السكيما ديالك
    const count = await prisma.player.count({
      where: {
        assignedAgentId: agentId,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("MY PLAYERS COUNT ERROR:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}