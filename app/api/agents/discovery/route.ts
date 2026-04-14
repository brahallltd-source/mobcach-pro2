import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

// أضفنا هاد الأسطر باش ما يبقاش الكاش قديم واللاعب ديما يشوف الرصيد الجديد
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json({ agents: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        role: "AGENT",
        frozen: false,
        agentId: {
          not: null,
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        agentId: true,
      },
    });

    const agentIds = users
      .map((user) => user.agentId)
      .filter(Boolean) as string[];

    if (!agentIds.length) {
      return NextResponse.json({ agents: [] });
    }

    const agentProfiles = await prisma.agent.findMany({
      where: {
        id: { in: agentIds },
        status: "account_created",
      },
      include: {
        wallet: true, // ✅ أهم سطر: جلب المحفظة من قاعدة البيانات
      },
      orderBy: { updatedAt: "desc" },
    });

    const agents = agentProfiles.map((agent: any) => ({
      agentId: agent.id,
      display_name: agent.fullName || agent.username || agent.email,
      username: agent.username,
      email: agent.email,
      online: agent.online,
      rating: agent.rating,
      trades_count: agent.tradesCount,
      response_minutes: agent.responseMinutes,
      updated_at: agent.updatedAt,
      country: agent.country || "",
      // ✅ ربط الرصيد الحقيقي من جدول المحفظة ليظهر للاعب
      balance: agent.wallet?.balance || 0, 
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("AGENT DISCOVERY ERROR:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب قائمة الوكلاء", agents: [] },
      { status: 500 }
    );
  }
}