import type { PrismaClient } from "@prisma/client";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";

export type RechargeAdminAction = "approve" | "reject";

export async function processRechargeRequestDecision(
  prisma: PrismaClient,
  opts: {
    requestId: string;
    action: RechargeAdminAction;
    adminEmail?: string;
  }
): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
  const { requestId, action, adminEmail } = opts;

  const requestRow = await prisma.rechargeRequest.findUnique({
    where: { id: requestId },
  });

  if (!requestRow) {
    return { ok: false, message: "Request not found", status: 404 };
  }

  if (String(requestRow.status).toUpperCase() !== "PENDING") {
    return { ok: false, message: "هذا الطلب تمت معالجته مسبقاً" };
  }

  if (action === "approve") {
    const baseAmount = Number(requestRow.amount) || 0;
    const storedBonus = Number(requestRow.bonusAmount);
    const expectedBonus = baseAmount * 0.1;
    const bonusFromRow =
      Number.isFinite(storedBonus) && storedBonus >= 0 ? storedBonus : expectedBonus;
    /** Keep server-side 10% rule if the stored row drifts from amount×10%. */
    const bonus10 =
      Math.abs(bonusFromRow - expectedBonus) <= Math.max(0.05, baseAmount * 1e-9)
        ? bonusFromRow
        : expectedBonus;

    await prisma.$transaction(async (tx) => {
      let pendingApplied = null;
      try {
        pendingApplied = await applyPendingBonusesToRecharge(
          requestRow.agentId,
          adminEmail
        );
      } catch (e) {
        console.error("Bonus error", e);
      }

      const totalToAdd = baseAmount + bonus10 + (pendingApplied?.totalApplied || 0);

      let wallet = await tx.wallet.findFirst({
        where: {
          OR: [{ agentId: requestRow.agentId }, { userId: requestRow.agentId }],
        },
      });

      if (wallet) {
        wallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: totalToAdd }, updatedAt: new Date() },
        });
      } else {
        wallet = await tx.wallet.create({
          data: {
            userId: requestRow.agentId,
            balance: totalToAdd,
          },
        });
      }

      const pendingExtra = pendingApplied?.totalApplied || 0;
      const reason =
        pendingExtra > 0
          ? `Recharge: ${baseAmount} + Bonus: ${bonus10} + Pending rewards: ${pendingExtra}`
          : `Recharge: ${baseAmount} + Bonus: ${bonus10}`;

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          agentId: requestRow.agentId,
          amount: totalToAdd,
          type: "recharge_approved",
          reason,
          meta: { requestId, pendingBonusApplied: pendingExtra },
        },
      });

      await tx.rechargeRequest.update({
        where: { id: requestId },
        data: { status: "approved", updatedAt: new Date() },
      });
    });

    return { ok: true };
  }

  if (action === "reject") {
    await prisma.rechargeRequest.update({
      where: { id: requestId },
      data: { status: "rejected", updatedAt: new Date() },
    });
    return { ok: true };
  }

  return { ok: false, message: "Invalid action" };
}
