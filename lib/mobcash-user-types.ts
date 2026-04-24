import type { Agent, Player, Wallet } from "@prisma/client";

/**
 * Full `user` object returned by `POST /api/login` and `GET /api/auth/session`
 * (Prisma relation name is `player`, not `playerProfile`).
 */
export type MobcashUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  /** Player lifecycle / linking (`User.playerStatus`), e.g. `rejected` after agent declines link. */
  playerStatus?: string | null;
  agentProfile: Agent | null;
  player: Player | null;
  wallet: Wallet | null;
  /** Agent application gate (`User.applicationStatus`). */
  applicationStatus?: string;
  hasUsdtAccess?: boolean;
  rejectionReason?: string | null;
  /** Present for ADMIN / SUPER_ADMIN — canonical ids from `lib/permissions.ts`. */
  adminPermissions?: string[];
};

/**
 * Subset stored in the httpOnly `mobcash_user` cookie — keep small; `player` mirrors
 * the Prisma field name with a narrow pick for routing / hydration.
 */
export type MobcashUserCookiePayload = Pick<
  MobcashUser,
  "id" | "email" | "role" | "status"
> & {
  player: Pick<Player, "id" | "username" | "assignedAgentId"> | null;
  adminPermissions?: string[];
  applicationStatus?: string;
  hasUsdtAccess?: boolean;
};

export function toMobcashUserCookiePayload(user: MobcashUser): MobcashUserCookiePayload {
  const p = user.player;
  const roleU = String(user.role ?? "").trim().toUpperCase();
  const base: MobcashUserCookiePayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    player: p
      ? {
          id: p.id,
          username: p.username,
          assignedAgentId: p.assignedAgentId ?? null,
        }
      : null,
  };
  if (roleU === "ADMIN" || roleU === "SUPER_ADMIN") {
    if (user.adminPermissions?.length) {
      return { ...base, adminPermissions: user.adminPermissions };
    }
  }
  if (roleU === "AGENT") {
    return {
      ...base,
      applicationStatus: user.applicationStatus ?? "NONE",
      hasUsdtAccess: Boolean(user.hasUsdtAccess),
    };
  }
  if (roleU === "PLAYER") {
    return {
      ...base,
      applicationStatus: user.applicationStatus ?? "NONE",
    };
  }
  return base;
}
