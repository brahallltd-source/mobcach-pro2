import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic"; // ضرورية فـ Next.js 15 باش مايديرش Cache

export async function GET() {
  const prisma = getPrisma();

  try {
    console.log("🔍 Fetching all agents from Agent table...");

    // 🟢 الطريقة الأضمن: كنجيبو من جدول Agent وديرو Include لليوزر
    const agents = await prisma.agent.findMany({
      include: {
        user: {
          select: {
            email: true,
            username: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // تنسيق البيانات باش الـ Frontend يلقى كولشي واجد فـ بلاصتو
    const formattedAgents = agents.map((agent: any) => ({
      id: agent.id,
      username: agent.username || agent.user?.username || "N/A",
      email: agent.email || agent.user?.email || "N/A",
      status: agent.status,
      availableBalance: agent.availableBalance || 0,
      createdAt: agent.createdAt,
    }));

    // ⚠️ رد البال: الـ Frontend غالباً كيتسنى { agents: [] } ماشي المصفوفة نيشان
    return NextResponse.json({ agents: formattedAgents });
    
  } catch (error: any) {
    console.error("🔥 Error fetching agents:", error.message);
    return NextResponse.json(
      { error: "تعذر جلب قائمة الوكلاء", details: error.message },
      { status: 500 }
    );
  }
}