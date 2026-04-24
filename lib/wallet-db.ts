import type { Prisma, Wallet } from "@prisma/client";
import { Prisma as PrismaNs } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds, type ResolvedAgentWalletIds } from "@/lib/agent-wallet-resolve";

type WalletMeta = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

function toJsonMeta(meta?: unknown): WalletMeta {
  if (meta === undefined || meta === null) return PrismaNs.JsonNull;
  return (meta as Prisma.InputJsonValue) ?? PrismaNs.JsonNull;
}

type Tx = Prisma.TransactionClient;

/**
 * Single canonical wallet row per agent: `userId` = agent’s user, `agentId` = `Agent.id` (for dashboard queries).
 */
export async function ensureAgentWallet(tx: Tx, r: ResolvedAgentWalletIds): Promise<Wallet> {
  let w = await tx.wallet.findUnique({ where: { userId: r.userId } });
  if (!w) {
    w = await tx.wallet.findUnique({ where: { agentId: r.agentTableId } });
  }

  if (!w) {
    return tx.wallet.create({
      data: {
        userId: r.userId,
        agentId: r.agentTableId,
        balance: 0,
      },
    });
  }

  if (w.userId !== r.userId) {
    throw new Error(
      "Wallet user mismatch for this agent (duplicate or legacy row). Contact support to merge wallets.",
    );
  }

  if (w.agentId == null || w.agentId !== r.agentTableId) {
    return tx.wallet.update({
      where: { id: w.id },
      data: { agentId: r.agentTableId },
    });
  }

  return w;
}

/** @param rawKey `Agent.id` or agent’s `User.id` */
export async function dbGetWallet(rawKey: string) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const resolved = await resolveAgentWalletIds(prisma, rawKey);
  if (!resolved) return null;

  return prisma.$transaction((tx) => ensureAgentWallet(tx, resolved));
}

/** @param rawKey `Agent.id` or agent’s `User.id` */
export async function dbGetWalletBalance(rawKey: string) {
  const wallet = await dbGetWallet(rawKey);
  return Number(wallet?.balance || 0);
}

/** @param rawKey `Agent.id` or agent’s `User.id` — ledger `agentId` stores agent’s `User.id`. */
export async function dbCreditWallet(
  rawKey: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>,
) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database not enabled");
  if (Number.isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveAgentWalletIds(tx, rawKey);
    if (!resolved) throw new Error("Agent not found for wallet credit");

    const wallet = await ensureAgentWallet(tx, resolved);
    const previousBalance = Number(wallet.balance || 0);

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    const ledgerEntry = await tx.walletLedger.create({
      data: {
        agentId: resolved.userId,
        walletId: wallet.id,
        type: "credit",
        amount,
        reason,
        meta: toJsonMeta(meta),
      },
    });

    return {
      previousBalance,
      newBalance: Number(updated.balance || 0),
      wallet: updated,
      ledgerEntry,
    };
  });
}

/** @param rawKey `Agent.id` or agent’s `User.id` */
export async function dbDebitWallet(
  rawKey: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>,
) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database not enabled");
  if (Number.isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveAgentWalletIds(tx, rawKey);
    if (!resolved) throw new Error("Agent not found for wallet debit");

    const wallet = await ensureAgentWallet(tx, resolved);
    const previousBalance = Number(wallet.balance || 0);

    if (amount > previousBalance) {
      throw new Error("Insufficient wallet balance");
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    const ledgerEntry = await tx.walletLedger.create({
      data: {
        agentId: resolved.userId,
        walletId: wallet.id,
        type: "debit",
        amount,
        reason,
        meta: toJsonMeta(meta),
      },
    });

    return {
      previousBalance,
      newBalance: Number(updated.balance || 0),
      wallet: updated,
      ledgerEntry,
    };
  });
}
