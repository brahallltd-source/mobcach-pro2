import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isAgentCustomerLinkedStatus } from "@/lib/agent-customer-status";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";

export const runtime = "nodejs";

function agentProfileIdFromSession(session: {
  role: string;
  agentProfile: { id: string } | null;
}): string | null {
  if (String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  return session.agentProfile?.id ?? null;
}

/** POST — move funds from the agent’s user wallet to the player’s user wallet (linked `AgentCustomer`). */
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const agentProfileId = session ? agentProfileIdFromSession(session) : null;
    if (!session || !agentProfileId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, session.id);
    if (suspended) return suspended;

    const body = (await req.json().catch(() => ({}))) as {
      playerId?: string;
      amount?: number | string;
    };
    const playerId = String(body.playerId ?? "").trim();
    const amount = Number(body.amount);
    if (!playerId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "معرّف اللاعب والمبلغ مطلوبان" }, { status: 400 });
    }

    const link = await prisma.agentCustomer.findUnique({
      where: {
        agentId_playerId: { agentId: agentProfileId, playerId },
      },
      select: { id: true, status: true },
    });
    if (!link) {
      return NextResponse.json({ message: "هذا اللاعب ليس في قائمتك" }, { status: 403 });
    }
    if (!isAgentCustomerLinkedStatus(link.status)) {
      return NextResponse.json(
        {
          message:
            "هذا الرابط بانتظار الموافقة من صفحة الطلبات. أكمل الموافقة وبيانات GS365 أولاً.",
        },
        { status: 403 }
      );
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { userId: true },
    });
    if (!player) {
      return NextResponse.json({ message: "اللاعب غير موجود" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      let fromWallet = await tx.wallet.findUnique({ where: { userId: session.id } });
      if (!fromWallet) {
        fromWallet = await tx.wallet.create({
          data: { userId: session.id, balance: 0 },
        });
      }
      let toWallet = await tx.wallet.findUnique({ where: { userId: player.userId } });
      if (!toWallet) {
        toWallet = await tx.wallet.create({
          data: { userId: player.userId, balance: 0 },
        });
      }

      const prev = Number(fromWallet.balance);
      if (amount > prev) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.wallet.update({
        where: { userId: session.id },
        data: { balance: { decrement: amount } },
      });
      await tx.wallet.update({
        where: { userId: player.userId },
        data: { balance: { increment: amount } },
      });

      await tx.walletLedger.create({
        data: {
          walletId: fromWallet.id,
          agentId: session.id,
          type: "OUT",
          amount,
          reason: "AGENT_QUICK_RECHARGE",
        },
      });
      await tx.walletLedger.create({
        data: {
          walletId: toWallet.id,
          agentId: player.userId,
          type: "IN",
          amount,
          reason: "AGENT_QUICK_RECHARGE",
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "AGENT_QUICK_RECHARGE",
        entityType: "Player",
        entityId: playerId,
        meta: { amount, playerUserId: player.userId },
      },
    });

    return NextResponse.json({ success: true, message: "تم الشحن بنجاح" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { success: false, message: "رصيد محفظتك غير كافٍ" },
        { status: 400 }
      );
    }
    console.error("quick-recharge:", e);
    return NextResponse.json({ success: false, message: "تعذّر تنفيذ الشحن" }, { status: 500 });
  }
}
