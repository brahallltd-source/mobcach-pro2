import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Agent presence ping — call ~every 2 minutes from the agent UI while logged in. */
export async function POST() {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: session.id },
      data: { lastSeen: now, isOnline: true },
    });
    await prisma.agent.updateMany({
      where: { userId: session.id },
      data: { online: true },
    });

    return NextResponse.json({ ok: true, lastSeen: now.toISOString() });
  } catch (e) {
    console.error("POST /api/user/heartbeat", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
