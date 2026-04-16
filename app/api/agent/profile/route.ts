import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const prisma = getPrisma();

  if (!agentId) return NextResponse.json({ status: "error" }, { status: 400 });

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true, username: true }
    });

    if (!agent) return NextResponse.json({ status: "not_found" }, { status: 404 });

    return NextResponse.json({ 
      status: agent.status, 
      username: agent.username 
    });
  } catch (error) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}