import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ agents: [] });

    // 🟢 كنجبدو فقط من الداتابيز (Prisma)
    const users = await (prisma.user as any).findMany({
      where: { role: "AGENT" },
      include: {
        wallet: true, // باش نجيبو الصولد الجديد
        agentProfile: true // باش نجيبو المعلومات القديمة إلا كاينة
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedAgents = users.map((u: any) => ({
      id: u.id,
      fullName: u.agentProfile?.fullName || u.username,
      username: u.username || "بدون اسم",
      email: u.email,
      status: u.status || "ACTIVE",
      // كنجيبو الصولد من المحفظة، وإلا مالقيناهش كنجيبوه من البروفايل، وإلا زيرو
      availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
      country: u.agentProfile?.country || "MA"
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error("FETCH AGENTS DB ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}