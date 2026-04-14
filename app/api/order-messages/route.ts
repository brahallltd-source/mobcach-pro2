import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// دالة لتنسيق الرسالة
function mapMessage(msg: any) {
  return {
    id: msg.id,
    senderRole: msg.senderRole,
    message: msg.message,
    created_at: msg.createdAt,
    orderId: msg.orderId, // باش نعرفو كل رسالة تابعة لأي طلب إذا بغينا
  };
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ messages: [], conversations: [] });

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const playerEmail = searchParams.get("playerEmail")?.toLowerCase();
    const agentId = searchParams.get("agentId");
    const listRole = searchParams.get("listRole"); // 'player' or 'agent'
    const userEmail = searchParams.get("userEmail")?.toLowerCase();

    // 1. جلب قائمة المحادثات (Conversations List)
    if (listRole && userEmail) {
      const orders = await prisma.order.findMany({
        where: listRole === 'player' ? { playerEmail: userEmail } : { agentId: userEmail }, // افتراضياً هنا
        select: {
          agentId: true,
          playerEmail: true,
          gosportUsername: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });
      // منطق تجميع المحادثات الفريدة (Unique Conversations)
      // يمكن تطويره لاحقاً لجلب أسماء الوكلاء/اللاعبين
      return NextResponse.json({ conversations: orders });
    }

    // 2. جلب التاريخ الموحد (Unified History) بين لاعب ووكيل معين
    if (playerEmail && agentId) {
      const allOrdersBetweenThem = await prisma.order.findMany({
        where: {
          playerEmail: playerEmail,
          agentId: agentId
        },
        include: {
          messages: true
        }
      });

      // جمع كاع الرسائل من كاع الأوردرات اللي بيناتهم
      const allMessages = allOrdersBetweenThem
        .flatMap(order => order.messages)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return NextResponse.json({ 
        messages: allMessages.map(mapMessage),
        count: allMessages.length 
      });
    }

    // 3. الحالة القديمة: جلب رسائل طلب واحد (للتوافق مع الكود القديم)
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });
      return NextResponse.json({ 
        order: { id: order.id, status: order.status, amount: order.amount }, 
        messages: order.messages.map(mapMessage) 
      });
    }

    return NextResponse.json({ message: "Missing parameters" }, { status: 400 });

  } catch (error) {
    console.error("GET MESSAGES ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database error" }, { status: 500 });

    const body = await req.json();
    const { orderId, senderRole, message, playerEmail, agentId } = body;

    let targetOrderId = orderId;

    // "الخطة الذكية": إذا لم يرسل الـ orderId، نبحث عن آخر طلب نشط بينهما
    if (!targetOrderId && playerEmail && agentId) {
      const lastOrder = await prisma.order.findFirst({
        where: { playerEmail, agentId },
        orderBy: { createdAt: 'desc' }
      });
      targetOrderId = lastOrder?.id;
    }

    if (!targetOrderId || !senderRole || !message) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    const created = await prisma.orderMessage.create({
      data: {
        orderId: targetOrderId,
        senderRole,
        message,
      },
    });

    return NextResponse.json({
      success: true,
      item: mapMessage(created)
    });

  } catch (error) {
    console.error("POST MESSAGE ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}