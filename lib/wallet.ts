import { dataPath, nowIso, readJsonArray, writeJsonArray, uid } from "@/lib/json";

type Wallet = { agentId: string; balance: number; updated_at: string; };
type WalletLedgerEntry = { id: string; agentId: string; type: "credit" | "debit"; amount: number; reason: string; meta?: Record<string, unknown>; created_at: string; };

const walletsPath = dataPath("agent_wallets.json");
const ledgerPath = dataPath("wallet_ledger.json");

function assertAmount(amount: number) {
  if (Number.isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
}

export function getWallet(agentId: string): Wallet | null {
  return readJsonArray<Wallet>(walletsPath).find((wallet) => wallet.agentId === String(agentId)) || null;
}

export function createWalletIfMissing(agentId: string): Wallet {
  const existing = getWallet(agentId);
  if (existing) return existing;
  const wallets = readJsonArray<Wallet>(walletsPath);
  const wallet: Wallet = { agentId: String(agentId), balance: 0, updated_at: nowIso() };
  wallets.push(wallet);
  writeJsonArray(walletsPath, wallets);
  return wallet;
}

function appendLedgerEntry(agentId: string, type: "credit" | "debit", amount: number, reason: string, meta?: Record<string, unknown>) {
  const ledger = readJsonArray<WalletLedgerEntry>(ledgerPath);
  const entry: WalletLedgerEntry = { id: uid("ledger"), agentId: String(agentId), type, amount, reason, meta: meta || {}, created_at: nowIso() };
  ledger.unshift(entry);
  writeJsonArray(ledgerPath, ledger);
  return entry;
}

export function getWalletBalance(agentId: string) {
  return Number(createWalletIfMissing(agentId).balance || 0);
}

export function creditWallet(agentId: string, amount: number, reason: string, meta?: Record<string, unknown>) {
  assertAmount(amount);
  createWalletIfMissing(agentId);
  const wallets = readJsonArray<Wallet>(walletsPath);
  const walletIndex = wallets.findIndex((wallet) => wallet.agentId === String(agentId));
  if (walletIndex === -1) throw new Error("Wallet not found");
  const previousBalance = Number(wallets[walletIndex].balance || 0);
  wallets[walletIndex] = { ...wallets[walletIndex], balance: previousBalance + amount, updated_at: nowIso() };
  writeJsonArray(walletsPath, wallets);
  const ledgerEntry = appendLedgerEntry(agentId, "credit", amount, reason, meta);
  return { previousBalance, newBalance: wallets[walletIndex].balance, wallet: wallets[walletIndex], ledgerEntry };
}

export function debitWallet(agentId: string, amount: number, reason: string, meta?: Record<string, unknown>) {
  assertAmount(amount);
  createWalletIfMissing(agentId);
  const wallets = readJsonArray<Wallet>(walletsPath);
  const walletIndex = wallets.findIndex((wallet) => wallet.agentId === String(agentId));
  if (walletIndex === -1) throw new Error("Wallet not found");
  const previousBalance = Number(wallets[walletIndex].balance || 0);
  if (amount > previousBalance) throw new Error("Insufficient wallet balance");
  wallets[walletIndex] = { ...wallets[walletIndex], balance: previousBalance - amount, updated_at: nowIso() };
  writeJsonArray(walletsPath, wallets);
  const ledgerEntry = appendLedgerEntry(agentId, "debit", amount, reason, meta);
  return { previousBalance, newBalance: wallets[walletIndex].balance, wallet: wallets[walletIndex], ledgerEntry };
}
