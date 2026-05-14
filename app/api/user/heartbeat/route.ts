import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleHeartbeat() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    if (!session?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const roleUpper = String(session.role ?? "").trim().toUpperCase();

    await prisma.user.update({
      where: { id: session.id },
      data: roleUpper === "AGENT" ? { lastSeen: now, isOnline: true } : { lastSeen: now },
    });

    if (roleUpper === "AGENT") {
      await prisma.agent.updateMany({
        where: { userId: session.id },
        data: { online: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/user/heartbeat", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST() {
  return handleHeartbeat();
}

export async function GET() {
  return handleHeartbeat();
}
