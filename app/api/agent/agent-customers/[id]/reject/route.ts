import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import { isAgentCustomerPendingRequestStatus } from "@/lib/agent-customer-status";
import { AGENT_LINK_REQUEST_REJECTED } from "@/lib/agent-link-request-audit";

export const runtime = "nodejs";

function agentProfileIdFromSession(session: {
  role: string;
  agentProfile: { id: string } | null;
}): string | null {
  if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  return session.agentProfile?.id ?? null;
}

/**
 * Reject a pending player–agent link: detach agent, store reason, allow player to pick another agent.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
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

    const body = (await req.json().catch(() => ({}))) as { rejectionReason?: string };
    const reason = String(body.rejectionReason ?? "").trim();
    if (!reason || reason.length < 3) {
      return NextResponse.json({ message: "سبب الرفض مطلوب (3 أحرف على الأقل)" }, { status: 400 });
    }
    if (reason.length > 2000) {
      return NextResponse.json({ message: "سبب الرفض طويل جداً" }, { status: 400 });
    }

    const row = await prisma.agentCustomer.findFirst({
      where: { id: customerId, agentId },
      include: {
        player: {
          select: {
            id: true,
            userId: true,
            username: true,
            user: { select: { email: true, username: true } },
          },
        },
      },
    });
    if (!row) {
      return NextResponse.json({ message: "السجل غير موجود" }, { status: 404 });
    }
    if (!isAgentCustomerPendingRequestStatus(row.status)) {
      return NextResponse.json({ message: "تمت المعالجة مسبقاً" }, { status: 400 });
    }

    const playerEmail = row.player.user?.email ?? "";
    const playerUsername = row.player.username || row.player.user?.username || "";

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: AGENT_LINK_REQUEST_REJECTED,
          entityType: "AgentCustomer",
          entityId: row.id,
          meta: {
            agentProfileId: agentId,
            playerId: row.playerId,
            playerUserId: row.player.userId,
            playerEmail,
            playerUsername,
            rejectionReason: reason,
          },
        },
      });
      await tx.agentCustomer.delete({ where: { id: row.id } });
      await tx.player.update({
        where: { id: row.playerId },
        data: { assignedAgentId: null },
      });
      await tx.user.update({
        where: { id: row.player.userId },
        data: {
          assignedAgentId: null,
          playerStatus: "rejected",
          rejectionReason: reason,
          status: "PENDING_AGENT",
        },
      });
    });

    return NextResponse.json({ success: true, message: "تم رفض الطلب" });
  } catch (e) {
    console.error("agent-customers reject:", e);
    return NextResponse.json({ message: "خطأ في الخادم" }, { status: 500 });
  }
}
