import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 🟢 الضربة القاضية: كنجبدو أي يوزر يا إما عندو role ديال وكيل، أو ديجا تكريا ليه بروفايل فجدول Agent
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ["AGENT", "agent", "Agent"] } },
          { agentProfile: { isNot: null } }
        ]
      },
      include: {
        agentProfile: true, // كنجيبو معلوماتو من جدول Agent
        wallet: true        // كنجيبو الصولد من المحفظة
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = users.map((u: any) => {
      const profile = u.agentProfile;
      return {
        id: u.id, // 🟢 مهم جداً: كنعطيو الواجهة ID ديال User باش يقدر يبدل المودباس ويجمد الحساب
        fullName: profile?.fullName || u.username || "بدون اسم",
        username: profile?.username || u.username,
        email: profile?.email || u.email,
        status: u.status || "ACTIVE",
        availableBalance: u.wallet?.balance ?? profile?.availableBalance ?? 0,
        country: profile?.country || "Morocco"
      };
    });

    return NextResponse.json({ agents: formattedAgents });
  } catch (error: any) {
    console.error("FETCH AGENTS STRICT ERROR:", error.message);
    return NextResponse.json({ agents: [] });
  }
}