import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// 🟢 ضرورية فـ Next.js 15 باش الداتا ديما تكون جديدة
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    
    if (!prisma) {
      return NextResponse.json({ orders: [], message: "Database not available" }, { status: 500 });
    }

    // 1. جلب الطلبات من Prisma مع معلومات الوكيل واللاعب
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: "desc", // أحدث الطلبات هي الأولى
      },
      include: {
        agent: {
          select: {
            username: true,
            email: true,
            fullName: true,
          },
        },
        player: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // 2. تنسيق البيانات (اختياري) لضمان توافقها مع الـ Frontend القديم
    const formattedOrders = orders.map((order) => ({
      ...order,
      // تأكدنا من وجود أسماء الوكلاء واللاعبين حتى لو كانت الداتا ناقصة
      agentName: order.agent?.fullName || order.agent?.username || "Unknown Agent",
      playerName: order.player?.username || order.playerEmail || "Unknown Player",
    }));

    return NextResponse.json({ orders: formattedOrders });

  } catch (error) {
    console.error("GET ADMIN ORDERS ERROR:", error);
    return NextResponse.json(
      {
        message: "حدث خطأ أثناء جلب الطلبات من قاعدة البيانات.",
        orders: [],
      },
      { status: 500 }
    );
  }
}