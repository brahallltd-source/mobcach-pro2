import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    const agents = await (prisma.user as any).findMany({
      where: { role: "AGENT" },
      include: {
        wallet: true,
        agentProfile: true
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = agents.map((u: any) => ({
      id: u.id,
      fullName: u.agentProfile?.fullName || u.username,
      username: u.username || "بدون اسم",
      email: u.email,
      status: u.status || "ACTIVE",
      availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
      country: u.agentProfile?.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    return NextResponse.json({ agents: [] });
  }
}