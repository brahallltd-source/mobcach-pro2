import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import { buildAgentInvitationsStatsPayload } from "@/lib/agent-invitations-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgent(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  if (!session.agentProfile?.id) return null;
  return { userId: session.id, agentId: session.agentProfile.id };
}

/** Dashboard: invite code, milestone progress, linked players with `totalRecharged`, sub-agents. */
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 503 });
    }

    const session = await getSessionUserFromCookies();
    const ctx = requireAgent(session);
    if (!ctx) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, ctx.userId);
    if (suspended) return suspended;

    const payload = await buildAgentInvitationsStatsPayload(prisma, ctx);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("GET /api/agent/invite", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
