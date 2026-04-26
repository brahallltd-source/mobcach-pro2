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
  const createdAt = n.createdAt.toISOString();
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link,
    read: n.read,
    isRead: n.read,
    createdAt,
    created_at: createdAt,
  };
}

/** Authenticated in-app list for the signed-in user only (`?for=me`). */
export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get("for") !== "me") {
      return NextResponse.json(
        { error: "Unauthorized", message: "Use ?for=me with a signed-in session." },
        { status: 401 }
      );
    }

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
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);
    return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 500 });
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
