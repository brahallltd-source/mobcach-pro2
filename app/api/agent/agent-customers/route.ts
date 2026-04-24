import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isAgentCustomerLinkedStatus } from "@/lib/agent-customer-status";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function agentProfileIdFromSession(session: {
  role: string;
  agentProfile: { id: string } | null;
}): string | null {
  if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  return session.agentProfile?.id ?? null;
}

/** GET — list `AgentCustomer` rows for the signed-in agent. */
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const agentId = session ? agentProfileIdFromSession(session) : null;
    if (!session || !agentId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const suspended = await rejectAgentIfSuspended(prisma, session.id);
    if (suspended) return suspended;

    const rows = await prisma.agentCustomer.findMany({
      where: { agentId },
      include: {
        player: {
          select: {
            id: true,
            username: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      customers: rows.map((r) => ({
        id: r.id,
        playerId: r.playerId,
        isFlagged: r.isFlagged,
        username: r.player.username,
        phone: r.player.phone,
        status: r.status,
        executionTimeMinutes: r.executionTimeMinutes,
        gs365Username: r.gs365Username,
        quickRechargeReady:
          isAgentCustomerLinkedStatus(r.status) &&
          Boolean(r.gs365Username && r.gs365Password),
      })),
    });
  } catch (e) {
    console.error("agent-customers GET:", e);
    return NextResponse.json({ message: "Error fetching list" }, { status: 500 });
  }
}

/** POST — add a player to this agent’s list by `Player.id`. */
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const agentId = session ? agentProfileIdFromSession(session) : null;
    if (!session || !agentId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, session.id);
    if (suspended) return suspended;

    const body = (await req.json().catch(() => ({}))) as { playerId?: string };
    const playerId = String(body.playerId ?? "").trim();
    if (!playerId) {
      return NextResponse.json({ message: "playerId مطلوب" }, { status: 400 });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });
    if (!player) {
      return NextResponse.json({ message: "اللاعب غير موجود" }, { status: 404 });
    }

    const row = await prisma.agentCustomer.upsert({
      where: {
        agentId_playerId: { agentId, playerId },
      },
      create: {
        agentId,
        playerId,
        isFlagged: false,
        status: "PENDING",
      },
      update: {},
    });

    await prisma.player.updateMany({
      where: { id: playerId, assignedAgentId: null },
      data: { assignedAgentId: agentId },
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: row.id,
        playerId: row.playerId,
        isFlagged: row.isFlagged,
        status: row.status,
      },
    });
  } catch (e) {
    console.error("agent-customers POST:", e);
    return NextResponse.json({ message: "تعذّر الإضافة" }, { status: 500 });
  }
}
