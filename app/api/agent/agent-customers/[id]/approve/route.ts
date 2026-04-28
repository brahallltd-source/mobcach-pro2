import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import { isAgentCustomerPendingRequestStatus } from "@/lib/agent-customer-status";
import { hashPassword } from "@/lib/security";
import { executionMinutesFromAgentSettings } from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";

function agentProfileIdFromSession(session: {
  role: string;
  agentProfile: { id: string } | null;
}): string | null {
  if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  return session.agentProfile?.id ?? null;
}

/**
 * Approve a pending link: set GoSport credentials on `Player`, activate user,
 * mark `AgentCustomer` CONNECTED (legacy APPROVED flows remain readable elsewhere).
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

    const body = (await req.json().catch(() => ({}))) as {
      new_gosport_username?: string;
      confirm_new_gosport_username?: string;
      player_gosport_password?: string;
      confirm_player_gosport_password?: string;
      gs365Username?: string;
      confirmGs365Username?: string;
      gs365Password?: string;
      confirmGs365Password?: string;
    };

    const u = String(
      body.new_gosport_username ?? body.gs365Username ?? ""
    ).trim();
    const uc = String(
      body.confirm_new_gosport_username ?? body.confirmGs365Username ?? ""
    ).trim();
    const p = String(body.player_gosport_password ?? body.gs365Password ?? "");
    const pc = String(
      body.confirm_player_gosport_password ?? body.confirmGs365Password ?? ""
    ).trim();
    if (!u || !uc || !p || !pc) {
      return NextResponse.json({ message: "جميع الحقول مطلوبة" }, { status: 400 });
    }
    if (u !== uc) {
      return NextResponse.json(
        { message: "تأكيد اسم المستخدم غير متطابق" },
        { status: 400 }
      );
    }
    if (p !== pc) {
      return NextResponse.json({ message: "تأكيد كلمة المرور غير متطابق" }, { status: 400 });
    }
    if (p.length < 6) {
      return NextResponse.json({ message: "كلمة المرور قصيرة جداً" }, { status: 400 });
    }

    const row = await prisma.agentCustomer.findFirst({
      where: { id: customerId, agentId },
      include: {
        player: { select: { id: true, userId: true } },
      },
    });
    if (!row) {
      return NextResponse.json({ message: "السجل غير موجود" }, { status: 404 });
    }
    if (!isAgentCustomerPendingRequestStatus(row.status)) {
      return NextResponse.json({ message: "تمت المعالجة مسبقاً" }, { status: 400 });
    }

    const agentSettings = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        defaultExecutionTimeMinutes: true,
        user: { select: { executionTime: true } },
      },
    });
    const execMin = executionMinutesFromAgentSettings(
      agentSettings?.user?.executionTime,
      agentSettings?.defaultExecutionTimeMinutes ?? 30
    );

    const hashed = await hashPassword(p);

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: row.playerId },
        data: {
          gosportUsername: u,
          gosportPassword: p,
          status: "active",
        },
      });
      await tx.user.update({
        where: { id: row.player.userId },
        data: {
          status: "ACTIVE",
          playerStatus: "active",
        },
      });
      await tx.agentCustomer.update({
        where: { id: row.id },
        data: {
          gs365Username: u,
          gs365Password: hashed,
          executionTimeMinutes: execMin,
          status: "CONNECTED",
        },
      });
      await tx.activation.updateMany({
        where: {
          playerUserId: row.player.userId,
          agentId,
        },
        data: {
          username: u,
          passwordPlain: p,
          status: "active",
          activatedAt: new Date(),
          sentAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true, message: "تمت الموافقة وتفعيل حساب اللاعب" });
  } catch (e) {
    console.error("agent-customers approve:", e);
    return NextResponse.json({ message: "خطأ في الخادم" }, { status: 500 });
  }
}
