import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 🟢 كنجبدو الوكلاء من جدول Agent (فين مسجلين بصح)
    const agents = await prisma.agent.findMany({
      include: {
        user: true,   // باش نجيبو الحالة ديالهم من User
        wallet: true  // باش نجيبو الصولد الجديد
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = agents.map((a: any) => ({
      id: a.userId, // 🟢 مهم جداً: صيفطنا userId باش الأزرار يقدرو يبدلو المودباس
      fullName: a.fullName || a.user?.username || "بدون اسم",
      username: a.username || a.user?.username,
      email: a.email || a.user?.email,
      status: a.user?.status || a.status || "ACTIVE",
      availableBalance: a.wallet?.balance ?? a.availableBalance ?? 0,
      country: a.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error("FETCH AGENTS ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}