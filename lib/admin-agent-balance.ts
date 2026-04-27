import type { Prisma } from "@prisma/client";
import type { ResolvedAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { createNotification } from "@/lib/notifications";

type Tx = Prisma.TransactionClient;

export type ManualBalanceSetResult = {
  newBalance: number;
  previousBalance: number;
  delta: number;
};

function formatDhAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Set wallet to an absolute balance, sync {@link Agent.availableBalance}, write BalanceLog + WalletLedger.
 */
export async function adminManualSetWalletBalanceInTx(
  tx: Tx,
  resolved: ResolvedAgentWalletIds,
  nextBalance: number,
  meta: { adminId: string; reason: string; ledgerReason: string },
): Promise<ManualBalanceSetResult> {
  const wallet = await ensureAgentWallet(tx, resolved);
  const previousBalance = Number(wallet.balance || 0);
  const delta = nextBalance - previousBalance;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: nextBalance },
  });

  await tx.agent.update({
    where: { id: resolved.agentTableId },
    data: { availableBalance: nextBalance },
  });

  await tx.balanceLog.create({
    data: {
      adminId: meta.adminId,
      agentId: resolved.userId,
      type: "MANUAL_ADJUST",
      amount: Math.abs(delta),
      operation: delta >= 0 ? "IN" : "OUT",
      bonusApplied: false,
      previousBalance,
      newBalance: nextBalance,
    },
  });

  if (delta !== 0) {
    await tx.walletLedger.create({
      data: {
        agentId: resolved.userId,
        walletId: wallet.id,
        type: delta > 0 ? "credit" : "debit",
        amount: Math.abs(delta),
        reason: meta.ledgerReason,
        meta: {
          previousBalance,
          newBalance: nextBalance,
          adminId: meta.adminId,
          reason: meta.reason,
        },
      },
    });
  }

  return { newBalance: nextBalance, previousBalance, delta };
}

/**
 * In-app notification + web push for a manual top-up (positive credit). `userId` = agent's User.id.
 */
export async function notifyAgentBalanceTopup(opts: {
  userId: string;
  newBalance: number;
  /** DH added (positive) — used in the Arabic/English message body. */
  amountDh: number;
}) {
  const amount = formatDhAmount(opts.amountDh);
  const title = "Balance Top-up Successful";
  const message = `تمت إضافة ${amount} درهم إلى محفظتك الرئيسية.`;
  console.log(
    `[admin-balance] notify top-up start userId=${opts.userId} newBalance=${opts.newBalance} amountDh=${amount} title=${title}`,
  );
  const created = await createNotification({
    userId: opts.userId,
    title,
    message,
    type: "SUCCESS",
  });
  const pushResult = created ? { notificationId: created.id } : { notificationId: null, note: "createNotification returned null" };
  console.log(`[admin-balance] notify top-up result`, pushResult);
  return created;
}
