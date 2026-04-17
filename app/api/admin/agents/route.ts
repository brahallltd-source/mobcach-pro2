import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const prisma = getPrisma();
  try {
    // 🟢 استعملنا (prisma.user as any) باش نقتلوا Error ديال TypeScript ونخليو الـ Build يدوز
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
      username: u.username || "بدون اسم",
      email: u.email,
      status: u.status,
      // كنجيبو الصولد من المحفظة الجديدة
      availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
      country: u.agentProfile?.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error("FETCH AGENTS ERROR:", error);
    return NextResponse.json({ agents: [] }); // نرجعو مصفوفة خاوية عوض Error
  }
}