import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json({ agents: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        role: "AGENT",
        frozen: false,
        agentId: {
          not: null,
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        agentId: true,
      },
    });

    const agentIds = users
      .map((user) => user.agentId)
      .filter(Boolean) as string[];

    if (!agentIds.length) {
      return NextResponse.json({ agents: [] });
    }

    const agentProfiles = await prisma.agent.findMany({
      where: {
        id: { in: agentIds },
        status: "account_created",
      },
      orderBy: { updatedAt: "desc" },
    });

    const agents = agentProfiles.map((agent) => ({
      agentId: agent.id,
      display_name: agent.fullName || agent.username || agent.email,
      username: agent.username,
      email: agent.email,
      online: agent.online,
      rating: agent.rating,
      trades_count: agent.tradesCount,
      response_minutes: agent.responseMinutes,
      updated_at: agent.updatedAt,
      country: agent.country || "",
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("AGENT DISCOVERY ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, agents: [] },
      { status: 500 }
    );
  }
}