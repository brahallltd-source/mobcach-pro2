import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeRow(n: {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link,
    isRead: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

/** In-app list for the signed-in user (`?for=me`). Legacy chat polling: `role` + `targetId`. */
export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const { searchParams } = new URL(req.url);
    const forMe = searchParams.get("for") === "me";

    if (forMe) {
      const user = await getSessionUserFromCookies();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const limit = Math.min(
        50,
        Math.max(1, parseInt(searchParams.get("limit") || "5", 10) || 5)
      );

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        prisma.notification.count({
          where: { userId: user.id, read: false },
        }),
      ]);

      return NextResponse.json({
        notifications: notifications.map(serializeRow),
        unreadCount,
      });
    }

    const targetRole =
      searchParams.get("targetRole") || searchParams.get("role");
    const targetId = searchParams.get("targetId");

    if (!targetRole || !targetId) {
      return NextResponse.json({ notifications: [] });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        targetRole: targetRole,
        targetId: String(targetId),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false }, { status: 503 });
    }

    const user = await getSessionUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      markAll?: boolean;
    };

    if (body.markAll === true) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    const id = body.id != null ? String(body.id) : "";
    if (!id) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });

    return NextResponse.json({ success: result.count > 0 });
  } catch (error) {
    console.error("UPDATE NOTIFICATION ERROR:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
