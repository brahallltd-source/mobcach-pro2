import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

// دالة مساعدة للـ Meta
function toJsonMeta(meta?: unknown): any {
  if (meta === undefined || meta === null) return Prisma.JsonNull;
  return meta;
}

// 1. الحصول على المحفظة (الأساس)
export async function dbGetWallet(agentId: string) {
  const prisma = getPrisma();
  if (!prisma) return null;

  let wallet = await prisma.wallet.findUnique({
    where: { agentId: String(agentId) },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        agentId: String(agentId),
        balance: 0,
        agent: { connect: { id: String(agentId) } },
        user: { connect: { id: String(agentId) } },
      } as any,
    });
  }
  return wallet;
}

// 🟢 هادي باش تحل الموشكيل ديال 'createWalletIfMissing'
export const createWalletIfMissing = dbGetWallet;

// 2. الحصول على الرصيد
export async function dbGetWalletBalance(agentId: string) {
  const wallet = await dbGetWallet(agentId);
  return Number(wallet?.balance || 0);
}

// 🟢 هادي باش تحل الموشكيل ديال 'getWalletBalance'
export const getWalletBalance = dbGetWalletBalance;

// 3. إضافة رصيد (Credit)
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
    const wallet = await dbGetWallet(agentId);
    if (!wallet) throw new Error("Wallet not found");

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

// 🟢 هادي باش تحل الموشكيل ديال 'creditWallet'
export const creditWallet = dbCreditWallet;

// 4. سحب رصيد (Debit)
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
    const wallet = await dbGetWallet(agentId);
    if (!wallet) throw new Error("Wallet not found");

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

// 🟢 هادي باش تحل الموشكيل ديال 'debitWallet'
export const debitWallet = dbDebitWallet;