import type { Prisma, PrismaClient, RechargeRequest } from "@prisma/client";
import { applyPendingBonusesToRechargeInTransaction } from "@/lib/bonus";
import { BONUS_PER_BLOCK_DH } from "@/lib/agent-milestone-bonus";

export type RechargeAdminAction = "approve" | "reject";

const APPROVAL_SUCCESS_AR =
  "تمت الموافقة على طلب الشحن، الرصيد المضاف يشمل مكافآت الترويج المستحقة.";

function normStatus(s: string) {
  return String(s ?? "").trim().toUpperCase();
}

/** Derive base / 10% / invitation promo DH from a `RechargeRequest` row (same rules as approval credit). */
function computeApprovalAmounts(row: RechargeRequest) {
  const baseAmount = Number(row.amount) || 0;
  const storedBonus = Number(row.bonusAmount);
  const expectedBonus = baseAmount * 0.1;
  const bonusFromRow =
    Number.isFinite(storedBonus) && storedBonus >= 0 ? storedBonus : expectedBonus;
  const bonus10 =
    Math.abs(bonusFromRow - expectedBonus) <= Math.max(0.05, baseAmount * 1e-9)
      ? bonusFromRow
      : expectedBonus;

  const affiliateDhRaw = Number(row.pendingBonusApplied);
  const affiliateDh =
    Number.isFinite(affiliateDhRaw) && affiliateDhRaw > 0 ? affiliateDhRaw : 0;

  let affiliateBlocks = 0;
  if (affiliateDh > 0) {
    affiliateBlocks = Math.round(affiliateDh / BONUS_PER_BLOCK_DH);
    if (Math.abs(affiliateBlocks * BONUS_PER_BLOCK_DH - affiliateDh) > 0.01) {
      return {
        ok: false as const,
        message: "قيمة مكافأة الترويج المخزنة في الطلب غير صالحة",
        status: 400,
      };
    }
  }

  const requestFinalAmount = baseAmount + bonus10 + affiliateDh;
  return {
    ok: true as const,
    baseAmount,
    bonus10,
    affiliateDh,
    affiliateBlocks,
    /** Base + standard bonus + invitation promo (row snapshot; legacy profile bonuses added later). */
    requestFinalAmount,
  };
}

function buildLedgerReason(parts: {
  baseAmount: number;
  bonus10: number;
  affiliateDh: number;
  legacyPendingDh: number;
}): string {
  const segments = [
    `Recharge ${parts.baseAmount} DH`,
    `10% bonus ${parts.bonus10} DH`,
  ];
  if (parts.affiliateDh > 0) {
    segments.push(`Promo bonus (invitations) ${parts.affiliateDh} DH`);
  }
  if (parts.legacyPendingDh > 0) {
    segments.push(`Profile pending bonuses ${parts.legacyPendingDh} DH`);
  }
  return segments.join(" + ");
}

export async function processRechargeRequestDecision(
  prisma: PrismaClient,
  opts: {
    requestId: string;
    action: RechargeAdminAction;
    adminEmail?: string;
  }
): Promise<
  | { ok: true; message?: string }
  | { ok: false; message: string; status?: number }
> {
  const { requestId, action, adminEmail } = opts;

  const requestRow = await prisma.rechargeRequest.findUnique({
    where: { id: requestId },
  });

  if (!requestRow) {
    return { ok: false, message: "Request not found", status: 404 };
  }

  if (normStatus(requestRow.status) !== "PENDING") {
    return { ok: false, message: "هذا الطلب تمت معالجته مسبقاً" };
  }

  if (action === "approve") {
    {
      const preCheck = computeApprovalAmounts(requestRow);
      if (preCheck.ok === false) {
        return { ok: false, message: preCheck.message, status: preCheck.status };
      }
    }

    const notPending = Object.assign(new Error("Recharge request is no longer pending"), {
      code: "NOT_PENDING" as const,
    });

    try {
      await prisma.$transaction(async (tx) => {
        const latest = await tx.rechargeRequest.findUnique({
          where: { id: requestId },
        });
        if (!latest || normStatus(latest.status) !== "PENDING") {
          throw notPending;
        }

        const latestParts = computeApprovalAmounts(latest);
        if (latestParts.ok === false) {
          throw Object.assign(new Error(latestParts.message), {
            code: "INVALID_PROMO" as const,
            status: latestParts.status,
          });
        }

        const agentUser = await tx.user.findUnique({
          where: { id: latest.agentId },
          select: { agentProfile: { select: { id: true } } },
        });
        const agentTableId = agentUser?.agentProfile?.id ?? null;

        let legacyPendingDh = 0;
        if (agentTableId) {
          const applied = await applyPendingBonusesToRechargeInTransaction(
            tx,
            agentTableId,
            adminEmail ?? ""
          );
          legacyPendingDh = applied.totalApplied;
        }

        const totalToAdd =
          latestParts.baseAmount +
          latestParts.bonus10 +
          latestParts.affiliateDh +
          legacyPendingDh;

        let wallet = await tx.wallet.findFirst({
          where: {
            OR: [{ agentId: latest.agentId }, { userId: latest.agentId }],
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
              userId: latest.agentId,
              balance: totalToAdd,
            },
          });
        }

        const reason = buildLedgerReason({
          baseAmount: latestParts.baseAmount,
          bonus10: latestParts.bonus10,
          affiliateDh: latestParts.affiliateDh,
          legacyPendingDh,
        });

        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            agentId: latest.agentId,
            amount: totalToAdd,
            type: "recharge_approved",
            reason,
            meta: {
              requestId,
              requestFinalAmount: latestParts.requestFinalAmount,
              invitationAffiliateDh: latestParts.affiliateDh,
              legacyPendingBonusDh: legacyPendingDh,
              totalCredited: totalToAdd,
            } as Prisma.InputJsonValue,
          },
        });

        if (latestParts.affiliateBlocks > 0) {
          await tx.user.update({
            where: { id: latest.agentId },
            data: { bonusesClaimed: { increment: latestParts.affiliateBlocks } },
          });
        }

        await tx.rechargeRequest.update({
          where: { id: requestId },
          data: { status: "approved", updatedAt: new Date() },
        });
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.code === "NOT_PENDING") {
        return { ok: false, message: "هذا الطلب تمت معالجته مسبقاً" };
      }
      if (err.code === "INVALID_PROMO") {
        return {
          ok: false,
          message: String(err.message || "قيمة مكافأة الترويج المخزنة في الطلب غير صالحة"),
          status: err.status ?? 400,
        };
      }
      console.error("processRechargeRequestDecision approve transaction:", e);
      return {
        ok: false,
        message: "فشل تنفيذ الموافقة على الطلب. لم يُعتمد أي تغيير على الرصيد.",
        status: 500,
      };
    }

    return { ok: true, message: APPROVAL_SUCCESS_AR };
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
