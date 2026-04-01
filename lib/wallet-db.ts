import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

function toJsonMeta(meta?: Record<string, unknown>): Prisma.InputJsonValue {
  return (meta ?? {}) as Prisma.InputJsonValue;
}

export async function dbGetWallet(agentId: string) {
  const prisma = getPrisma();
  if (!prisma) return null;

  let wallet = await prisma.wallet.findUnique({
    where: { agentId: String(agentId) },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { agentId: String(agentId), balance: 0 },
    });
  }

  return wallet;
}

export async function dbGetWalletBalance(agentId: string) {
  const wallet = await dbGetWallet(agentId);
  return Number(wallet?.balance || 0);
}

export async function dbCreditWallet(
  agentId: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>
) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database not enabled");
  if (Number.isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

  return prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({
      where: { agentId: String(agentId) },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { agentId: String(agentId), balance: 0 },
      });
    }

    const previousBalance = Number(wallet.balance || 0);

    const updated = await tx.wallet.update({
      where: { agentId: String(agentId) },
      data: { balance: previousBalance + amount },
    });

    const ledgerEntry = await tx.walletLedger.create({
      data: {
        agentId: String(agentId),
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

export async function dbDebitWallet(
  agentId: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>
) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database not enabled");
  if (Number.isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

  return prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({
      where: { agentId: String(agentId) },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { agentId: String(agentId), balance: 0 },
      });
    }

    const previousBalance = Number(wallet.balance || 0);

    if (amount > previousBalance) {
      throw new Error("Insufficient wallet balance");
    }

    const updated = await tx.wallet.update({
      where: { agentId: String(agentId) },
      data: { balance: previousBalance - amount },
    });

    const ledgerEntry = await tx.walletLedger.create({
      data: {
        agentId: String(agentId),
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