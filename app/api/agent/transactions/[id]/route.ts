import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import {
  executionMinutesFromAgentSettings,
  normalizeRechargeProofStatus,
  RECHARGE_PROOF_STATUS,
} from "@/lib/recharge-proof-lifecycle";
import { applyAutomatedMilestoneBonuses } from "@/lib/agent-milestone-bonus";
import { applySubAgentReferrerBonuses } from "@/lib/agent-subagent-bonus";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgent(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  if (!session.agentProfile?.id) return null;
  return { userId: session.id, agentProfileId: session.agentProfile.id };
}

type PatchBody = {
  action?: string;
  reason?: string;
};

/**
 * PATCH — approve or reject a payment proof owned by this agent.
 * Approve: wallet transfer agent → player, optional late penalty on rating/dislikes.
 * Reject: mandatory agentRejectReason.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const agentCtx = requireAgent(session);
    if (!agentCtx) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, agentCtx.userId);
    if (suspended) return suspended;

    const { id } = await ctx.params;
    const proofId = String(id || "").trim();
    if (!proofId) {
      return NextResponse.json({ message: "معرّف غير صالح" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const action = String(body.action || "").toLowerCase();
    const reason = String(body.reason || "").trim();

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ message: "إجراء غير معروف" }, { status: 400 });
    }

    const row = await prisma.paymentProofTransaction.findFirst({
      where: { id: proofId, agentUserId: agentCtx.userId },
    });

    if (!row) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }

    const statusNorm = normalizeRechargeProofStatus(row.status);
    if (statusNorm !== RECHARGE_PROOF_STATUS.PROCESSING) {
      return NextResponse.json(
        { message: "لا يمكن تعديل طلب تمت معالجته مسبقاً" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      if (reason.length < 5) {
        return NextResponse.json(
          { message: "يجب إدخال سبب الرفض (5 أحرف على الأقل)" },
          { status: 400 }
        );
      }
      const updated = await prisma.paymentProofTransaction.update({
        where: { id: proofId },
        data: {
          status: RECHARGE_PROOF_STATUS.AGENT_REJECTED,
          agentRejectReason: reason.slice(0, 2000),
        },
      });
      try {
        await createNotification({
          userId: row.playerUserId,
          title: "Payment proof rejected",
          message: `Your payment proof was rejected. Reason: ${reason.slice(0, 300)}`,
          type: "ALERT",
          link: `/player/transactions/${encodeURIComponent(proofId)}`,
        });
      } catch (e) {
        console.warn("Payment proof reject notification:", e);
      }
      return NextResponse.json({
        ok: true,
        transaction: {
          id: updated.id,
          status: updated.status,
          agentRejectReason: updated.agentRejectReason,
        },
      });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: agentCtx.userId },
      select: { balance: true, id: true },
    });
    const balance = Number(wallet?.balance ?? 0);
    if (!Number.isFinite(balance) || balance < row.amount) {
      return NextResponse.json(
        {
          message:
            "رصيدك غير كافٍ لتأكيد هذا الشحن. أضف رصيداً أو رفض الطلب إذا لم يصل التحويل.",
        },
        { status: 400 }
      );
    }

    const agentRow = await prisma.agent.findUnique({
      where: { id: agentCtx.agentProfileId },
      select: {
        id: true,
        rating: true,
        userId: true,
        defaultExecutionTimeMinutes: true,
        user: { select: { executionTime: true } },
      },
    });
    if (!agentRow) {
      return NextResponse.json({ message: "ملف الوكيل غير موجود" }, { status: 404 });
    }

    const execMinutes = executionMinutesFromAgentSettings(
      agentRow.user?.executionTime,
      agentRow.defaultExecutionTimeMinutes
    );
    const started = row.timerStartedAt ? row.timerStartedAt.getTime() : Date.now();
    const deadlineMs = started + execMinutes * 60_000;
    const late = Date.now() > deadlineMs;

    await prisma.$transaction(async (tx) => {
      let penaltyApplied = row.isLatePenaltyApplied;
      if (late && !row.isLatePenaltyApplied) {
        const nextRating = Math.max(0, Number(agentRow.rating) * 0.98);
        await tx.agent.update({
          where: { id: agentRow.id },
          data: { rating: nextRating },
        });
        await tx.user.update({
          where: { id: agentCtx.userId },
          data: { dislikes: { increment: 1 } },
        });
        penaltyApplied = true;
      }

      let fromWallet = await tx.wallet.findUnique({ where: { userId: agentCtx.userId } });
      if (!fromWallet) {
        fromWallet = await tx.wallet.create({
          data: { userId: agentCtx.userId, balance: 0 },
        });
      }
      let toWallet = await tx.wallet.findUnique({ where: { userId: row.playerUserId } });
      if (!toWallet) {
        toWallet = await tx.wallet.create({
          data: { userId: row.playerUserId, balance: 0 },
        });
      }

      const prev = Number(fromWallet.balance);
      if (row.amount > prev) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.wallet.update({
        where: { userId: agentCtx.userId },
        data: { balance: { decrement: row.amount } },
      });
      await tx.wallet.update({
        where: { userId: row.playerUserId },
        data: { balance: { increment: row.amount } },
      });

      await tx.walletLedger.create({
        data: {
          walletId: fromWallet.id,
          agentId: agentCtx.userId,
          type: "OUT",
          amount: row.amount,
          reason: "RECHARGE_PROOF_APPROVE",
        },
      });
      await tx.walletLedger.create({
        data: {
          walletId: toWallet.id,
          agentId: row.playerUserId,
          type: "IN",
          amount: row.amount,
          reason: "RECHARGE_PROOF_APPROVE",
        },
      });

      await tx.paymentProofTransaction.update({
        where: { id: proofId },
        data: {
          status: RECHARGE_PROOF_STATUS.AGENT_APPROVED,
          agentRejectReason: null,
          isLatePenaltyApplied: penaltyApplied,
        },
      });

      const playerRow = await tx.player.findUnique({
        where: { userId: row.playerUserId },
        select: { id: true },
      });
      if (playerRow) {
        /** `AgentCustomer.agentId` is `Agent.id` (same as `agentRow.id`); `playerId` is `Player.id`. */
        await tx.agentCustomer.updateMany({
          where: { agentId: agentRow.id, playerId: playerRow.id },
          data: { totalRecharged: { increment: row.amount } },
        });
      }

      await applyAutomatedMilestoneBonuses(tx, {
        agentId: agentRow.id,
        agentUserId: agentCtx.userId,
      });

      await tx.user.update({
        where: { id: agentCtx.userId },
        data: { totalSales: { increment: row.amount } },
      });

      await applySubAgentReferrerBonuses(tx, { childUserId: agentCtx.userId });
    });

    try {
      await createNotification({
        userId: row.playerUserId,
        title: "Payment proof approved",
        message: `Your payment of ${row.amount} MAD was approved and credited to your wallet.`,
        type: "SUCCESS",
        link: `/player/transactions/${encodeURIComponent(proofId)}`,
      });
    } catch (e) {
      console.warn("Payment proof approve notification:", e);
    }

    const updated = await prisma.paymentProofTransaction.findUnique({
      where: { id: proofId },
      select: { id: true, status: true, isLatePenaltyApplied: true },
    });

    return NextResponse.json({
      ok: true,
      transaction: {
        id: updated?.id,
        status: updated?.status,
        isLatePenaltyApplied: updated?.isLatePenaltyApplied,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { message: "رصيدك غير كافٍ لتأكيد هذا الشحن." },
        { status: 400 }
      );
    }
    console.error("PATCH /api/agent/transactions/[id]", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
