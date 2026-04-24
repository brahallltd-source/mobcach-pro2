import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const prisma = getPrisma();

  if (!agentId) return NextResponse.json({ count: 0, players: [] });

  // كنجيبو كاع اللاعبين اللي عندهم هاد الـ assignedAgentId
  const players = await prisma.player.findMany({
    where: { assignedAgentId: agentId },
    include: { user: { select: USER_SELECT_SAFE_RELATION } },
  });

  return NextResponse.json({ 
    count: players.length, 
    players: players 
  });
}