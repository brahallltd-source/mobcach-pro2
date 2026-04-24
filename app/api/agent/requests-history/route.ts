import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { rejectAgentIfSuspended } from "@/lib/agent-account-guard";
import { AGENT_LINK_REQUEST_REJECTED } from "@/lib/agent-link-request-audit";
import type { AgentRequestHistoryRow } from "@/lib/agent-requests-history-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agentProfileIdFromSession(session: {
  role: string;
  agentProfile: { id: string } | null;
}): string | null {
  if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  return session.agentProfile?.id ?? null;
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available", items: [] }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const agentId = session ? agentProfileIdFromSession(session) : null;
    if (!session || !agentId) {
      return NextResponse.json({ message: "Unauthorized", items: [] }, { status: 401 });
    }

    const suspended = await rejectAgentIfSuspended(prisma, session.id);
    if (suspended) return suspended;

    const [approvedLinks, rejectAudits] = await Promise.all([
      prisma.agentCustomer.findMany({
        where: {
          agentId,
          status: { in: ["CONNECTED", "APPROVED"] },
        },
        include: {
          player: {
            select: {
              id: true,
              username: true,
              user: { select: { email: true, username: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 150,
      }),
      prisma.auditLog.findMany({
        where: {
          userId: session.id,
          action: AGENT_LINK_REQUEST_REJECTED,
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
    ]);

    const approvedItems: AgentRequestHistoryRow[] = approvedLinks.map((r) => {
      const email = r.player.user.email;
      const uname = r.player.username || r.player.user.username;
      return {
        id: `ac-${r.id}`,
        kind: "approved",
        playerLabel: `${uname} · ${email}`,
        decidedAt: r.updatedAt.toISOString(),
        status: "approved",
        rejectionReason: null,
      };
    });

    const rejectedItems: AgentRequestHistoryRow[] = rejectAudits.flatMap((log) => {
      const meta = (log.meta && typeof log.meta === "object" ? log.meta : {}) as Record<string, unknown>;
      const agentProfileId = String(meta.agentProfileId ?? "").trim();
      if (agentProfileId && agentProfileId !== agentId) return [];

      const email = String(meta.playerEmail ?? "").trim();
      const uname = String(meta.playerUsername ?? "").trim();
      const label =
        email && uname ? `${uname} · ${email}` : email || uname || `لاعب · ${String(log.entityId ?? "").slice(0, 8)}`;
      return [
        {
          id: `audit-${log.id}`,
          kind: "rejected" as const,
          playerLabel: label,
          decidedAt: log.createdAt.toISOString(),
          status: "rejected" as const,
          rejectionReason: String(meta.rejectionReason ?? "").trim() || null,
        },
      ];
    });

    const items = [...approvedItems, ...rejectedItems].sort(
      (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime(),
    );

    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error("requests-history:", e);
    return NextResponse.json({ message: "خطأ في الخادم", items: [] }, { status: 500 });
  }
}
