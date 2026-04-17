import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 🟢 كنجيبو الداتا من جدول Agent ديريكت حيت هو اللي فيه كولشي
    const agents = await prisma.agent.findMany({
      include: {
        wallet: true,
        user: true
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = agents.map((a: any) => ({
      id: a.id,
      fullName: a.fullName,
      username: a.username,
      email: a.email,
      status: a.status, // ACTIVE أو SUSPENDED
      // 🟢 كنجيبو الصولد من المحفظة أولا، وإلا مالقيناهش كنجيبوه من القديم
      availableBalance: a.wallet?.balance || a.availableBalance || 0,
      country: a.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error("FETCH AGENTS ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}