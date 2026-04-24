import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!agentId) {
      return NextResponse.json({ players: [] }, { status: 400 });
    }

    /** Same filter as dashboard `totalPlayers`: linked to this agent and active only. */
    const players = await prisma.player.findMany({
      where: {
        assignedAgentId: agentId,
        status: { in: ["active", "ACTIVE"] },
      },
      include: {
        user: {
          select: {
            email: true,
            username: true,
            createdAt: true
          }
        },
        // جلب آخر طلب شحن باش نعرفو النشاط ديال اللاعب
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // تنسيق الداتا باش الـ Frontend يقرأها بسهولة
    const formattedPlayers = players.map((p) => {
      const displayName =
        [p.firstName, p.lastName].filter(Boolean).join(" ").trim() ||
        p.username ||
        p.user.username;
      return {
        id: p.id,
        userId: p.userId,
        email: p.user.email,
        username: p.username || p.user.username,
        displayName,
        phone: p.phone,
        status: p.status,
        joinedAt: p.createdAt,
        lastOrderAmount: p.orders[0]?.amount || 0,
        totalOrders: p.orders.length,
      };
    });

    return NextResponse.json({ players: formattedPlayers });
  } catch (error) {
    console.error("MY PLAYERS API ERROR:", error);
    return NextResponse.json({ players: [], message: "Error fetching players" }, { status: 500 });
  }
}