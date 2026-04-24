import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function recentlySeen(lastSeen: Date | string | null | undefined): boolean {
  if (!lastSeen) return false;
  const t = lastSeen instanceof Date ? lastSeen.getTime() : new Date(lastSeen).getTime();
  return Number.isFinite(t) && Date.now() - t < ONLINE_WINDOW_MS;
}

function deriveAgentContactOnline(agent: {
  online: boolean;
  user: { isOnline: boolean; lastSeen: Date } | null;
}): boolean {
  return Boolean(agent.online) || Boolean(agent.user?.isOnline) || recentlySeen(agent.user?.lastSeen);
}

function derivePlayerUserOnline(user: { isOnline: boolean; lastSeen: Date }): boolean {
  return Boolean(user.isOnline) || recentlySeen(user.lastSeen);
}

// دالة لتنسيق الرسالة
function mapMessage(msg: any) {
  return {
    id: msg.id,
    senderRole: msg.senderRole,
    message: msg.message,
    created_at: msg.createdAt,
    orderId: msg.orderId,
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
    const listRole = searchParams.get("listRole");
    const userEmail = searchParams.get("userEmail")?.toLowerCase();

    // 1. جلب قائمة المحادثات (Conversations List) + جهات اتصال مجمّعة للواجهة
    if (listRole && userEmail) {
      if (listRole === "player") {
        const orders = await prisma.order.findMany({
          where: { playerEmail: userEmail },
          select: {
            id: true,
            agentId: true,
            playerEmail: true,
            gosportUsername: true,
            updatedAt: true,
            agent: {
              select: {
                id: true,
                fullName: true,
                username: true,
                online: true,
                user: { select: { isOnline: true, lastSeen: true } },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, message: true, senderRole: true, createdAt: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

        const byAgent = new Map<
          string,
          {
            preview: string;
            atMs: number;
            agent: NonNullable<(typeof orders)[number]["agent"]>;
          }
        >();

        for (const o of orders) {
          if (!o.agentId || !o.agent) continue;
          const m = o.messages[0];
          const msgMs = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
          const orderMs = new Date(o.updatedAt).getTime();
          const score = Math.max(msgMs, orderMs);
          const prev = byAgent.get(o.agentId);
          const preview = (m?.message ?? "").trim();
          if (!prev || score >= prev.atMs) {
            byAgent.set(o.agentId, {
              atMs: score,
              preview: preview || prev?.preview || "",
              agent: o.agent,
            });
          }
        }

        const contacts = Array.from(byAgent.entries()).map(([id, row]) => {
          const { agent } = row;
          const lastSeen = agent.user?.lastSeen ?? null;
          return {
            id,
            name: (agent.fullName || agent.username || "وكيل").trim(),
            subtitle: agent.username ? `@${agent.username}` : null,
            lastMessagePreview: row.preview,
            lastMessageAt: new Date(row.atMs).toISOString(),
            isOnline: deriveAgentContactOnline(agent),
            lastSeenIso: lastSeen instanceof Date ? lastSeen.toISOString() : lastSeen ? String(lastSeen) : null,
          };
        });
        contacts.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

        return NextResponse.json({ conversations: orders, contacts });
      }

      const orders = await prisma.order.findMany({
        where: { agentId: userEmail },
        select: {
          id: true,
          agentId: true,
          playerEmail: true,
          gosportUsername: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, message: true, senderRole: true, createdAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const emails = [...new Set(orders.map((o) => o.playerEmail.toLowerCase()))];
      const users =
        emails.length > 0
          ? await prisma.user.findMany({
              where: { email: { in: emails }, role: "PLAYER" },
              select: {
                email: true,
                isOnline: true,
                lastSeen: true,
                username: true,
                player: {
                  select: { gosportUsername: true, username: true, firstName: true, lastName: true },
                },
              },
            })
          : [];
      const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

      const byPlayer = new Map<
        string,
        {
          preview: string;
          atMs: number;
          gosport: string;
          email: string;
          user?: (typeof users)[number];
        }
      >();

      for (const o of orders) {
        const key = o.playerEmail.toLowerCase();
        const m = o.messages[0];
        const msgMs = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
        const orderMs = new Date(o.updatedAt).getTime();
        const score = Math.max(msgMs, orderMs);
        const prev = byPlayer.get(key);
        const preview = (m?.message ?? "").trim();
        const u = userByEmail.get(key);
        if (!prev || score >= prev.atMs) {
          byPlayer.set(key, {
            atMs: score,
            preview: preview || prev?.preview || "",
            gosport: o.gosportUsername || prev?.gosport || "",
            email: o.playerEmail,
            user: u ?? prev?.user,
          });
        } else if (!byPlayer.get(key)?.user && u) {
          const cur = byPlayer.get(key)!;
          byPlayer.set(key, { ...cur, user: u });
        }
      }

      const contacts = Array.from(byPlayer.values()).map((row) => {
        const u = row.user;
        const displayName =
          row.gosport ||
          u?.player?.gosportUsername ||
          u?.player?.username ||
          u?.username ||
          row.email.split("@")[0] ||
          "لاعب";
        const lastSeen = u?.lastSeen ?? null;
        return {
          id: row.email,
          name: String(displayName).trim(),
          subtitle: row.email,
          lastMessagePreview: row.preview,
          lastMessageAt: new Date(row.atMs).toISOString(),
          isOnline: u ? derivePlayerUserOnline(u) : false,
          lastSeenIso: lastSeen instanceof Date ? lastSeen.toISOString() : lastSeen ? String(lastSeen) : null,
        };
      });
      contacts.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      return NextResponse.json({ conversations: orders, contacts });
    }

    // 2. جلب التاريخ الموحد بين لاعب ووكيل معين
    if (playerEmail && agentId) {
      const allOrdersBetweenThem = await prisma.order.findMany({
        where: { playerEmail, agentId },
        include: { messages: true }
      });

      const allMessages = allOrdersBetweenThem
        .flatMap(order => order.messages)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return NextResponse.json({ 
        messages: allMessages.map(mapMessage),
        count: allMessages.length 
      });
    }

    // 3. حالة طلب واحد
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
    let finalPlayerEmail = playerEmail;
    let finalAgentId = agentId;

    // البحث عن آخر طلب إذا لم يتوفر orderId
    if (!targetOrderId && playerEmail && agentId) {
      const lastOrder = await prisma.order.findFirst({
        where: { playerEmail, agentId },
        orderBy: { createdAt: 'desc' }
      });
      targetOrderId = lastOrder?.id;
    }

    // إذا توفر الـ orderId ولكن نقصت المعلومات الأخرى، نجلبها من الطلب
    if (targetOrderId && (!finalPlayerEmail || !finalAgentId)) {
      const orderData = await prisma.order.findUnique({ where: { id: targetOrderId } });
      if (orderData) {
        finalPlayerEmail = orderData.playerEmail;
        finalAgentId = orderData.agentId;
      }
    }

    if (!targetOrderId || !senderRole || !message) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    // 1. إنشاء الرسالة في قاعدة البيانات
    const created = await prisma.orderMessage.create({
      data: {
        orderId: targetOrderId,
        senderRole,
        message,
      },
    });

    // 2. 🚀 إرسال إشعار للطرف الآخر مع وضع الإيميل في العنوان لسهولة الفلترة
    try {
      if (senderRole === "player" && finalAgentId) {
        // اللاعب أرسل -> نُعلم الوكيل (نضع إيميل اللاعب في العنوان)
        await createNotification({
          targetRole: "agent",
          targetId: finalAgentId,
          title: `رسالة جديدة من اللاعب (${finalPlayerEmail})`,
          message: message.length > 60 ? message.substring(0, 60) + "..." : message,
        });
      } 
      else if (senderRole === "agent" && finalPlayerEmail) {
        // الوكيل أرسل -> نُعلم اللاعب
        await createNotification({
          targetRole: "player",
          targetId: finalPlayerEmail,
          title: "رسالة جديدة من الوكيل",
          message: message.length > 60 ? message.substring(0, 60) + "..." : message,
        });
      }
    } catch (notifErr) {
      console.error("Notification creation failed:", notifErr);
    }

    return NextResponse.json({
      success: true,
      item: mapMessage(created)
    });

  } catch (error) {
    console.error("POST MESSAGE ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}