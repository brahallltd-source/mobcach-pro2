import type { Prisma } from "@prisma/client";

/**
 * All User scalars except `permissions` — avoids Prisma P2023 when the DB cell
 * is not a valid Postgres `text[]` for Prisma's `String[]` mapping.
 */
export const USER_SELECT_NO_PERMISSIONS = {
  id: true,
  email: true,
  username: true,
  passwordHash: true,
  role: true,
  playerStatus: true,
  assignedAgentId: true,
  agentId: true,
  frozen: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  applicationStatus: true,
  hasUsdtAccess: true,
  rejectionReason: true,
  flags: true,
  deletedAt: true,
  inviteCode: true,
  bonusesClaimed: true,
  referredById: true,
  agentBonusesPaid: true,
  totalSales: true,
} as const satisfies Prisma.UserSelect;

/** Login + session: scalars (no `permissions`) plus common relations. */
export const USER_SESSION_SELECT = {
  ...USER_SELECT_NO_PERMISSIONS,
  agentProfile: true,
  player: true,
  wallet: true,
} as const satisfies Prisma.UserSelect;

/** Nested `user` for API responses (no password hash). */
export const USER_SELECT_SAFE_RELATION = {
  id: true,
  email: true,
  username: true,
  role: true,
  status: true,
  frozen: true,
  accountStatus: true,
  playerStatus: true,
  assignedAgentId: true,
  agentId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  likes: true,
  dislikes: true,
  executionTime: true,
  paymentMethods: true,
} as const satisfies Prisma.UserSelect;
