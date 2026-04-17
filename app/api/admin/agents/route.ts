import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    const allAgentsMap = new Map();

    // 1️⃣ كنجبدو الوكلاء من جدول Agent (هنا فين كاينين الأغلبية ديالك)
    const agentRecords = await prisma.agent.findMany({
      include: { wallet: true, user: true },
      orderBy: { createdAt: "desc" }
    });

    agentRecords.forEach((a: any) => {
      const targetId = a.userId || a.id; // ضروري userId باش يخدم ليك المودباس والحذف
      allAgentsMap.set(targetId, {
        id: targetId,
        fullName: a.fullName || a.username || "بدون اسم",
        username: a.username,
        email: a.email,
        status: a.status || a.user?.status || "ACTIVE",
        availableBalance: a.wallet?.balance ?? a.availableBalance ?? 0,
        country: a.country || "MA"
      });
    });

    // 2️⃣ كنجبدو من جدول User (باش حتى إلى شي واحد ماعندوش بروفايل فـ Agent يبان)
    const userRecords = await prisma.user.findMany({
      where: {
        OR: [
          { role: "AGENT" },
          { role: "agent" },
          { role: "Agent" }
        ]
      },
      include: { wallet: true, agentProfile: true }
    });

    userRecords.forEach((u: any) => {
      if (!allAgentsMap.has(u.id)) {
        allAgentsMap.set(u.id, {
          id: u.id,
          fullName: u.agentProfile?.fullName || u.username || "بدون اسم",
          username: u.username,
          email: u.email,
          status: u.status || "ACTIVE",
          availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
          country: u.agentProfile?.country || "MA"
        });
      }
    });

    return NextResponse.json({ agents: Array.from(allAgentsMap.values()) });
  } catch (error) {
    console.error("FETCH AGENTS DB ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}