import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available", players: [] }, { status: 500 });
    }

    // 1. جلب اللاعبين مع معلومات الحساب (User) فـ استعلام واحد
    const players = await prisma.player.findMany({
      include: {
        user: {
          select: {
            email: true,
            frozen: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 2. تنسيق البيانات باش الـ Frontend يبقى خدام بـ نفس السميات (Snake Case)
    const rows = players.map((player) => ({
      id: player.id,
      user_id: player.userId,
      email: player.user?.email || "",
      first_name: player.firstName || "",
      last_name: player.lastName || "",
      status: player.status || "inactive",
      assigned_agent_id: player.assignedAgentId || "",
      created_at: player.createdAt || player.user?.createdAt || "",
      // الحساب كيتعتبر مجمد إلا كان اليوزر مجمد
      frozen: Boolean(player.user?.frozen),
    }));

    return NextResponse.json({ players: rows });
  } catch (error) {
    console.error("ADMIN PLAYERS GET ERROR:", error);
    return NextResponse.json(
      {
        message: "حدث خطأ أثناء جلب قائمة اللاعبين من قاعدة البيانات.",
        players: [],
      },
      { status: 500 }
    );
  }
}