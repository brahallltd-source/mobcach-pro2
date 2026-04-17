import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 🟢 كنقلبو فـ جدول User باش نجبدو القدام كاملين
    const users = await prisma.user.findMany({
      where: { role: "AGENT" },
      include: {
        wallet: true,
        agentProfile: true
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = users.map((u: any) => ({
      id: u.id, // كنصيفطو الـ ID القديم باش يخدمو بيه الأزرار
      fullName: u.agentProfile?.fullName || u.username,
      username: u.username || "بدون اسم",
      email: u.email,
      status: u.status || "ACTIVE",
      availableBalance: u.wallet?.balance || u.agentProfile?.availableBalance || 0,
      country: u.agentProfile?.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error("FETCH AGENTS ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}