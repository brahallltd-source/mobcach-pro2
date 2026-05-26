import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createGoSportPlayer } from "@/lib/gosport-api";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";

function isAgentRole(role: unknown): boolean {
  return String(role ?? "").trim().toUpperCase() === "AGENT";
}

export async function POST() {
  try {
    const session = await getSessionUserFromCookies();
    if (!session || !isAgentRole(session.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database unavailable" }, { status: 500 });
    }

    const me = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        goSportUsername: true,
        goSportPassword: true,
        goSportIntegrationStatus: true,
      },
    });
    if (!me) {
      return NextResponse.json({ success: false, message: "Agent not found" }, { status: 404 });
    }

    const goSportUsername = String(me.goSportUsername ?? "").trim();
    const goSportPassword = String(me.goSportPassword ?? "").trim();
    if (!goSportUsername || !goSportPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing GoSport credentials. Please re-link your integration first.",
          integrationStatus: String(me.goSportIntegrationStatus ?? "INACTIVE"),
        },
        { status: 400 },
      );
    }

    const dummyUsername = `testplayer_${Date.now().toString().slice(-8)}`;
    const dummyPassword = "Password123!";

    // Uses full GoSport flow: login cookie -> session accessToken -> JWT parent -> create player.
    const result = await createGoSportPlayer(me.id, dummyUsername, dummyPassword);

    const after = await prisma.user.findUnique({
      where: { id: me.id },
      select: { goSportIntegrationStatus: true },
    });
    const integrationStatus = String(after?.goSportIntegrationStatus ?? "INACTIVE").trim().toUpperCase();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "GoSport auto-creation failed.",
          integrationStatus,
          debug: {
            attemptedUsername: dummyUsername,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test bot execution succeeded. Dummy player created on GoSport.",
      integrationStatus,
      debug: {
        attemptedUsername: dummyUsername,
        attemptedPassword: dummyPassword,
      },
      data: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected bot test failure.";
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}
