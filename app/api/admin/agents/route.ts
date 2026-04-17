import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 🟢 بما أن الوكيل كيتكريا فجدول Agent، كنجبدوه من تما
    const agents = await prisma.agent.findMany({
      include: {
        user: true,   // باش نجيبو الباسورد والحالة
        wallet: true  // باش نجيبو الصولد
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = agents.map((a: any) => ({
      id: a.user.id, // 🟢 خطير: عطيناه User ID باش ملي الواجهة تبغي تبدل الباسورد، تلقاه
      agentId: a.id,
      fullName: a.fullName || a.username,
      username: a.username,
      email: a.email,
      status: a.user.status || "ACTIVE",
      availableBalance: a.wallet?.balance ?? a.availableBalance ?? 0,
      country: a.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error("FETCH AGENTS ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}