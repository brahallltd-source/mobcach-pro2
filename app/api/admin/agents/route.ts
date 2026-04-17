import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 1️⃣ بحث كلاسيكي آمن فـ جدول User
    const users = await prisma.user.findMany({
      where: { role: "AGENT" },
      include: { agentProfile: true, wallet: true },
      orderBy: { createdAt: "desc" }
    });

    // 2️⃣ بحث كلاسيكي آمن فـ جدول Agent (احتياطي)
    const agentsTable = await prisma.agent.findMany({
      include: { user: true, wallet: true },
      orderBy: { createdAt: "desc" }
    });

    const allAgentsMap = new Map();

    // دمج النتائج بلا أخطاء
    users.forEach((u: any) => {
      allAgentsMap.set(u.id, {
        id: u.id,
        fullName: u.agentProfile?.fullName || u.username || "بدون اسم",
        username: u.username,
        email: u.email,
        status: u.status || "ACTIVE",
        availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
        country: u.agentProfile?.country || "Morocco"
      });
    });

    agentsTable.forEach((a: any) => {
      const uId = a.userId || a.id;
      if (!allAgentsMap.has(uId)) {
        allAgentsMap.set(uId, {
          id: uId,
          fullName: a.fullName || a.username || a.user?.username || "بدون اسم",
          username: a.username || a.user?.username,
          email: a.email || a.user?.email,
          status: a.user?.status || a.status || "ACTIVE",
          availableBalance: a.wallet?.balance ?? a.availableBalance ?? 0,
          country: a.country || "Morocco"
        });
      }
    });

    return NextResponse.json({ agents: Array.from(allAgentsMap.values()) });

  } catch (error: any) {
    console.error("CRITICAL FETCH ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}