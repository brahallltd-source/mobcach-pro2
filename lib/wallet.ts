/**
 * @fileoverview Single source of truth for wallet money movement.
 *
 * All balance changes for `Wallet` / `WalletLedger` should go through this module so that:
 * - updates and ledger rows stay consistent (every mutation uses `prisma.$transaction`),
 * - debits use conditional SQL where needed to avoid negative balances under concurrency,
 * - API routes / jobs only orchestrate domain rules and call these primitives.
 *
 * Prisma schema: `Wallet` (1:1 `userId` → `User.id`), `WalletLedger` (`type`: IN | OUT, `purpose` free text).
 */

import { Prisma, type Wallet, type WalletLedger } from "@prisma/client";
import { isDatabaseEnabled } from "@/lib/db";
import { prisma } from "./prisma";

// --- Ledger constants (persisted on `WalletLedger.type`) ---

export const LEDGER_IN = "IN" as const;
export const LEDGER_OUT = "OUT" as const;

export type LedgerDirection = (typeof LEDGER_IN) | (typeof LEDGER_OUT);

/** `manualAdjustment` movement direction (matches `WalletLedger.type`). */
export type ManualAdjustmentDirection = "IN" | "OUT";

/** Suggested `purpose` values (schema comment); any non-empty string is allowed after normalization. */
export const PURPOSE_RECHARGE = "RECHARGE" as const;
export const PURPOSE_ORDER = "ORDER" as const;
export const PURPOSE_MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT" as const;
export const PURPOSE_TRANSFER = "TRANSFER" as const;
export const PURPOSE_CREDIT = "CREDIT" as const;
export const PURPOSE_DEBIT = "DEBIT" as const;

export const WALLET_PURPOSE_MAX_LEN = 512;

// --- Internal row shape for raw SQL RETURNING ---

type WalletRow = {
  id: string;
  balance: number;
  userId: string;
  updatedAt: Date;
};

// --- Guards ---

export function requireDatabase(): void {
  if (!isDatabaseEnabled()) {
    throw new Error("Database not enabled");
  }
}

export function assertValidAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }
  return amount;
}

export function normalizePurpose(
  purpose: string | undefined | null,
  fallback: string
): string {
  const s: string = String(purpose ?? "").trim().slice(0, WALLET_PURPOSE_MAX_LEN);
  return s.length > 0 ? s : fallback;
}

// --- DTOs ---

function toWalletSnapshot(w: Pick<Wallet, "id" | "userId" | "balance" | "updatedAt">): WalletSnapshot {
  const snapshot: WalletSnapshot = {
    id: w.id,
    userId: w.userId,
    balance: Number(w.balance),
    updatedAt: w.updatedAt,
  };
  return snapshot;
}

/** Maps a row returned from conditional wallet `UPDATE … RETURNING` to `WalletSnapshot`. */
function walletRowToSnapshot(row: WalletRow): WalletSnapshot {
  const snapshot: WalletSnapshot = {
    id: row.id,
    userId: row.userId,
    balance: Number(row.balance),
    updatedAt: row.updatedAt,
  };
  return snapshot;
}

function toLedgerSnapshot(
  e: Pick<WalletLedger, "id" | "walletId" | "amount" | "type" | "purpose" | "createdAt">
): WalletLedgerSnapshot {
  const snapshot: WalletLedgerSnapshot = {
    id: e.id,
    walletId: e.walletId,
    amount: Number(e.amount),
    type: e.type as LedgerDirection,
    purpose: e.purpose,
    createdAt: e.createdAt,
  };
  return snapshot;
}

export type WalletSnapshot = {
  id: string;
  userId: string;
  balance: number;
  updatedAt: Date;
};

export type WalletLedgerSnapshot = {
  id: string;
  walletId: string;
  amount: number;
  type: LedgerDirection;
  purpose: string;
  createdAt: Date;
};

export type CreditDebitResult = {
  previousBalance: number;
  newBalance: number;
  wallet: WalletSnapshot;
  ledgerEntry: WalletLedgerSnapshot;
};

export type TransferWalletResult = {
  from: CreditDebitResult;
  to: CreditDebitResult;
};

export type ProcessTransferResult = {
  fromWallet: WalletSnapshot;
  toWallet: WalletSnapshot;
  outLedger: WalletLedgerSnapshot;
  inLedger: WalletLedgerSnapshot;
};

export type ManualAdjustmentResult = {
  wallet: WalletSnapshot;
  ledgerEntry: WalletLedgerSnapshot;
};

// --- Reads (no ledger writes) ---

/** Read-only: returns the wallet row or `null` (does not create a wallet). */
export async function fetchWalletByUserId(userId: string): Promise<Wallet | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }
  return prisma.wallet.findUnique({ where: { userId: String(userId) } });
}

/**
 * Returns the wallet for this user id, creating a zero-balance row if missing and the user exists.
 * Parameter name `agentId` is legacy; value must be `User.id`.
 */
export async function dbGetWallet(agentId: string): Promise<Wallet | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const userId: string = String(agentId);
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.wallet.create({
      data: { userId, balance: 0 },
    });
  } catch (_err: unknown) {
    return null;
  }
}

export const createWalletIfMissing: typeof dbGetWallet = dbGetWallet;

export async function dbGetWalletBalance(agentId: string): Promise<number> {
  const wallet = await dbGetWallet(agentId);
  return Number(wallet?.balance ?? 0);
}

export const getWalletBalance: typeof dbGetWalletBalance = dbGetWalletBalance;

// --- Writes: credit / debit (per-user) ---

/**
 * Atomically increases balance and appends a ledger row.
 * `reason` is stored as `WalletLedger.purpose`.
 */
export async function dbCreditWallet(
  agentId: string,
  amount: number,
  reason: string,
  _meta?: Record<string, unknown>
): Promise<CreditDebitResult> {
  requireDatabase();
  const userId: string = String(agentId);
  const amt: number = assertValidAmount(amount);
  const purpose: string = normalizePurpose(reason, PURPOSE_CREDIT);

  return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<CreditDebitResult> => {
    const wallet: Wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance: amt },
      update: { balance: { increment: amt } },
    });

    const previousBalance: number = Number(wallet.balance) - amt;
    const ledgerEntry: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        amount: amt,
        type: LEDGER_IN,
        purpose,
      },
    });

    const result: CreditDebitResult = {
      previousBalance,
      newBalance: Number(wallet.balance),
      wallet: toWalletSnapshot(wallet),
      ledgerEntry: toLedgerSnapshot(ledgerEntry),
    };
    return result;
  });
}

export const creditWallet: typeof dbCreditWallet = dbCreditWallet;

/**
 * Atomically decreases balance only if funds are sufficient, then appends a ledger row.
 * Conditional `UPDATE` avoids overdrawing under concurrent debits.
 */
export async function dbDebitWallet(
  agentId: string,
  amount: number,
  reason: string,
  _meta?: Record<string, unknown>
): Promise<CreditDebitResult> {
  requireDatabase();
  const userId: string = String(agentId);
  const amt: number = assertValidAmount(amount);
  const purpose: string = normalizePurpose(reason, PURPOSE_DEBIT);

  return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<CreditDebitResult> => {
    const rows: WalletRow[] = await tx.$queryRaw<WalletRow[]>(Prisma.sql`
      UPDATE "Wallet"
      SET "balance" = "balance" - ${amt},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "balance" >= ${amt}
      RETURNING "id", "balance", "userId", "updatedAt"
    `);

    if (rows.length === 0) {
      throw new Error("Insufficient wallet balance");
    }

    const row: WalletRow = rows[0]!;
    const newBalance: number = Number(row.balance);
    const previousBalance: number = newBalance + amt;

    const ledgerEntry: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: row.id,
        amount: amt,
        type: LEDGER_OUT,
        purpose,
      },
    });

    const result: CreditDebitResult = {
      previousBalance,
      newBalance,
      wallet: walletRowToSnapshot(row),
      ledgerEntry: toLedgerSnapshot(ledgerEntry),
    };
    return result;
  });
}

export const debitWallet: typeof dbDebitWallet = dbDebitWallet;

// --- Writes: peer transfer (both wallets must exist) ---

/**
 * Peer transfer: **every** database call runs on the interactive client `tx` inside a single
 * `prisma.$transaction`, so reads/writes commit or roll back together.
 *
 * Inside the transaction:
 * - **(a)** Fetch sender wallet; if missing or `balance < amount`, throw `INSUFFICIENT_BALANCE`.
 * - **(b)** Fetch receiver wallet; if missing, throw `RECEIVER_WALLET_NOT_FOUND`.
 * - **(c)** Update sender wallet: decrement `balance` by `amount`.
 * - **(d)** Update receiver wallet: increment `balance` by `amount`.
 * - **(e)** Create `WalletLedger` for sender: `type` `"OUT"`, `amount`, `purpose`.
 * - **(f)** Create `WalletLedger` for receiver: `type` `"IN"`, `amount`, `purpose`.
 */
export async function processTransfer(
  fromUserId: string,
  toUserId: string,
  amount: number,
  purpose: string
): Promise<ProcessTransferResult> {
  requireDatabase();
  const from: string = String(fromUserId);
  const to: string = String(toUserId);
  if (from === to) {
    throw new Error("Cannot transfer to the same wallet");
  }
  const amt: number = assertValidAmount(amount);
  const p: string = normalizePurpose(purpose, PURPOSE_TRANSFER);

  return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<ProcessTransferResult> => {
    // (a) Sender wallet — must exist and cover `amount`
    const fromWallet: Wallet | null = await tx.wallet.findUnique({ where: { userId: from } });
    if (!fromWallet || Number(fromWallet.balance) < amt) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    // (b) Receiver wallet — must exist before moving funds
    const toWallet: Wallet | null = await tx.wallet.findUnique({ where: { userId: to } });
    if (!toWallet) {
      throw new Error('RECEIVER_WALLET_NOT_FOUND');
    }

    // (c) Sender wallet — decrement balance by `amount`
    const senderUpdated: Wallet = await tx.wallet.update({
      where: { userId: from },
      data: { balance: { decrement: amt } },
    });

    // (d) Receiver wallet — increment balance by `amount`
    const receiverUpdated: Wallet = await tx.wallet.update({
      where: { userId: to },
      data: { balance: { increment: amt } },
    });

    // (e) Sender ledger — OUT, amount, purpose
    const outLedger: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: fromWallet.id,
        amount: amt,
        type: LEDGER_OUT,
        purpose: p,
      },
    });

    // (f) Receiver ledger — IN, amount, purpose
    const inLedger: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: toWallet.id,
        amount: amt,
        type: LEDGER_IN,
        purpose: p,
      },
    });

    const result: ProcessTransferResult = {
      fromWallet: toWalletSnapshot(senderUpdated),
      toWallet: toWalletSnapshot(receiverUpdated),
      outLedger: toLedgerSnapshot(outLedger),
      inLedger: toLedgerSnapshot(inLedger),
    };
    return result;
  });
}

// --- Writes: admin adjustment ---

/**
 * **Function 2 — `manualAdjustment` (for admins).** Credits or debits a user wallet and writes one
 * `WalletLedger` row inside a single `prisma.$transaction`. Caller must enforce admin authorization.
 *
 * Inside the transaction:
 * - **(a)** Fetch the user's wallet (`WALLET_NOT_FOUND` if missing).
 * - **(b)** If `type === "OUT"` and `balance < amount`, throw `INSUFFICIENT_BALANCE`.
 * - **(c)** Update wallet balance accordingly: `IN` → increment by `amount`; `OUT` → decrement by `amount`
 *   (conditional `UPDATE` for concurrency).
 * - **(d)** Create a `WalletLedger` entry logging this adjustment (`type`, `amount`, `purpose`).
 */
export async function manualAdjustment(
  userId: string,
  amount: number,
  type: ManualAdjustmentDirection,
  purpose: string
): Promise<ManualAdjustmentResult> {
  requireDatabase();
  const uid: string = String(userId);
  const amt: number = assertValidAmount(amount);
  const p: string = normalizePurpose(purpose, PURPOSE_MANUAL_ADJUSTMENT);

  return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<ManualAdjustmentResult> => {
    // (a) User wallet — must exist
    const walletRow: Wallet | null = await tx.wallet.findUnique({ where: { userId: uid } });
    if (!walletRow) {
      throw new Error('WALLET_NOT_FOUND');
    }

    // (b) OUT debits — fail fast when balance is below amount
    if (type === "OUT" && Number(walletRow.balance) < amt) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    if (type === "IN") {
      // (c) Credit — increment balance by `amount`
      const updated: Wallet = await tx.wallet.update({
        where: { userId: uid },
        data: { balance: { increment: amt } },
      });
      // (d) Ledger — log adjustment (IN, amount, purpose)
      const ledgerEntry: WalletLedger = await tx.walletLedger.create({
        data: {
          walletId: walletRow.id,
          amount: amt,
          type: "IN",
          purpose: p,
        },
      });
      const creditResult: ManualAdjustmentResult = {
        wallet: toWalletSnapshot(updated),
        ledgerEntry: toLedgerSnapshot(ledgerEntry),
      };
      return creditResult;
    }

    // (c) Debit — decrement balance by `amount` (conditional under concurrency)
    const rows: WalletRow[] = await tx.$queryRaw<WalletRow[]>(Prisma.sql`
      UPDATE "Wallet"
      SET "balance" = "balance" - ${amt},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${uid} AND "balance" >= ${amt}
      RETURNING "id", "balance", "userId", "updatedAt"
    `);

    if (rows.length === 0) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const row: WalletRow = rows[0]!;
    // (d) Ledger — log adjustment (OUT, amount, purpose)
    const ledgerEntry: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: walletRow.id,
        amount: amt,
        type: "OUT",
        purpose: p,
      },
    });

    const debitResult: ManualAdjustmentResult = {
      wallet: walletRowToSnapshot(row),
      ledgerEntry: toLedgerSnapshot(ledgerEntry),
    };
    return debitResult;
  });
}

// --- Writes: transfer with receiver upsert (legacy path) ---

/**
 * Debits sender atomically, upserts receiver wallet, writes IN/OUT ledger rows in one transaction.
 */
export async function dbTransferWallet(
  fromUserId: string,
  toUserId: string,
  amount: number,
  purpose: string
): Promise<TransferWalletResult> {
  requireDatabase();
  const from: string = String(fromUserId);
  const to: string = String(toUserId);
  if (from === to) {
    throw new Error("Cannot transfer to the same wallet");
  }
  const amt: number = assertValidAmount(amount);
  const p: string = normalizePurpose(purpose, PURPOSE_TRANSFER);

  return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<TransferWalletResult> => {
    const fromDebitRows: WalletRow[] = await tx.$queryRaw<WalletRow[]>(Prisma.sql`
      UPDATE "Wallet"
      SET "balance" = "balance" - ${amt},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${from} AND "balance" >= ${amt}
      RETURNING "id", "balance", "userId", "updatedAt"
    `);

    if (fromDebitRows.length === 0) {
      throw new Error("Insufficient wallet balance");
    }

    const fromRow: WalletRow = fromDebitRows[0]!;
    const fromNewBal: number = Number(fromRow.balance);
    const fromPrevBal: number = fromNewBal + amt;

    const toWallet: Wallet = await tx.wallet.upsert({
      where: { userId: to },
      create: { userId: to, balance: amt },
      update: { balance: { increment: amt } },
    });

    const toPrevBal: number = Number(toWallet.balance) - amt;

    const outLedger: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: fromRow.id,
        amount: amt,
        type: LEDGER_OUT,
        purpose: p,
      },
    });

    const inLedger: WalletLedger = await tx.walletLedger.create({
      data: {
        walletId: toWallet.id,
        amount: amt,
        type: LEDGER_IN,
        purpose: p,
      },
    });

    const fromResult: CreditDebitResult = {
      previousBalance: fromPrevBal,
      newBalance: fromNewBal,
      wallet: walletRowToSnapshot(fromRow),
      ledgerEntry: toLedgerSnapshot(outLedger),
    };

    const toResult: CreditDebitResult = {
      previousBalance: toPrevBal,
      newBalance: Number(toWallet.balance),
      wallet: toWalletSnapshot(toWallet),
      ledgerEntry: toLedgerSnapshot(inLedger),
    };

    const transferResult: TransferWalletResult = { from: fromResult, to: toResult };
    return transferResult;
  });
}

export const transferWallet: typeof dbTransferWallet = dbTransferWallet;
