import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { loginAndGetGoSportToken } from "@/lib/gosport-auth";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";

function asAgentRole(role: unknown): boolean {
  return String(role ?? "").trim().toUpperCase() === "AGENT";
}

export async function GET() {
  try {
    const session = await getSessionUserFromCookies();
    if (!session || !asAgentRole(session.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database unavailable" }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { goSportUsername: true, goSportIntegrationStatus: true },
    });

    return NextResponse.json({
      success: true,
      integration: {
        goSportUsername: String(user?.goSportUsername ?? "").trim(),
        goSportIntegrationStatus: String(user?.goSportIntegrationStatus ?? "ACTIVE").trim() || "ACTIVE",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to load integration status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session || !asAgentRole(session.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database unavailable" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      goSportUsername?: string;
      goSportPassword?: string;
    };
    const goSportUsername = String(body.goSportUsername ?? "").trim();
    const goSportPassword = String(body.goSportPassword ?? "").trim();
    if (!goSportUsername || !goSportPassword) {
      return NextResponse.json(
        { success: false, message: "GoSport username and password are required." },
        { status: 400 },
      );
    }

    // Validate credentials first (watchdog will mark INACTIVE on failure).
    await loginAndGetGoSportToken({
      agentUserId: session.id,
      username: goSportUsername,
      password: goSportPassword,
    });

    await prisma.user.update({
      where: { id: session.id },
      data: {
        goSportUsername,
        goSportPassword,
        goSportIntegrationStatus: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      message: "GoSport integration reactivated successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reactivate integration.";
    const status = message.includes("Integration disconnected") ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
