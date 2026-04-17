import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const prisma = getPrisma();
  
  if (!prisma) {
    return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
  }

  try {
    // 🟢 المسمار: استعملنا include عوض select ودرنا (as any) باش TypeScript يسكت
    const users = await (prisma.user as any).findMany({
      where: { role: "AGENT" },
      include: {
        wallet: true,      // كنجيبو المحفظة
        agentProfile: true // كنجيبو البروفايل
      },
      orderBy: { createdAt: "desc" },
    });

    // تنسيق الداتا
    const formattedAgents = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      status: u.status,
      // 🟢 هنا فين كتحل العقدة: كنشوفو الصولد فـ Wallet هو الأول، إلا مالقيناهش كنشوفو AgentProfile
      availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
      country: u.agentProfile?.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });

  } catch (error: any) {
    console.error("Fetch agents error:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}