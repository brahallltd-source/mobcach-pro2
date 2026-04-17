import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const prisma = getPrisma();
  
  if (!prisma) {
    return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: "AGENT" },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        // 🟢 المسمار: بما أن wallet ما كايناش فـ User، غادي نعتمدو على 
        // availableBalance اللي كاينة وسط agentProfile كيفما كان عندك قبل
        agentProfile: {
          select: {
            country: true,
            availableBalance: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // تنسيق الداتا
    const formattedAgents = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      status: u.status,
      // كنجيبو الصولد من agentProfile حيت تما فين مخزون فـ السكيما ديالك
      availableBalance: u.agentProfile?.availableBalance || 0,
      country: u.agentProfile?.country || "MA"
    }));

    // 🟢 المسمار: صلحنا السّمية من formattedRequests لـ formattedAgents
    return NextResponse.json({ agents: formattedAgents });

  } catch (error: any) {
    console.error("Fetch agents error:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}