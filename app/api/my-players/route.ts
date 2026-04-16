import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const prisma = getPrisma();

  if (!agentId) return NextResponse.json({ count: 0, players: [] });

  // كنجيبو كاع اللاعبين اللي عندهم هاد الـ assignedAgentId
  const players = await prisma.player.findMany({
    where: { assignedAgentId: agentId },
    include: { user: true }
  });

  return NextResponse.json({ 
    count: players.length, 
    players: players 
  });
}